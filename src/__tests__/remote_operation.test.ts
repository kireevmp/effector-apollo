import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, ApolloError, InMemoryCache, gql } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createRemoteOperation } from "../remote_operation"

describe("createRemoteOperation", () => {
  const document = gql`
    query {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })
  const operation = createRemoteOperation({ client, document })

  beforeEach(async () => {
    await cache.reset()
    client.setLink(link)
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

    it("returns data from Apollo", async () => {
      expect.assertions(1)

      const data = { value: "value" }
      const link = new MockLink([{ request: { query: document }, result: { data } }])

      client.setLink(link)
      const scope = fork()

      await allSettled(operation.execute, { scope, params: {} })

      expect(watcher).toHaveBeenCalledWith({ status: "done", variables: {}, data })
    })

    it("handles error from Apollo", async () => {
      expect.assertions(1)

      const error = new ApolloError({})

      const link = new MockLink([{ request: { query: document }, error }])

      client.setLink(link)
      const scope = fork()

      await allSettled(operation.execute, { scope, params: {} })

      expect(watcher).toHaveBeenCalledWith({ status: "fail", variables: {}, error })
    })

    it("saves data to cache", async () => {
      expect.assertions(1)

      const data = { value: "value" }
      const link = new MockLink([{ request: { query: document }, result: { data } }])

      client.setLink(link)
      const scope = fork()

      await allSettled(operation.execute, { scope, params: {} })

      const state = cache.readQuery({ query: document })
      expect(state).toStrictEqual(data)
    })
  })
})
