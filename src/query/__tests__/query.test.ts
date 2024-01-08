import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, ApolloError, InMemoryCache, gql } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createQuery } from "../query"

describe("createQuery", () => {
  const document = gql`
    query test {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })
  const query = createQuery<unknown, Record<string, never>>({ client, document })

  const request = vi.fn()

  beforeEach(() => {
    request.mockReset()
  })

  it("correctly derives name from operation", () => {
    expect(query.meta.name).toBe("test")
  })

  describe("$data", () => {
    it("populates on success", async () => {
      expect.assertions(1)

      request.mockResolvedValue("test")

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })

      const data = scope.getState(query.$data)
      expect(data).toBe("test")
    })

    it("resets on failure", async () => {
      expect.assertions(1)

      request.mockRejectedValue(new ApolloError({}))

      const scope = fork({
        values: [[query.$data, "initial"]],
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$data)).toBeNull()
    })
  })

  describe("$error", () => {
    it("resets on success", async () => {
      expect.assertions(1)

      request.mockResolvedValue({ data: "test" })

      const scope = fork({
        values: [[query.$error, new ApolloError({})]],
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$error)).toBeNull()
    })

    it("populates on failure", async () => {
      expect.assertions(1)

      const error = new ApolloError({})
      request.mockRejectedValue(error)

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$error)).toBe(error)
    })
  })

  describe("start", () => {
    it("executes queryFx", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, { key: "value" }>({ client, document })
      request.mockResolvedValue({ data: "test" })

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope, params: { key: "value" } })

      expect(request).toHaveBeenCalledWith({ variables: { key: "value" }, meta: { force: true } })
    })

    it("forces a request", async () => {
      expect.assertions(1)

      client.setLink(new MockLink([{ request: { query: document }, result: request }]))
      request.mockReturnValue({ data: { value: "value" } })

      const query = createQuery<unknown, Record<string, never>>({ client, document })

      const scope = fork()

      await allSettled(query.start, { scope })

      expect(request).toHaveBeenCalledOnce()
    })
  })

  describe("refresh", () => {
    it("reads from cache", async () => {
      expect.assertions(1)

      client.cache.writeQuery({ query: document, data: { value: "test" } })
      const query = createQuery<unknown, Record<string, never>>({ client, document })

      const scope = fork()

      await allSettled(query.refresh, { scope })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "test" })
    })
  })

  describe("when running query", () => {
    const watcher = vi.fn()
    let unsub: () => void

    beforeEach(() => {
      unsub = query.finished.finally.watch(watcher)
    })

    afterEach(() => {
      watcher.mockClear()
      unsub()
    })

    describe("on success", () => {
      it("fires finished:done", async () => {
        expect.assertions(1)

        request.mockResolvedValue("test")

        const scope = fork({
          handlers: [[query.__.executeFx, request]],
        })

        await allSettled(query.start, { scope })

        expect(watcher).toHaveBeenCalledWith({
          status: "done",
          meta: { force: true },
          data: "test",
          variables: {},
        })
      })
    })

    describe("on failure", () => {
      it("fires finished:fail", async () => {
        expect.assertions(1)

        const error = new ApolloError({})
        request.mockRejectedValue(error)

        const scope = fork({
          handlers: [[query.__.executeFx, request]],
        })

        await allSettled(query.start, { scope })

        expect(watcher).toHaveBeenCalledWith({
          status: "fail",
          meta: { force: true },
          variables: {},
          error,
        })
      })
    })
  })
})
