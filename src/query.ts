import {
  createEvent,
  createStore,
  sample,
  type EventCallable,
  type Store,
  type StoreWritable,
} from "effector"

import {
  type ApolloClient,
  type ApolloError,
  type DocumentNode,
  type OperationVariables,
  type QueryOptions,
  type TypedDocumentNode,
} from "@apollo/client"

import { nameOf } from "./lib/name"
import { optional, type Optional } from "./lib/optional"
import { createQueryController, type QueryMeta } from "./query_controller"
import {
  createRemoteOperation,
  type RemoteOperation,
  type RemoteOperationInternals,
} from "./remote_operation"

interface CreateQueryOptions<Data, Variables> {
  /** Your Apollo Client instance that'll be used for making the query. */
  client: ApolloClient<unknown>
  /**
   * A GraphQL Document with a single `query` for your operation.
   * It's passed directly to Apollo with no modifications.
   */
  document: DocumentNode | TypedDocumentNode<Data, Variables>

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

  /**
   * Latest received data from your `Query`.
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

  /** Is data in this query stale? */
  $stale: StoreWritable<boolean>

  meta: {
    name: string
    client: ApolloClient<unknown>
    document: TypedDocumentNode<Data, Variables>
  }

  /**
   * Internal tools for testing purposes only!
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

  name = nameOf(document) || "unknown",
}: CreateQueryOptions<Data, Variables>): Query<Data, Variables> {
  const options: QueryOptions<Variables, Data> = {
    query: document,
    returnPartialData: false,
    canonizeResults: true,
  }

  const push = createEvent<Data | null>({ name: `${name}.push` })

  const $data = createStore<Data | null>(null, { name: `${name}.data`, skipVoid: false })
  const $error = createStore<ApolloError | null>(null, { name: `${name}.error`, skipVoid: false })

  const operation = createRemoteOperation<Data, Variables, QueryMeta>({
    name,
    handler: ({ variables, meta }) =>
      client
        .query({ ...options, variables, fetchPolicy: meta.force ? "network-only" : "cache-first" })
        .then(({ data }) => data),
  })

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

  return {
    ...operation,

    start: optional(controller.start),
    refresh: optional(controller.refresh),

    $data,
    $error,

    $stale: controller.$stale,

    meta: { name, client, document },
    __: { ...operation.__, push },
  }
}
