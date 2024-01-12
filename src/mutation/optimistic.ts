import { Store, attach, sample } from "effector"

import { type ApolloClient, type DocumentNode } from "@apollo/client"
import { Kind, OperationTypeNode } from "graphql"

import { storify } from "../lib/storify"

import { type Mutation } from "./mutation"

interface OptimisticOptions<Data, Variables> {
  client?: ApolloClient<unknown> | Store<ApolloClient<unknown>>

  fn: (variables: Variables) => Data
}

export function optimistic<Data, Variables>(
  mutation: Mutation<Data, Variables>,
  { client = mutation.meta.client, fn }: OptimisticOptions<Data, Variables>,
) {
  const name = `${mutation.meta.name}.optimistic`
  const query = asQuery(mutation.meta.document)

  const $client = storify(client, { name: `${name}.client`, sid: `apollo.${name}.$client` })

  const updateFx = attach({
    source: { client: $client, variables: mutation.__.$variables },
    name: `${mutation.meta.name}.optimistic`,
    effect({ variables, client: { cache } }, req: Promise<Data>) {
      const id = nextID()

      cache.recordOptimisticTransaction(
        () => cache.writeQuery({ data: fn(variables), query, variables }),
        id,
      )

      return req.finally(() => cache.removeOptimistic(id))
    },
  })

  sample({ clock: mutation.__.called, target: updateFx })
}

function asQuery(document: DocumentNode): DocumentNode {
  return {
    kind: Kind.DOCUMENT,
    definitions: document.definitions.map((node) =>
      node.kind === Kind.OPERATION_DEFINITION && node.operation !== OperationTypeNode.QUERY
        ? { ...node, operation: OperationTypeNode.QUERY }
        : node,
    ),
  }
}

// Apollo uses just a number under the hood
// We add `effector` in front to prevent collisions
let optimisticID = 0
const nextID = () => `effector:${++optimisticID}`
