import { attach, createEvent, createStore, sample, type EventCallable, type Store } from "effector"

import {
  type ApolloClient,
  type ApolloError,
  type DefaultContext,
  type DocumentNode,
  type OperationVariables,
  type QueryOptions,
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

import { createQueryController, type QueryMeta } from "./controller"

interface CreateQueryOptions<Data, Variables> {
  /** Your Apollo Client instance that'll be used for making the query. */
  client: ApolloClient<unknown> | Store<ApolloClient<unknown>>
  /**
   * A GraphQL Document with a single `query` for your operation.
   * It's passed directly to Apollo with no modifications.
   */
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  /** Context passed to your Apollo Link. */
  context?: DefaultContext

  /** The name of your query. Will be derived from `document` if abscent. */
  name?: string
}

export interface QueryInternals<Data, Variables>
  extends RemoteOperationInternals<Data, Variables, QueryMeta> {
  push: EventCallable<Data | null>
}

export interface Query<Data, Variables> extends RemoteOperation<Data, Variables, QueryMeta> {
  /** Start fetching data unconditionally. */
  start: EventCallable<Optional<Variables>>
  /** Start fetching data if it is absent or stale. */
  refresh: EventCallable<Optional<Variables>>
  /** Reset query state. Clears `$data`, `$error` and `$status` to their initial values.  */
  reset: EventCallable<void>

  /**
   * Latest data received from your `Query`.
   *
   * If there was an error during fetching, or if there was no request yet,
   * this store will be `null`.
   */
  $data: Store<Data | null>
  /**
   * Latest `Query` error.
   *
   * If the data has been successfully fetched, or if there was no request yet,
   * the store will be `null`.
   */
  $error: Store<ApolloError | null>

  meta: {
    name: string
    client: Store<ApolloClient<unknown>>
    document: TypedDocumentNode<Data, Variables>
  }

  /**
   * Internal tools, useful for testing.
   */
  __: QueryInternals<Data, Variables>
}

/**
 * A factory to create a GraphQL Query
 *
 * @param config Query configuration
 * @returns Query instance
 */
export function createQuery<Data, Variables extends OperationVariables = OperationVariables>({
  client,
  document,
  context,

  name = nameOf(document) || "unknown",
}: CreateQueryOptions<Data, Variables>): Query<Data, Variables> {
  const options: QueryOptions<Variables, Data> = {
    query: document,
    context,
    returnPartialData: false,
    canonizeResults: true,
  }

  const push = createEvent<Data | null>({ name: `${name}.push` })

  const $client = storify(client, { name: `${name}.client` })

  const $data = createStore<Data | null>(null, { name: `${name}.data`, skipVoid: false })
  const $error = createStore<ApolloError | null>(null, { name: `${name}.error`, skipVoid: false })

  const handler = attach({
    source: { client: $client },
    effect: ({ client }, { variables, meta }: ExecutionParams<Variables, QueryMeta>) =>
      client
        .query({ ...options, variables, fetchPolicy: meta.force ? "network-only" : "cache-first" })
        .then(({ data }) => data),
  })

  const operation = createRemoteOperation<Data, Variables, QueryMeta>({ name, handler })

  const controller = createQueryController({ operation, name })

  sample({
    clock: operation.finished.success,
    fn: ({ data }) => data,
    target: [$data, $error.reinit],
  })

  sample({ clock: push, target: $data })

  sample({
    clock: operation.finished.failure,
    fn: ({ error }) => error,
    target: [$error, $data.reinit],
  })

  sample({
    clock: operation.reset,
    target: [$data.reinit, $error.reinit],
  })

  return {
    ...operation,

    start: optional(controller.start),
    refresh: optional(controller.refresh),

    $data,
    $error,

    meta: { name, client: $client, document },
    __: { ...operation.__, push },
  }
}
