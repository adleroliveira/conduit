const jobQ = require('jobq')
const STEPS_MUST_BE_FUNCTIONS = 'All provided steps must be either a function or a conduit instance'

class Conduit {
  constructor(config) {
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
      let nextStepPromise
      let currentStepCopy = parseInt(0 + this.currentStep)
      switch(this.getTypeOf(input)) {
        case 'array':
          let process
          if (this.getTypeOf(this.steps[currentStepCopy]) === 'conduit') {
            nextStepPromise = new Promise((resolve, reject) => {
              this.steps[currentStepCopy]
                  .on('processFinish', resolve)
                  .on('error', reject)
                  .run(input)
            })
          } else {
            process = (input) => this.steps[currentStepCopy](input, this.setup)
            nextStepPromise = new Promise((resolve, reject) => {
              let queue = new jobQ({
                process,
                source: input,
                maxProcesses: input.length
              })
              .on('start', () => {
                this.results[currentStepCopy] = []
              })
              .on('jobFinish', (resultInfo) => {
                this.results[currentStepCopy].push(resultInfo.result)
              })
              .on('error', (err) => {
                console.log('Something went wrong', err)
              })
              .on('processFinish', (processInfo) => {
                if (!processInfo.errors) {
                  return resolve(this.results[currentStepCopy])
                } else {
                  return reject('something wrong', processInfo)
                }
              })
              .start()
            })
          }
          break
        default:
          nextStepPromise = new Promise((resolve, reject) => {
            try {
              if (this.getTypeOf(this.steps[this.currentStep]) === 'conduit') {
                this.steps[this.currentStep]
                  .on('processFinish', resolve)
                  .on('error', reject)
                  .run(input)
              } else {
                let result = this.steps[this.currentStep](input, this.setup)
                if (this.getTypeOf(result) === 'promise') return result.then(resolve).catch(reject)
                return resolve(result)
              }
            } catch (e) {
              return reject(e)
            }
          })
          break;
      }
      nextStepPromise.then((result) => {
        this.currentResult = result
        this.currentStep++
        this.run(result)
      })
    } else {
      if (this.reducer && this.getTypeOf(this.reducer) === 'function' && Array.isArray(this.currentResult)) {
        let finalResult = this.reducer(this.currentResult)
        if (this.getTypeOf(finalResult) === 'promise') {
          finalResult.then((result) => this.emit('processFinish', result))
        } else {
          this.emit('processFinish', finalResult)
        }
      } else {
        this.emit('processFinish', this.currentResult)
      }
    }
    return this
  }

  on(event, handler) {
    this.events[event] = handler
    return this
  }

  emit(event, payload) {
    if (this.events[event]) this.events[event](payload)
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