import { createEvent, sample, type EventCallable } from "effector"

import {
  DefaultContext,
  type ApolloClient,
  type DocumentNode,
  type TypedDocumentNode,
} from "@apollo/client"

import { nameOf } from "./lib/name"
import { optional, type Optional } from "./lib/optional"
import {
  createRemoteOperation,
  type ExecutionParams,
  type RemoteOperation,
  type RemoteOperationInternals,
} from "./remote_operation"

interface CreateMutationOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  context?: DefaultContext

  name?: string
}

export type MutationMeta = void

interface MutationInternals<Data, Variables>
  extends RemoteOperationInternals<Data, Variables, MutationMeta> {}

export interface Mutation<Data, Variables> extends RemoteOperation<Data, Variables, MutationMeta> {
  start: EventCallable<Optional<Variables>>

  meta: {
    name: string
    client: ApolloClient<unknown>
    document: TypedDocumentNode<Data, Variables>
  }

  /**
   * Internal tools
   */
  __: MutationInternals<Data, Variables>
}

export function createMutation<Data, Variables>({
  client,
  document,
  context,

  name = nameOf(document) || "unknown",
}: CreateMutationOptions<Data, Variables>): Mutation<Data, Variables> {
  const operation = createRemoteOperation<Data, Variables, MutationMeta>({
    handler: ({ variables }) =>
      client
        .mutate({ mutation: document, context, variables, fetchPolicy: "network-only" })
        .then(({ data }) => data),
    name,
  })

  const start = createEvent<Variables>({ name: `${name}.start` })

  sample({
    clock: start,
    fn: (variables) => ({ variables }) as ExecutionParams<Variables, void>,
    target: operation.__.execute,
  })

  return {
    ...operation,

    start: optional(start),

    meta: { name, client, document },
    __: { ...operation.__ },
  }
}
