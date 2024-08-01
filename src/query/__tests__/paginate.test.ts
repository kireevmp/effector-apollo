import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import {
  ApolloClient,
  InMemoryCache,
  type TypePolicies,
  type TypedDocumentNode,
  gql,
} from "@apollo/client"
import { MockLink, type MockedResponse } from "@apollo/client/testing"
import { concatPagination } from "@apollo/client/utilities"

import { paginate } from "../paginate"
import { createQuery } from "../query"

describe("paginate", () => {
  type Variables = { cursor?: string; filter?: string }
  type Data = { value: string[] }

  const document: TypedDocumentNode<Data, Variables> = gql`
    query test($cursor: String, $filter: String = "") {
      value(cursor: $cursor, filter: $filter)
    }
  `

  const typePolicies: TypePolicies = {
    Query: {
      fields: { value: concatPagination<string>(["filter"]) },
    },
  }

  const link = new MockLink([])
  const cache = new InMemoryCache({ typePolicies })

  const client = new ApolloClient({ link, cache })
  const query = createQuery({ client, document })

  const fetchMore = paginate(query)

  beforeEach(async () => {
    await client.resetStore()
  })

  it("fires a network-only request on pagination", async () => {
    expect.assertions(1)

    const request = vi.fn<[], Data>().mockResolvedValue({ value: ["first"] })

    const scope = fork({
      handlers: [[query.__.executeFx, request]],
    })

    await allSettled(query.refresh, { scope, params: {} })
    await allSettled(fetchMore, { scope, params: { cursor: "a" } })

    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ meta: { force: true } }))
  })

  it("merges variables for pagination", async () => {
    expect.assertions(1)

    const request = vi.fn<[], Data>().mockResolvedValue({ value: ["first"] })

    const scope = fork({
      handlers: [[query.__.executeFx, request]],
    })

    await allSettled(query.refresh, { scope, params: { filter: "left" } })
    await allSettled(fetchMore, { scope, params: { cursor: "a" } })

    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { filter: "left", cursor: "a" } }),
    )
  })

  it("stores merged data in Query", async () => {
    expect.assertions(1)

    const requests: MockedResponse<Data, Variables>[] = [
      {
        request: { query: document, variables: { filter: "" } },
        result: { data: { value: ["first"] } },
      },
      {
        request: { query: document, variables: { filter: "", cursor: "a" } },
        result: { data: { value: ["second"] } },
      },
    ]

    client.setLink(new MockLink(requests))

    const scope = fork()

    await allSettled(query.refresh, { scope, params: {} })
    await allSettled(fetchMore, { scope, params: { cursor: "a" } })

    const data = scope.getState(query.$data)
    expect(data).toHaveProperty("value", ["first", "second"])
  })

  it("respects key args", async () => {
    const requests: MockedResponse<Data, Variables>[] = [
      {
        request: { query: document, variables: { filter: "left" } },
        result: { data: { value: ["first"] } },
      },
      {
        request: { query: document, variables: { filter: "right", cursor: "a" } },
        result: { data: { value: ["second"] } },
      },
    ]

    client.setLink(new MockLink(requests))

    const scope = fork()

    await allSettled(query.refresh, { scope, params: { filter: "left" } })
    await allSettled(fetchMore, { scope, params: { filter: "right", cursor: "a" } })

    const data = scope.getState(query.$data)
    expect(data).toHaveProperty("value", ["second"])
  })
})
