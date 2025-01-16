import { type EventCallable, type Store, attach, createEvent, createStore, sample } from "effector"

import type {
  ApolloClient,
  ApolloError,
  DefaultContext,
  DocumentNode,
  OperationVariables,
  QueryOptions,
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

import { type QueryMeta, createQueryController } from "./controller"

interface CreateQueryOptions<Data, Variables> {
  /** Your {@link ApolloClient} instance that'll be used for making the query. */
  client: ApolloClient<unknown> | Store<ApolloClient<unknown>>
  /**
   * A GraphQL Document with a single `query` for your operation.
   * It's passed directly to Apollo with no modifications.
   */
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  /** Context passed to your Apollo Link. */
  context?: DefaultContext | Store<DefaultContext>

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
   * Latest {@link Query} error.
   *
   * If the data has been successfully fetched, or if there was no request yet,
   * the store will be `null`.
   */
  $error: Store<ApolloError | null>

  meta: {
    /** The name of this query. */
    name: string
    /** The client this query will use to make requests. */
    client: Store<ApolloClient<unknown>>
    /** The document that contains your query and will be used to request data. */
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

  name = operationName(document) || "unknown",
}: CreateQueryOptions<Data, Variables>): Query<Data, Variables> {
  const options: QueryOptions<Variables, Data> = {
    query: document,
    returnPartialData: false,
    canonizeResults: true,
  }

  const push = createEvent<Data | null>({ name: `${name}.push` })

  const $client = storify(client, { sid: `apollo.${name}.$client`, name: `${name}.client` })
  const $context = storify(context, { sid: `apollo.${name}.$context`, name: `${name}.context` })

  const $data = createStore<Data | null>(null, {
    name: `${name}.data`,
    sid: `apollo.${name}.$data`,
    skipVoid: false,
  })

  const $error = createStore<ApolloError | null>(null, {
    name: `${name}.error`,
    sid: `apollo.${name}.$error`,
    skipVoid: false,
  })

  const handler = attach({
    source: { client: $client, context: $context },
    effect: ({ client, context }, { variables, meta }: ExecutionParams<Variables, QueryMeta>) => {
      const fetchPolicy = meta.force ? "network-only" : "cache-first"

      return client.query({ ...options, context, variables, fetchPolicy }).then(({ data }) => data)
    },
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
