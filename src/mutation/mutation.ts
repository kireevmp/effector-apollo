import { attach, createEvent, sample, type EventCallable, type Store } from "effector"

import {
  DefaultContext,
  type ApolloClient,
  type DocumentNode,
  type OperationVariables,
  type TypedDocumentNode,
} from "@apollo/client"

import { nameOf } from "../lib/name"
import { optional, type Optional } from "../lib/optional"
import { storify } from "../lib/storify"
import {
  createRemoteOperation,
  type ExecutionParams,
  type RemoteOperation,
  type RemoteOperationInternals,
} from "../remote_operation"

interface CreateMutationOptions<Data, Variables> {
  /** Your Apollo Client instance that'll be used for making the mutation. */
  client: ApolloClient<unknown> | Store<ApolloClient<unknown>>
  /**
   * A GraphQL Document with a single `mutation` for your operation.
   * It's passed directly to Apollo with no modifications.
   */
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  /** Context passed to your Apollo Link. */
  context?: DefaultContext

  name?: string
}

export type MutationMeta = void

interface MutationInternals<Data, Variables>
  extends RemoteOperationInternals<Data, Variables, MutationMeta> {}

export interface Mutation<Data, Variables> extends RemoteOperation<Data, Variables, MutationMeta> {
  /** Run this Mutation against the GraphQL server. */
  start: EventCallable<Optional<Variables>>

  meta: {
    name: string
    client: Store<ApolloClient<unknown>>
    document: TypedDocumentNode<Data, Variables>
  }

  /**
   * Internal tools, useful for testing.
   */
  __: MutationInternals<Data, Variables>
}

export function createMutation<Data, Variables extends OperationVariables = OperationVariables>({
  client,
  document,
  context,

  name = nameOf(document) || "unknown",
}: CreateMutationOptions<Data, Variables>): Mutation<Data, Variables> {
  const $client = storify(client, { name: `${name}.client` })

  const handler = attach({
    source: { client: $client },
    effect: ({ client }, { variables }: ExecutionParams<Variables, MutationMeta>) =>
      client
        .mutate({ mutation: document, context, variables, fetchPolicy: "network-only" })
        .then(({ data }) => data!),
  })

  const operation = createRemoteOperation<Data, Variables, MutationMeta>({ handler, name })

  const start = createEvent<Variables>({ name: `${name}.start` })

  sample({
    clock: start,
    fn: (variables) => ({ variables }) as ExecutionParams<Variables, void>,
    target: operation.__.execute,
  })

  return {
    ...operation,

    start: optional(start),

    meta: { name, client: $client, document },
    __: { ...operation.__ },
  }
}
