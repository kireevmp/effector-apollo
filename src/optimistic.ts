import { attach, sample } from "effector"

import { type ApolloClient, type DocumentNode } from "@apollo/client"
import { Kind, OperationTypeNode } from "graphql"

import { type Mutation } from "./mutation"

interface OptimisticOptions<Data, Variables> {
  client?: ApolloClient<unknown>

  fn: (variables: Variables) => Data
}

export function optimistic<Data, Variables>(
  mutation: Mutation<Data, Variables>,
  { client: { cache } = mutation.meta.client, fn }: OptimisticOptions<Data, Variables>,
) {
  const query = asQuery(mutation.__.document)

  const updateFx = attach({
    source: { variables: mutation.__.$variables },
    name: `${mutation.meta.name}.optimistic`,
    effect({ variables }, req: Promise<Data>) {
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
