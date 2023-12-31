import {
  createEvent,
  createStore,
  sample,
  type Event,
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
import { type EffectState } from "patronum/status"

import { Optional, optional } from "./lib/optional"
import { ViewStatus } from "./lib/view_status"
import { createQueryController } from "./query_controller"
import { createRemoteOperation, type RemoteOperationInternals } from "./remote_operation"

interface CreateQueryOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  name?: string
}

export interface QueryInternals<Data, Variables> extends RemoteOperationInternals<Data, Variables> {
  push: EventCallable<Data | null>

  document: TypedDocumentNode<Data, Variables>
  execute: EventCallable<Variables>
}

export interface Query<Data, Variables> {
  start: EventCallable<Optional<Variables>>
  refresh: EventCallable<Optional<Variables>>

  $data: Store<Data | null>
  $error: Store<ApolloError | null>
  $stale: StoreWritable<boolean>

  $status: Store<EffectState>
  /** What is the current status of my query? */
  status: ViewStatus

  finished: {
    success: Event<{ variables: Variables; data: Data }>
    failure: Event<{ variables: Variables; error: ApolloError }>

    finally: Event<
      { variables: Variables } & (
        | { status: "done"; data: Data }
        | { status: "fail"; error: ApolloError }
      )
    >
  }

  meta: { name: string }

  /**
   * Internal tools for testing purposes only!
   */
  __: QueryInternals<Data, Variables>
}

export function createQuery<Data, Variables extends OperationVariables = OperationVariables>({
  client,
  document,

  name = "unknown",
}: CreateQueryOptions<Data, Variables>): Query<Data, Variables> {
  const options: QueryOptions<Variables, Data> = {
    query: document,
    returnPartialData: false,
    canonizeResults: true,
    fetchPolicy: "network-only",
  }

  const operation = createRemoteOperation<Data, Variables>({
    handler: (variables) => client.query({ ...options, variables }).then(({ data }) => data),
    name,
  })

  const controller = createQueryController({ operation, name })

  const push = createEvent<Data | null>({ name: `${name}.push` })

  const $data = createStore<Data | null>(null, { name: `${name}.data`, skipVoid: false })
  const $error = createStore<ApolloError | null>(null, { name: `${name}.error`, skipVoid: false })

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
    start: optional(controller.start),
    refresh: optional(controller.refresh),

    $data,
    $error,
    $stale: controller.$stale,

    $status: operation.$status,
    status: operation.status,

    finished: operation.finished,

    meta: { name },
    __: { ...operation.__, execute: operation.execute, push, document },
  }
}
