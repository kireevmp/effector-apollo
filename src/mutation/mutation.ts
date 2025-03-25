import { type EventCallable, type Store, attach, createEvent, sample } from "effector"

import type {
  ApolloClient,
  DefaultContext,
  DocumentNode,
  MaybeMasked,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client"

import { operationName } from "../lib/name"
import { type Optional, optional } from "../lib/optional"
import { storify } from "../lib/storify"
import {
  type ExecutionParams,
  type RemoteOperation,
  type RemoteOperationInternals,
  createRemoteOperation,
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
  context?: DefaultContext | Store<DefaultContext>

  name?: string
}

export type MutationMeta = void

type MutationInternals<Data, Variables> = RemoteOperationInternals<
  MaybeMasked<Data>,
  Variables,
  MutationMeta
>

export interface Mutation<Data, Variables>
  extends RemoteOperation<MaybeMasked<Data>, Variables, MutationMeta> {
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

  name = operationName(document) || "unknown",
}: CreateMutationOptions<Data, Variables>): Mutation<Data, Variables> {
  type ResolvedData = MaybeMasked<Data>

  const $client = storify(client, { name: `${name}.client`, sid: `apollo.${name}.$client` })

  const $context = storify(context, { name: `${name}.context`, sid: `apollo.${name}.$context` })

  const handler = attach({
    source: { client: $client, context: $context },
    effect: ({ client, context }, { variables }: ExecutionParams<Variables, MutationMeta>) =>
      client
        .mutate({ mutation: document, context, variables, fetchPolicy: "network-only" })
        .then(({ data }) => data!),
  })

  const operation = createRemoteOperation<ResolvedData, Variables, MutationMeta>({ name, handler })

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
