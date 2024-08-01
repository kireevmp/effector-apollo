import { describe, expectTypeOf, it } from "vitest"

import type { Event, EventCallable, Store } from "effector"

import { ApolloClient, InMemoryCache, type TypedDocumentNode, gql } from "@apollo/client"

import { createQuery } from "../query"

describe("createQuery", () => {
  describe("when using TypedDocumentNode", () => {
    const document: TypedDocumentNode<{ result: "data" }, { var: "value" }> = gql``
    const client = new ApolloClient({ cache: new InMemoryCache() })

    const query = createQuery({ client, document })

    it("infers Data from document", () => {
      expectTypeOf(query.$data).toEqualTypeOf<Store<{ result: "data" } | null>>()
      expectTypeOf(query.finished.success).toMatchTypeOf<Event<{ data: { result: "data" } }>>()
    })

    it("infers Variables from document", () => {
      expectTypeOf(query.start).toEqualTypeOf<EventCallable<{ var: "value" }>>()
      expectTypeOf(query.refresh).toEqualTypeOf<EventCallable<{ var: "value" }>>()
    })
  })
})
