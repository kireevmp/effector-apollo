import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, createWatch, fork } from "effector"

import { ApolloError } from "@apollo/client"

import { createRemoteOperation } from "../remote_operation"

describe("createRemoteOperation", () => {
  const handler = vi.fn()

  const operation = createRemoteOperation({ handler })

  beforeEach(() => {
    handler.mockReset()
  })

  describe("executeFx", () => {
    it("returns data from handler", async () => {
      expect.assertions(1)

      const watcher = vi.fn()

      const data = "test"
      handler.mockResolvedValue(data)

      const scope = fork()

      createWatch({ unit: operation.finished.finally, fn: watcher, scope })

      await allSettled(operation.__.execute, {
        scope,
        params: { variables: {}, meta: "meta" },
      })

      expect(watcher).toHaveBeenCalledWith({ status: "done", variables: {}, meta: "meta", data })
    })

    it("handles error in handler", async () => {
      expect.assertions(1)

      const watcher = vi.fn()

      const error = new ApolloError({})
      handler.mockRejectedValue(error)

      const scope = fork()

      createWatch({ unit: operation.finished.finally, fn: watcher, scope })

      await allSettled(operation.__.execute, {
        scope,
        params: { variables: {}, meta: "meta" },
      })

      expect(watcher).toHaveBeenCalledWith({ status: "fail", variables: {}, meta: "meta", error })
    })
  })

  describe("execute", () => {
    it("stores latest variables", async () => {
      expect.assertions(1)

      const scope = fork()

      await allSettled(operation.__.execute, {
        scope,
        params: { variables: { some: "value" }, meta: "meta" },
      })

      const variables = scope.getState(operation.__.$variables)
      expect(variables).toStrictEqual({ some: "value" })
    })
  })
})
