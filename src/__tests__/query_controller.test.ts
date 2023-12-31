import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { createQueryController } from "../query_controller"
import { createRemoteOperation } from "../remote_operation"

describe("createQueryController", () => {
  const handler = vi.fn().mockResolvedValue({ data: "result" })
  const operation = createRemoteOperation({ handler })

  const controller = createQueryController({ operation })

  beforeEach(() => {
    handler.mockClear()
  })

  describe("when stale", () => {
    it("refresh starts request", async () => {
      expect.assertions(1)

      const scope = fork({
        values: [
          [controller.$stale, true],
          [operation.__.$variables, { key: "value" }],
        ],
        handlers: [[operation.__.executeFx, handler]],
      })

      await allSettled(controller.refresh, { scope, params: { key: "value" } })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("request completion makes query fresh", async () => {
      expect.assertions(1)

      const scope = fork({
        values: [[controller.$stale, true]],
        handlers: [[operation.__.executeFx, handler]],
      })

      await allSettled(controller.start, { scope, params: { key: "value" } })

      const stale = scope.getState(controller.$stale)
      expect(stale).toBe(false)
    })
  })

  describe("when fresh", () => {
    describe("with same variables", () => {
      it("refresh skips request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "value" }],
          ],
          handlers: [[operation.__.executeFx, handler]],
        })

        await allSettled(controller.refresh, { scope, params: { key: "value" } })

        expect(handler).not.toHaveBeenCalled()
      })

      it("start runs request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "value" }],
          ],
          handlers: [[operation.__.executeFx, handler]],
        })

        await allSettled(controller.start, { scope, params: { key: "value" } })

        expect(handler).toHaveBeenCalledTimes(1)
      })
    })

    describe("with different variables", () => {
      it("refresh runs request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "old" }],
          ],
          handlers: [[operation.__.executeFx, handler]],
        })

        await allSettled(controller.refresh, { scope, params: { key: "new" } })

        expect(handler).toHaveBeenCalledTimes(1)
      })
    })
  })
})
