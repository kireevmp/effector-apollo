import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, InMemoryCache, gql } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createMutation } from "../mutation"

describe("createMutation", () => {
  const document = gql`
    mutation test {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })
  const mutation = createMutation<unknown, Record<string, never>>({ client, document })

  beforeEach(async () => {
    client.setLink(link)
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
})
