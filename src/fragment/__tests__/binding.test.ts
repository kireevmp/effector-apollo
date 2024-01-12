import { beforeEach, describe, expect, it } from "vitest"

import { allSettled, createEvent, createStore, fork } from "effector"

import { ApolloClient, InMemoryCache, gql } from "@apollo/client"

import { createFragmentBinding } from "../binding"

describe("createFragmentBinding", () => {
  const document = gql`
    fragment user on User {
      id
      name
    }
  `

  const cache = new InMemoryCache({ addTypename: false })
  const client = new ApolloClient({ cache })

  const setup = createEvent<void>()

  beforeEach(async () => {
    await cache.reset({ discardWatches: true })
  })

  it("infers name from fragment", () => {
    expect.assertions(1)

    const $id = createStore("User:1")
    const binding = createFragmentBinding({ client, document, setup, id: $id })

    expect(binding.meta.name).toBe("user")
  })

  it("watches changes", async () => {
    expect.assertions(1)

    const $id = createStore("User:1")

    const binding = createFragmentBinding({ client, document, setup, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })

    cache.writeFragment({
      fragment: document,
      id: "User:1",
      data: { __typename: "User", id: "1", name: "test" },
    })

    const data = scope.getState(binding.$data)
    expect(data).toStrictEqual({ id: "1", name: "test" })
  })

  it("skips changes when torn down", async () => {
    expect.assertions(1)

    const $id = createStore("User:1")
    const teardown = createEvent<void>()

    const binding = createFragmentBinding({ client, document, setup, teardown, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })

    cache.writeFragment({
      fragment: document,
      id: "User:1",
      data: { __typename: "User", id: "1", name: "old" },
    })

    await allSettled(teardown, { scope })

    cache.writeFragment({
      fragment: document,
      id: "User:1",
      data: { __typename: "User", id: "1", name: "new" },
    })

    const data = scope.getState(binding.$data)
    expect(data).toBeNull()
  })

  it("becomes active on setup", async () => {
    expect.assertions(1)

    const $id = createStore("User:1")

    const binding = createFragmentBinding({ client, document, setup, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })

    const data = scope.getState(binding.$active)
    expect(data).toBe(true)
  })

  it("becomes inactive on teardown", async () => {
    expect.assertions(1)

    const $id = createStore("User:1")
    const teardown = createEvent<void>()

    const binding = createFragmentBinding({ client, document, setup, teardown, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })
    await allSettled(teardown, { scope })

    const data = scope.getState(binding.$active)
    expect(data).toBe(false)
  })

  it("reads data on subscribe", async () => {
    expect.assertions(1)

    cache.restore({ "User:1": { __typename: "User", id: "1", name: "test" } })

    const $id = createStore("User:1")

    const binding = createFragmentBinding({ client, document, setup, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })

    const data = scope.getState(binding.$data)
    expect(data).toStrictEqual({ id: "1", name: "test" })
  })

  describe("resubscribes when", () => {
    it("receives new variables", async () => {
      expect.assertions(1)

      const document = gql`
        fragment complexUser on User {
          id
          name(kind: $kind)
        }
      `

      cache.restore({
        "User:1": {
          "__typename": "User",
          "id": "1",
          'name({"kind":"first"})': "first",
          'name({"kind":"second"})': "second",
        },
      })

      const id = createStore("User:1")
      const variables = createStore({ kind: "first" })

      const binding = createFragmentBinding({ client, document, setup, id, variables })

      const scope = fork()

      await allSettled(setup, { scope })
      await allSettled(variables, { scope, params: { kind: "second" } })

      const data = scope.getState(binding.$data)
      expect(data).toStrictEqual({ id: "1", name: "second" })
    })

    it("receives new id", async () => {
      expect.assertions(1)

      cache.restore({
        "User:1": { __typename: "User", id: "1", name: "first" },
        "User:2": { __typename: "User", id: "2", name: "second" },
      })

      const $id = createStore("User:1")

      const binding = createFragmentBinding({ client, document, setup, id: $id })
      const scope = fork()

      await allSettled(setup, { scope })
      await allSettled($id, { scope, params: "User:2" })

      const data = scope.getState(binding.$data)
      expect(data).toStrictEqual({ id: "2", name: "second" })
    })

    it.todo("receives new client")
  })

  describe("supports identifying by key fields", () => {
    it("for default id", async () => {
      expect.assertions(1)

      const $id = createStore({ id: "1" })

      cache.restore({ "User:1": { __typename: "User", id: "1", name: "test" } })

      const binding = createFragmentBinding({ client, document, setup, id: $id })
      const scope = fork()

      await allSettled(setup, { scope })

      const data = scope.getState(binding.$data)
      expect(data).toStrictEqual({ id: "1", name: "test" })
    })

    describe("for custom cache field policy", () => {
      const typePolicies = { User: { keyFields: ["id", "name"] } }

      it("with inferred typename", async () => {
        expect.assertions(1)

        const cache = new InMemoryCache({ addTypename: false, typePolicies })
        const client = new ApolloClient({ cache })

        const user = { __typename: "User", id: "1", name: "test" }

        cache.restore({ [cache.identify(user)!]: user })

        const $id = createStore({ id: "1", name: "test" })
        const binding = createFragmentBinding({ client, document, setup, id: $id })

        const scope = fork()
        await allSettled(setup, { scope })

        const data = scope.getState(binding.$data)
        expect(data).toStrictEqual({ id: "1", name: "test" })
      })

      it.todo("with explicit typename")
    })
  })

  it("when optimistic is enabled reads optimistic data", async () => {
    expect.assertions(1)

    cache.restore({ "User:1": { __typename: "User", id: "1", name: "test" } })

    const $id = createStore("User:1")

    const binding = createFragmentBinding({ client, document, setup, id: $id })
    const scope = fork()

    await allSettled(setup, { scope })

    cache.recordOptimisticTransaction(
      (transaction) =>
        transaction.writeFragment({
          fragment: document,
          id: "User:1",
          data: { __typename: "User", id: "1", name: "optimistic" },
        }),
      "test-id",
    )

    const data = scope.getState(binding.$data)
    expect(data).toStrictEqual({ id: "1", name: "optimistic" })
  })

  it("when optimistic is disabled skips optimistic data", async () => {
    expect.assertions(1)

    cache.restore({ "User:1": { __typename: "User", id: "1", name: "test" } })

    const $id = createStore("User:1")

    const binding = createFragmentBinding({ client, document, setup, id: $id, optimistic: false })
    const scope = fork()

    await allSettled(setup, { scope })

    cache.recordOptimisticTransaction(
      (transaction) =>
        transaction.writeFragment({
          fragment: document,
          id: "User:1",
          data: { __typename: "User", id: "1", name: "optimistic" },
        }),
      "test-id",
    )

    const data = scope.getState(binding.$data)
    expect(data).toStrictEqual({ id: "1", name: "test" }) // Still "test"
  })
})
