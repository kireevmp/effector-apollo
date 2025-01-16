import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, createStore, fork } from "effector"

import { ApolloClient, InMemoryCache, type TypedDocumentNode, gql } from "@apollo/client"
import { MockLink, type MockedResponse } from "@apollo/client/testing"

import { createMutation } from "../mutation"

describe("createMutation", () => {
  const document: TypedDocumentNode<unknown, Record<string, never>> = gql`
    mutation test {
      value
    }
  `

  const cache = new InMemoryCache()

  const client = new ApolloClient({ cache, link: new MockLink([]) })
  const mutation = createMutation({ client, document })

  beforeEach(async () => {
    client.setLink(new MockLink([]))
    await cache.reset({ discardWatches: true })
  })

  it("correctly derives name from operation", () => {
    expect(mutation.meta.name).toBe("test")
  })

  it("executes the request", async () => {
    expect.assertions(1)

    const request = vi.fn()

    const scope = fork({
      handlers: [[mutation.__.executeFx, request]],
    })

    await allSettled(mutation.start, { scope })

    expect(request).toHaveBeenCalledWith({ variables: {} })
  })

  it("runs the mutation against Apollo", async () => {
    expect.assertions(1)

    const watcher = vi.fn()
    const unsub = mutation.finished.finally.watch(watcher)

    client.setLink(
      new MockLink([{ request: { query: document }, result: { data: { value: "test" } } }]),
    )

    const scope = fork()

    await allSettled(mutation.start, { scope })

    expect(watcher).toHaveBeenCalledWith({ status: "done", variables: {}, data: { value: "test" } })

    unsub()
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

      const mutation = createMutation({ client, document, context: { key: "value" } })

      const scope = fork()

      await allSettled(mutation.start, { scope })

      const context = link.operation.getContext()
      expect(context).toStrictEqual(expect.objectContaining({ key: "value" }))
    })

    it("passes dynamic context", async () => {
      expect.assertions(1)

      const $context = createStore({ key: "dynamic" })
      const mutation = createMutation({ client, document, context: $context })

      const scope = fork()

      await allSettled(mutation.start, { scope })

      const context = link.operation.getContext()
      expect(context).toStrictEqual(expect.objectContaining({ key: "dynamic" }))
    })
  })

  it("uses the client from store", async () => {
    expect.assertions(1)

    const fn = vi.fn(() => ({ data: { value: "test" } }))
    const mock = { request: { query: document }, result: fn }

    const link = new MockLink([mock])

    const $client = createStore<ApolloClient<unknown>>(null as never)
    const mutation = createMutation({ client: $client, document })

    const scope = fork({
      values: [[$client, new ApolloClient({ link, cache })]],
    })

    await allSettled(mutation.start, { scope })

    expect(fn).toHaveBeenCalledOnce()
  })
})
