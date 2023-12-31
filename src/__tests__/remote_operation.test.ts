import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloError } from "@apollo/client"

import { createRemoteOperation } from "../remote_operation"

describe("createRemoteOperation", () => {
  const handler = vi.fn()

  const operation = createRemoteOperation({ handler })

  beforeEach(() => {
    handler.mockReset()
  })

  describe("queryFx", () => {
    const watcher = vi.fn()
    let unsub: () => void

    beforeEach(() => {
      unsub = operation.finished.finally.watch(watcher)
    })

    afterEach(() => {
      watcher.mockClear()
      unsub()
    })

    it("returns data from handler", async () => {
      expect.assertions(1)

      handler.mockResolvedValue("test")
      const scope = fork()

      await allSettled(operation.execute, { scope, params: {} })

      expect(watcher).toHaveBeenCalledWith({ status: "done", variables: {}, data: "test" })
    })

    it("handles error in handler", async () => {
      expect.assertions(1)

      const error = new ApolloError({})
      handler.mockRejectedValue(error)

      const scope = fork()

      await allSettled(operation.execute, { scope, params: {} })

      expect(watcher).toHaveBeenCalledWith({ status: "fail", variables: {}, error })
    })
  })
})
