import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, InMemoryCache, gql } from "@apollo/client"
import { MockLink, MockedResponse } from "@apollo/client/testing"

import { createQuery } from "../query"
import { watchQuery } from "../query_watcher"

describe("watchQuery", () => {
  const document = gql`
    query {
      value
    }
  `

  const mock = { request: { query: document }, result: { data: { value: "value" } } }
  const link = new MockLink([mock])

  const cache = new InMemoryCache()
  const client = new ApolloClient({ link, cache })

  beforeEach(async () => {
    client.setLink(new MockLink([mock]))

    await cache.reset({ discardWatches: true })
  })

  it("updates query on cache update", async () => {
    expect.assertions(1)

    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query)

    const scope = fork()

    await allSettled(query.start, { scope })

    cache.writeQuery({ query: document, data: { value: "new" } })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual({ value: "new" })
  })

  describe("when allowing optimistic", () => {
    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query)

    it("stores optimistic data in store", async () => {
      expect.assertions(1)

      const scope = fork()

      await allSettled(query.start, { scope })

      cache.recordOptimisticTransaction(
        (c) => c.writeQuery({ query: document, data: { value: "optimistic" } }),
        "test-id",
      )

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "optimistic" })
    })
  })

  describe("when skipping optimistic", () => {
    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query, { optimistic: false })

    it("ignores optimistic data", async () => {
      expect.assertions(1)

      const scope = fork()

      await allSettled(query.start, { scope })

      cache.recordOptimisticTransaction(
        (c) => c.writeQuery({ query: document, data: { value: "optimistic" } }),
        "test-id",
      )

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "value" })
    })
  })

  it("suppots watching other client", async () => {
    expect.assertions(1)

    const otherCache = new InMemoryCache()
    const otherClient = new ApolloClient({ link, cache: otherCache, name: "other" })

    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query, { client: otherClient })

    const scope = fork()

    await allSettled(query.start, { scope })

    otherCache.writeQuery({ query: document, data: { value: "new" } })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual({ value: "new" })
  })

  it("refreshes the query when new data is received", async () => {
    expect.assertions(1)

    const one = { request: { query: document }, result: { data: { value: "old" } } }
    const two = { request: { query: document }, result: { data: { value: "new" } } }

    client.setLink(new MockLink([one, two]))

    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query)

    const scope = fork()
    await allSettled(query.start, { scope })

    await client.query({ query: document, fetchPolicy: "network-only" })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual({ value: "new" })
  })

  describe("when changing variables", () => {
    const document = gql`
      query test($id: String) {
        value(id: $id)
      }
    `

    const one = {
      request: { query: document, variables: { id: "one" } },
      result: vi.fn(() => ({ data: { value: "first" } })),
    } satisfies MockedResponse

    const two = {
      request: { query: document, variables: { id: "two" } },
      result: vi.fn(() => ({ data: { value: "second" } })),
    } satisfies MockedResponse

    beforeEach(() => {
      one.result.mockClear()
      two.result.mockClear()
    })

    it("makes no request when data is available in cache", async () => {
      expect.assertions(1)

      client.setLink(new MockLink([one]))

      const query = createQuery<unknown, { id: string }>({ client, document })
      watchQuery(query)

      const scope = fork()

      cache.writeQuery({ query: document, variables: { id: "one" }, data: { value: "first" } })
      await allSettled(query.refresh, { scope, params: { id: "one" } })

      expect(one.result).not.toHaveBeenCalled()
    })

    it("makes a single when variables changes back", async () => {
      expect.assertions(2)

      client.setLink(new MockLink([one, two]))

      const query = createQuery<unknown, { id: string }>({ client, document })
      watchQuery(query)

      const scope = fork()

      await allSettled(query.refresh, { scope, params: { id: "one" } })
      await allSettled(query.refresh, { scope, params: { id: "two" } })
      await allSettled(query.refresh, { scope, params: { id: "one" } })

      expect(one.result).toHaveBeenCalledOnce()
      expect(two.result).toHaveBeenCalledOnce()
    })
  })
})
