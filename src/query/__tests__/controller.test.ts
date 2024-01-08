import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { createRemoteOperation } from "../../remote_operation"
import { QueryMeta, createQueryController } from "../controller"

describe("createQueryController", () => {
  const handler = vi.fn().mockResolvedValue({ data: "result" })
  const operation = createRemoteOperation<unknown, unknown, QueryMeta>({ handler })

  const controller = createQueryController({ operation })

  beforeEach(() => {
    handler.mockClear()
  })

  it("refresh soft starts request", async () => {
    expect.assertions(1)

    const scope = fork({
      handlers: [[operation.__.executeFx, handler]],
    })

    await allSettled(controller.refresh, { scope, params: {} })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ meta: { force: false } }))
  })

  it("start force starts request", async () => {
    expect.assertions(1)

    const scope = fork({
      handlers: [[operation.__.executeFx, handler]],
    })

    await allSettled(controller.start, { scope, params: {} })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ meta: { force: true } }))
  })
})
