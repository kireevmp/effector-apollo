import { beforeEach, describe, expect, it } from "vitest"

import { allSettled, createEvent, fork } from "effector"

import { gql, InMemoryCache, ApolloClient } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

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
    watchQuery(query, { client })

    const scope = fork()

    await allSettled(query.start, { scope })

    cache.writeQuery({ query: document, data: { value: "new" } })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual({ value: "new" })
  })

  it("unsubscribes on teardown", async () => {
    expect.assertions(1)

    const setup = createEvent()
    const teardown = createEvent()

    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query, { client, setup, teardown })

    const scope = fork()

    await allSettled(setup, { scope })
    cache.writeQuery({ query: document, data: { value: "before" } })

    await allSettled(teardown, { scope })
    cache.writeQuery({ query: document, data: { value: "after" } })

    const data = scope.getState(query.$data)
    expect(data).toStrictEqual({ value: "before" })
  })

  describe("when immediately reading", () => {
    const appStarted = createEvent<void>()

    it("populates data on subscribe", async () => {
      expect.assertions(1)

      cache.writeQuery({ query: document, data: { value: "current" }, overwrite: true })

      const query = createQuery<unknown, Record<string, never>>({ client, document })
      watchQuery(query, { client, setup: appStarted })

      const scope = fork()
      await allSettled(appStarted, { scope })

      const data = scope.getState(query.$data)
      expect(data).toStrictEqual({ value: "current" })
    })
  })

  describe("when allowing optimistic", () => {
    const query = createQuery<unknown, Record<string, never>>({ client, document })
    watchQuery(query, { client })

    it("makes query stale on update", async () => {
      expect.assertions(1)

      const scope = fork()

      await allSettled(query.start, { scope })

      cache.recordOptimisticTransaction(
        (c) => c.writeQuery({ query: document, data: { value: "optimistic" } }),
        "test-id",
      )

      const data = scope.getState(query.$stale)
      expect(data).toBe(true)
    })

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
    watchQuery(query, { client, optimistic: false })

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
})
