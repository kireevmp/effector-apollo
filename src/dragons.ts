import { type Effect, type EventCallable, type Node, step } from "effector"

export function patchHandler(fx: Effect<any, any, any>, called: EventCallable<Promise<any>>) {
  /**
   * This overrides Effect with our handler that
   * allows us to aquire a Promise of each call.
   *
   * We need this to track each independent execution
   * rather than `trigger` -> `done` events, which may
   * or may not be in the correct order.
   */

  /**
   * patchHandler is a compute step that overrides the hander.
   * It is injected just before the execution.
   *
   * {@see https://github.com/effector/effector/blob/a0f997b3d355c5a9b682e3747f00a1ffe7de8646/src/effector/__tests__/effect/index.test.ts#L432}
   */
  const patchHandler = step.compute({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    fn(run: { handler: Function }) {
      const original = run.handler

      run.handler = (...params: unknown[]) => {
        /**
         * We convert each call to Promise, regardless of whether
         * the `original` call is sync or not.
         */
        const req = Promise.resolve(original(...params))
        return called(req)
      }

      return run
    },
  })

  /**
   * 0. Get the handler from Scope.
   * 1. Our handler that `wraps`
   * 2. Running the handler
   */
  pickRunner(fx).seq.splice(1, 0, patchHandler)
}

function pickRunner(effect: Effect<unknown, unknown, unknown>): Node {
  return (effect as unknown as { graphite: Node }).graphite.scope.runner as Node
}
