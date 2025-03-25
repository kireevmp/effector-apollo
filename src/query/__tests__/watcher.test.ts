import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, createStore, fork } from "effector"

import { ApolloClient, InMemoryCache, gql } from "@apollo/client"
import { MockLink, type MockedResponse } from "@apollo/client/testing"

import { createQuery } from "../query"
import { watchQuery } from "../watcher"

describe("watchQuery", () => {
  const document = gql`
    query {
      value
    }
  `

  const mock = { request: { query: document }, result: { data: { value: "old" } } }
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

    cache.writeQuery({ query: document, data: { value: "new" }, broadcast: true })

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
      expect(data).toStrictEqual({ value: "old" })
    })
  })

  it("supports watching other client", async () => {
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

  it("stops watching for cache when query is reset", async () => {
    expect.assertions(1)

    const query = createQuery<unknown, Record<string, never>>({ client, document })

    watchQuery(query)

    const scope = fork()

    await allSettled(query.start, { scope })
    await allSettled(query.reset, { scope })

    cache.writeQuery({ query: document, data: { value: "new" }, broadcast: true })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual(null)
  })

  describe("when changing variables", () => {
    const document = gql`
      query test($id: String) {
        value(id: $id)
      }
    `

    const initial = {
      request: { query: document, variables: { id: "initial" } },
      result: vi.fn(() => ({ data: { value: "initial" } })),
    } satisfies MockedResponse

    const updated = {
      request: { query: document, variables: { id: "updated" } },
      result: vi.fn(() => ({ data: { value: "old" } })),
    } satisfies MockedResponse

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("resubscribes to new variables", async () => {
      expect.assertions(1)

      client.setLink(new MockLink([initial, updated]))

      const query = createQuery<unknown, { id: string }>({ client, document })
      watchQuery(query)

      const scope = fork()

      await allSettled(query.refresh, { scope, params: { id: "initial" } })
      await allSettled(query.refresh, { scope, params: { id: "updated" } })

      cache.writeQuery({ query: document, variables: { id: "updated" }, data: { value: "new" } })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "new" })
    })

    it("keeps data empty when enabling watch & missing variables", async () => {
      expect.assertions(1)

      client.setLink(new MockLink([initial]))

      const $enabled = createStore<boolean>(false)
      const query = createQuery<unknown, { id: string }>({ client, document })

      watchQuery(query)

      const scope = fork()

      await allSettled($enabled, { scope, params: true })

      cache.writeQuery({ query: document, variables: { id: "initial" }, data: { value: "new" } })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual(null)
    })
  })

  describe("with explicit subscription control", () => {
    const $enabled = createStore<boolean>(false)

    it("does not start watching when disabled", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, Record<string, never>>({ client, document })

      watchQuery(query, { enabled: $enabled })

      const scope = fork()

      await allSettled(query.start, { scope })

      cache.writeQuery({ query: document, data: { value: "new" } })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "old" })
    })

    it("can start watching without start", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, Record<string, never>>({ client, document })

      watchQuery(query, { enabled: $enabled })

      const scope = fork()

      await allSettled($enabled, { scope, params: true })

      cache.writeQuery({ query: document, data: { value: "new" } })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "new" })
    })

    it("stops watching when disabled", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, Record<string, never>>({ client, document })

      watchQuery(query, { enabled: $enabled })

      const scope = fork({
        values: [[$enabled, true]],
      })

      await allSettled(query.start, { scope })

      await allSettled($enabled, { scope, params: false })

      cache.writeQuery({ query: document, data: { value: "new" } })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "old" })
    })
  })

  describe("with masking", () => {
    const document = gql`
      query {
        entity {
          id
          top
          ...data
        }
      }

      fragment data on Entity {
        value
      }
    `

    const initial = { __typename: "Entity", id: 1, value: "initial", top: "initial" }
    const mock = { request: { query: document }, result: { data: { entity: initial } } }

    const client = new ApolloClient({ link: link, dataMasking: true, cache })

    beforeEach(async () => {
      client.setLink(new MockLink([mock]))

      await client.cache.reset({ discardWatches: true })
    })

    it("updates query with correctly masked data", async () => {
      expect.assertions(1)

      const query = createQuery<unknown, Record<string, never>>({ client: client, document })
      watchQuery(query)

      const scope = fork()
      await allSettled(query.start, { scope })

      const current = { __typename: "Entity", id: 1, value: "updated", top: "updated" }
      cache.writeQuery({ query: document, data: { entity: current } })

      const data = scope.getState(query.$data)
      expect(data).toHaveProperty("entity", { __typename: "Entity", id: 1, top: "updated" }) // no value
    })

    describe("with explicit unmask directive", () => {
      it("updates query with unmasked data", async () => {
        expect.assertions(1)

        const document = gql`
          query {
            entity {
              id
              top
              ...data @unmask
            }
          }

          fragment data on Entity {
            value
          }
        `

        const query = createQuery<unknown, Record<string, never>>({ client, document })
        watchQuery(query)

        const scope = fork()
        await allSettled(query.start, { scope })

        const current = { __typename: "Entity", id: 1, value: "updated", top: "updated" }
        cache.writeQuery({ query: document, data: { entity: current } })

        const data = scope.getState(query.$data)
        expect(data).toHaveProperty("entity", current)
      })
    })
  })
})
