import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, createStore, createWatch, fork } from "effector"

import {
  ApolloClient,
  ApolloError,
  InMemoryCache,
  type TypedDocumentNode,
  gql,
} from "@apollo/client"
import { MockLink, type MockedResponse } from "@apollo/client/testing"

import { createQuery } from "../query"

describe("createQuery", () => {
  const document: TypedDocumentNode<unknown, Record<string, never>> = gql`
    query test {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })
  const query = createQuery({ client, document })

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

      request.mockResolvedValue({ value: "test" })

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "test" })
    })

    it("resets on failure", async () => {
      expect.assertions(1)

      request.mockResolvedValueOnce({ value: "test" }).mockRejectedValue(new ApolloError({}))

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope }) // Success
      await allSettled(query.start, { scope }) // Failure

      expect(scope.getState(query.$data)).toBeNull()
    })
  })

  describe("$error", () => {
    it("resets on success", async () => {
      expect.assertions(1)

      request.mockRejectedValueOnce(new ApolloError({})).mockResolvedValueOnce({ value: "test" })

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope }) // Failure
      await allSettled(query.start, { scope }) // Success

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
    it("executes executeFx", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, { key: "value" }>({ client, document })
      request.mockResolvedValue({ value: "test" })

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

  describe("reset", () => {
    it("resets $data after success", async () => {
      expect.assertions(1)

      request.mockResolvedValue({ value: "test" })

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })
      await allSettled(query.reset, { scope })

      const data = scope.getState(query.$data)
      expect(data).toBeNull()
    })

    it("resets $error after failure", async () => {
      expect.assertions(1)

      request.mockRejectedValue(new ApolloError({}))

      const scope = fork({
        handlers: [[query.__.executeFx, request]],
      })

      await allSettled(query.start, { scope })
      await allSettled(query.reset, { scope })

      const error = scope.getState(query.$error)
      expect(error).toBeNull()
    })
  })

  describe("context", () => {
    const mock: MockedResponse = {
      request: { query: document },
      result: { data: { value: "test" } },
      maxUsageCount: Infinity,
    }

    const link = new MockLink([mock])

    beforeEach(() => {
      client.setLink(link)
    })

    it("passes static context", async () => {
      expect.assertions(1)

      const query = createQuery({ client, document, context: { key: "value" } })

      const scope = fork()

      await allSettled(query.start, { scope })

      const context = link.operation.getContext()
      expect(context).toStrictEqual(expect.objectContaining({ key: "value" }))
    })

    it("passes dynamic context", async () => {
      expect.assertions(1)

      const $context = createStore({ key: "dynamic" })
      const query = createQuery({ client, document, context: $context })

      const scope = fork()

      await allSettled(query.start, { scope })

      const context = link.operation.getContext()
      expect(context).toStrictEqual(expect.objectContaining({ key: "dynamic" }))
    })
  })

  describe("when running query", () => {
    describe("on success", () => {
      it("fires finished:done", async () => {
        expect.assertions(1)

        request.mockResolvedValue("test")

        const fn = vi.fn()

        const scope = fork({
          handlers: [[query.__.executeFx, request]],
        })

        createWatch({ unit: query.finished.finally, fn, scope })

        await allSettled(query.start, { scope })

        expect(fn).toHaveBeenCalledWith({
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

        const fn = vi.fn()

        const scope = fork({
          handlers: [[query.__.executeFx, request]],
        })

        createWatch({ unit: query.finished.finally, fn, scope })

        await allSettled(query.start, { scope })

        expect(fn).toHaveBeenCalledWith({
          status: "fail",
          meta: { force: true },
          variables: {},
          error,
        })
      })
    })

    it("uses the client from store", async () => {
      expect.assertions(1)

      const fn = vi.fn(() => ({ data: { value: "test" } }))
      const mock = { request: { query: document }, result: fn }

      const link = new MockLink([mock])

      const $client = createStore<ApolloClient<unknown>>(null as never)
      const query = createQuery({ client: $client, document })

      const scope = fork({
        values: [[$client, new ApolloClient({ link, cache })]],
      })

      await allSettled(query.start, { scope })

      expect(fn).toHaveBeenCalledOnce()
    })
  })
})
