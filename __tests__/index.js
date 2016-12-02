'use strict'

const conduit = require('../index')
const plus1 = (n) => n+1
const plus2 = (n) => n+2
const plus3 = (n) => n+3
const promiseResult = (n) => new Promise((resolve) => resolve(n))
const asyncPlus1 = (n, _, cb) => { setTimeout(() => cb(null, n+1), 0) }
const asyncPlus2 = (n, _, cb) => { setTimeout(() => cb(null, n+2), 0) }
const asyncPlus3 = (n, _, cb) => { setTimeout(() => cb(null, n+3), 0) }
const reducer = (arr) => arr.reduce((acc, item) => acc + item)
const promiseReducer = (arr) => new Promise((resolve) => resolve(arr.reduce((acc, item) => acc + item)))
const callbackReducer = (arr, cb) => {
  cb(null, arr.reduce((acc, item) => acc + item))
}
const syncError = () => {
  throw new Error('ERROR')
}
const asyncError = (n, _, cb) => {
  setTimeout(() => cb(new Error('ERROR')), 0)
}
const promiseError = (n, _, cb) => new Promise((_, reject) => {
  reject(new Error('ERROR'))
})
const errorReducer = (arr, cb) => {
  setTimeout(() => cb(new Error('ERROR')), 0)
}

describe('errors', () => {
  it('throws on anything but functions and conduits as steps', () => {
    expect(() => {
      new conduit({steps: [1, 2, 3]}).run()
    }).toThrowError(new Error('All provided steps must be either a function or a conduit instance'))
  })

  it('should do nothing', () => {
    new conduit().run()
    .then((data) => expect(data).toBe(null))
  })

  it('should blow up (sync)', () => {
    new conduit({steps: [syncError]}).run(1)
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('should blow up (sync)(array)', () => {
    new conduit({steps: [syncError]}).run([1])
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('should blow up (async)', () => {
    new conduit({steps: [asyncError]}).run(1)
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('should blow up (async)(array)', () => {
    new conduit({steps: [asyncError]}).run([1])
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('should blow up (promise)', () => {
    new conduit({steps: [promiseError]}).run(1)
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('should blow up (promise)(array)', () => {
    new conduit({steps: [promiseError]}).run([1])
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('reducer should blow up (sync)', () => {
    new conduit({steps: [plus1], reducer: syncError}).run([1, 2, 3])
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })

  it('reducer should blow up (async)', () => {
    new conduit({steps: [plus1], reducer: errorReducer}).run([1, 2, 3])
    .then(syncError) // Should not be called
    .catch((err) => expect(err).toEqual(new Error('ERROR')))
  })
})

describe('steps', () => {
  it('works with function steps', () => {
    return new conduit({steps: [plus1, plus2, plus3]}).run([1, 2, 3])
    .then((data) => expect(data).toEqual([7, 8, 9]))
  })

  it('works with async function steps', () => {
    return new conduit({steps: [asyncPlus1, asyncPlus2, asyncPlus3]}).run([1, 2, 3])
    .then((data) => expect(data).toEqual([7, 8, 9]))
  })

  it('works with conduits steps', () => {
    const conduitStep = new conduit({steps: [plus1, plus2]})
    return new conduit({steps: [conduitStep, asyncPlus2, asyncPlus3]})
    .run([1, 2, 3]).then((data) => expect(data).toEqual([9, 10, 11]))
  })
})

describe('input', () => {
  it('should work with non array inputs', () => {
    const conduitStep = new conduit({steps: [plus1, plus2]})
    return new conduit({steps: [conduitStep, asyncPlus2, plus3, promiseResult]})
    .run(1).then((data) => expect(data).toEqual([9]))
  })
})

describe('setup', () => {
  it('should pass setup to step', () => {
    const setupStep = (n, setup) => {
      expect(setup.test).toBe(1)
      return true
    }
    return new conduit({steps: [setupStep], setup: {test: 1}})
    .run(1)
  })
})

describe('reducer', () => {
  it('should reduce (sync)', () => {
    new conduit({steps: [plus1, plus2, plus3], reducer: reducer})
    .run([1, 2, 3]).then((data) => expect(data).toBe(24))
  })

  it('should reduce (promise)', () => {
    return new conduit({steps: [plus1, plus2, plus3], reducer: promiseReducer})
    .run([1, 2, 3]).then((data) => expect(data).toBe(24))
  })

  it('should reduce (promise)', () => {
    return new conduit({steps: [plus1, plus2, plus3], reducer: callbackReducer})
    .run([1, 2, 3]).then((data) => expect(data).toBe(24))
  })
})