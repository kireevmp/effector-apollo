import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, ApolloError, InMemoryCache, gql } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createQuery } from "../query"

describe("createQuery", () => {
  const document = gql`
    query {
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

  describe("$data", () => {
    it("is populated on success", async () => {
      expect.assertions(1)

      request.mockResolvedValue({ data: "test" })

      const scope = fork({
        handlers: [[query.__.queryFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$data)).toBe("test")
    })

    it("is reset on failure", async () => {
      expect.assertions(1)

      request.mockRejectedValue(new ApolloError({}))

      const scope = fork({
        values: [[query.$data, "initial"]],
        handlers: [[query.__.queryFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$data)).toBeNull()
    })
  })

  describe("$error", () => {
    it("is reset on success", async () => {
      expect.assertions(1)

      request.mockResolvedValue({ data: "test" })

      const scope = fork({
        values: [[query.$error, new ApolloError({})]],
        handlers: [[query.__.queryFx, request]],
      })

      await allSettled(query.start, { scope })

      expect(scope.getState(query.$error)).toBeNull()
    })

    it("is reset on failure", async () => {
      expect.assertions(1)

      const error = new ApolloError({})
      request.mockRejectedValue(error)

      const scope = fork({
        handlers: [[query.__.queryFx, request]],
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
        handlers: [[query.__.queryFx, request]],
      })

      await allSettled(query.start, { scope, params: { key: "value" } })

      expect(request).toHaveBeenCalledWith({ key: "value" })
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

        request.mockResolvedValue({ data: "test" })

        const scope = fork({
          handlers: [[query.__.queryFx, request]],
        })

        await allSettled(query.start, { scope })

        expect(watcher).toHaveBeenCalledWith({ status: "done", data: "test", variables: {} })
      })
    })

    describe("on failure", () => {
      it("fires finished:fail", async () => {
        expect.assertions(1)

        const error = new ApolloError({})
        request.mockRejectedValue(error)

        const scope = fork({
          handlers: [[query.__.queryFx, request]],
        })

        await allSettled(query.start, { scope })

        expect(watcher).toHaveBeenCalledWith({ status: "fail", error, variables: {} })
      })
    })
  })
})
