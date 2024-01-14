import { describe, expectTypeOf, it } from "vitest"

import { createEvent, createStore } from "effector"

import { ApolloClient, InMemoryCache, TypedDocumentNode, gql } from "@apollo/client"

import { FragmentBinding, createFragmentBinding } from "../binding"

describe("createFragmentBinding", () => {
  const client = new ApolloClient({ cache: new InMemoryCache() })
  const document: TypedDocumentNode<{ key: "value" }, { variable: string }> = gql``

  it("accepts arbitrary event as setup", () => {
    const setup = createEvent<"arbitrary" | "thing">()

    const binding = createFragmentBinding({ client, document, id: createStore("ID"), setup })

    expectTypeOf(binding).toMatchTypeOf<FragmentBinding<any, any>>()
  })

  it("accepts arbitrary event as teardown", () => {
    const teardown = createEvent<"arbitrary" | "thing">()

    const binding = createFragmentBinding({
      client,
      document,
      id: createStore("ID"),
      setup: createEvent(),
      teardown,
    })

    expectTypeOf(binding).toMatchTypeOf<FragmentBinding<any, any>>()
  })
})
