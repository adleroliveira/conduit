declare module "conduit" {
  interface ConduitOptionsInterface {
    steps?: (Conduit|(Function))[]
    setup?: any
    reducer?: Function
  }

  class Conduit {
    constructor(options: ConduitOptionsInterface)
    run(input?: any): Promise<any>
  }
  namespace Conduit {}
  export = Conduit
}
