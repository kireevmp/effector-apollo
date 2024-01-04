import { type EventCallable } from "effector"

import { type ApolloClient, type DocumentNode, type TypedDocumentNode } from "@apollo/client"

import { nameOf } from "./lib/name"
import { optional, type Optional } from "./lib/optional"
import {
  createRemoteOperation,
  type RemoteOperation,
  type RemoteOperationInternals,
} from "./remote_operation"

interface CreateMutationOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  name?: string
}

interface MutationInternals<Data, Variables> extends RemoteOperationInternals<Data, Variables> {
  document: TypedDocumentNode<Data, Variables>
}

export interface Mutation<Data, Variables> extends RemoteOperation<Data, Variables> {
  start: EventCallable<Optional<Variables>>

  meta: { name: string; client: ApolloClient<unknown> }

  /**
   * Internal tools
   */
  __: MutationInternals<Data, Variables>
}

export function createMutation<Data, Variables>({
  client,
  document,

  name = nameOf(document) ?? "unknown",
}: CreateMutationOptions<Data, Variables>) {
  const operation = createRemoteOperation<Data, Variables>({
    handler: (variables) =>
      client
        .mutate({ mutation: document, variables, fetchPolicy: "network-only" })
        .then(({ data }) => data),
    name,
  })

  return {
    ...operation,

    start: optional(operation.__.execute),

    meta: { name, client },
    __: { ...operation.__, document },
  }
}
