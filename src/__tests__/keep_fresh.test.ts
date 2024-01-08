import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, createEvent, createStore, fork } from "effector"

import { gql, InMemoryCache, ApolloClient } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { TriggerProtocol, keepFresh } from "../keep_fresh"
import { createQuery } from "../query/query"

describe("keepFresh", () => {
  const document = gql`
    query {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })

  const $enabled = createStore(true)
  const trigger = createEvent<void>()

  const request = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("ignores idle query", async () => {
    expect.assertions(1)

    const query = createQuery<unknown, Record<string, never>>({ client, document })

    keepFresh(query, { enabled: $enabled, invalidateOn: [trigger] })

    const scope = fork({ handlers: [[query.__.executeFx, request]] })

    await allSettled(trigger, { scope })

    expect(request).not.toHaveBeenCalled()
  })

  it("refreshes query", async () => {
    expect.assertions(1)

    const query = createQuery<unknown, Record<string, never>>({ client, document })

    keepFresh(query, { enabled: $enabled, invalidateOn: [trigger] })

    const scope = fork({ handlers: [[query.__.executeFx, request]] })

    await allSettled(query.start, { scope })
    await allSettled(trigger, { scope })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it("fires on @@trigger", async () => {
    expect.assertions(1)

    const fired = createEvent<void>()

    const setup = createEvent<void>()
    const teardown = createEvent<void>()

    const proto: TriggerProtocol = { "@@trigger": () => ({ fired, setup, teardown }) }
    const query = createQuery<unknown, Record<string, never>>({ client, document })

    keepFresh(query, { enabled: $enabled, invalidateOn: [proto] })

    const scope = fork({ handlers: [[query.__.executeFx, request]] })

    await allSettled(query.start, { scope })

    await allSettled(fired, { scope })
    await allSettled(fired, { scope })
    await allSettled(fired, { scope })

    expect(request).toHaveBeenCalledTimes(4)
  })

  it("setups @@trigger correctly", async () => {
    expect.assertions(1)

    const on = vi.fn()

    const fired = createEvent<void>()

    const setup = createEvent<void>()
    const teardown = createEvent<void>()

    setup.watch(on)

    const proto: TriggerProtocol = { "@@trigger": () => ({ fired, setup, teardown }) }
    const query = createQuery<unknown, Record<string, never>>({ client, document })

    keepFresh(query, { enabled: $enabled, invalidateOn: [proto] })

    const scope = fork({ handlers: [[query.__.executeFx, request]] })

    await allSettled(query.start, { scope })

    expect(on).toHaveBeenCalledOnce()

    await allSettled($enabled, { scope, params: false })
  })

  it("tears down @@trigger correctly", async () => {
    expect.assertions(1)

    const off = vi.fn()

    const fired = createEvent<void>()

    const setup = createEvent<void>()
    const teardown = createEvent<void>()

    teardown.watch(off)

    const proto: TriggerProtocol = { "@@trigger": () => ({ fired, setup, teardown }) }
    const query = createQuery<unknown, Record<string, never>>({ client, document })

    keepFresh(query, { enabled: $enabled, invalidateOn: [proto] })

    const scope = fork({ handlers: [[query.__.executeFx, request]] })

    await allSettled(query.start, { scope })
    await allSettled($enabled, { scope, params: false })

    expect(off).toHaveBeenCalledOnce()
  })
})
