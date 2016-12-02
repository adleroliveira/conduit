const jobQ = require('jobq')
const STEPS_MUST_BE_FUNCTIONS = 'All provided steps must be either a function or a conduit instance'

class Conduit {
  constructor(config = {}) {
    this.setup = config.setup || {}
    this.steps = config.steps || []
    if (!this.validSteps()) throw new Error(STEPS_MUST_BE_FUNCTIONS)
    this.currentStep = 0
    this.events = {}
    this.currentResult = null
    this.results = {}
    this.reducer = config.reducer
    return this
  }

  run(input) {
    if (this.currentStep < this.steps.length) {
      if (['promise', 'array', 'function', 'conduit'].indexOf(this.getTypeOf(input)) === -1) input = [input]
      let nextStepPromise
      let currentStepCopy = this.currentStep
      if (this.getTypeOf(this.steps[currentStepCopy]) === 'conduit') {
        nextStepPromise = this.steps[currentStepCopy].run(input)
      } else {
        nextStepPromise = new Promise((resolve, reject) => {
          let queue = new jobQ({
            process: (inputFromJobQ, cb) => this.steps[currentStepCopy](inputFromJobQ, this.setup, cb),
            source: new Promise((resolve) => resolve(input)),
            maxProcesses: input.length,
            stopOnError: true
          })
          .on('start', () => this.results[currentStepCopy] = [])
          .on('jobFinish', (resultInfo) => this.results[currentStepCopy].push(resultInfo.result))
          .on('error', reject)
          .on('processFinish', (processInfo) => {
            if(!processInfo.errors) resolve(this.results[currentStepCopy])
          })
          .start()
        })
      }
      return nextStepPromise.then((result) => {
        this.currentResult = result
        this.currentStep++
        return this.run(result)
      })
    } else {
      return new Promise((resolve, reject) => {
        if (this.reducer && this.getTypeOf(this.reducer) === 'function' && Array.isArray(this.currentResult)) {
          let finalResult = this.reducer(this.currentResult, (err, finalResult) => {
            if (err) return reject(err)
            resolve(finalResult)
          })
          if (this.getTypeOf(finalResult) === 'promise') {
            finalResult.then(resolve)
          } else if (finalResult !== undefined) {
            resolve(finalResult)
          }
        } else {
          resolve(this.currentResult)
        }
      })
    }
  }

  validSteps() {
    return this.steps.length ? this.steps.every((step) => {
      return this.getTypeOf(step) === 'function' || this.getTypeOf(step) === 'conduit'
    }) : true
  }

  getTypeOf(thing) {
    if (thing instanceof Conduit) return 'conduit'
    if (Array.isArray(thing)) return 'array'
    if (thing === undefined) return 'undefined'
    if (thing.then) return 'promise'
    if (typeof thing === 'function') return 'function'
    return 'unknown'
  }
}

module.exports = Conduit