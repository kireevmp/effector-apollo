import { beforeEach, describe, expect, it } from "vitest"

import { allSettled, fork } from "effector"

import { gql, InMemoryCache, ApolloClient } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createMutation } from "../mutation"
import { optimistic } from "../optimistic"

describe("optimistic", () => {
  const document = gql`
    mutation {
      user {
        id
        name
      }
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })

  beforeEach(async () => {
    client.setLink(link)
    await cache.reset({ discardWatches: true })
  })

  it("saves data to optimistic cache", () => {
    const mutation = createMutation<unknown, Record<string, never>>({ client, document })

    optimistic(mutation, {
      fn: () => ({ user: { __typename: "User", id: "1", name: "opimistic" } }),
    })

    const scope = fork({
      handlers: [[mutation.__.executeFx, async () => null]],
    })

    void allSettled(mutation.start, { scope })

    const user = cache.readFragment({
      optimistic: true,
      id: "User:1",
      fragment: gql`
        fragment test on User {
          name
        }
      `,
    })

    expect(user).toStrictEqual({ __typename: "User", name: "opimistic" })
  })

  it("does not edit non-optimistic cache", () => {
    const mutation = createMutation<unknown, Record<string, never>>({ client, document })

    optimistic(mutation, {
      fn: () => ({ user: { __typename: "User", id: "1", name: "opimistic" } }),
    })

    const scope = fork({
      handlers: [[mutation.__.executeFx, async () => null]],
    })

    void allSettled(mutation.start, { scope })

    const user = cache.readFragment({
      optimistic: false,
      id: "User:1",
      fragment: gql`
        fragment test on User {
          name
        }
      `,
    })

    expect(user).toBeNull()
  })

  it("clears data on mutation finish", async () => {
    expect.assertions(1)

    const mutation = createMutation<unknown, Record<string, never>>({ client, document })

    optimistic(mutation, {
      fn: () => ({ user: { __typename: "User", id: "1", name: "opimistic" } }),
    })

    const scope = fork({
      handlers: [[mutation.__.executeFx, () => Promise.reject()]],
    })

    await allSettled(mutation.start, { scope })

    const user = cache.readFragment({
      optimistic: true,
      id: "User:1",
      fragment: gql`
        fragment test on User {
          name
        }
      `,
    })

    expect(user).toBeNull()
  })
})
