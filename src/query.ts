import {
  createStore,
  sample,
  type Effect,
  type Event,
  type EventCallable,
  type Store,
} from "effector"

import {
  type ApolloClient,
  type ApolloError,
  type DocumentNode,
  type OperationVariables,
  type TypedDocumentNode,
} from "@apollo/client"
import { type EffectState } from "patronum/status"

import { Optional, optional } from "./lib/optional"
import { ViewStatus } from "./lib/view_status"
import { createQueryController } from "./query_controller"
import { OperationResult, createRemoteOperation } from "./remote_operation"

interface CreateQueryOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  name?: string
}

export interface Query<Data, Variables> {
  start: EventCallable<Optional<Variables>>
  refresh: EventCallable<Optional<Variables>>

  $data: Store<Data | null>
  $error: Store<ApolloError | null>
  $stale: Store<boolean>

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

  /**
   * Internal tools for testing purposes only!
   */
  __: {
    queryFx: Effect<Variables, OperationResult<Data>, ApolloError>
    $variables: Store<Variables>
  }
}

export function createQuery<Data, Variables extends OperationVariables = OperationVariables>({
  client,
  document,

  name = "unknown",
}: CreateQueryOptions<Data, Variables>): Query<Data, Variables> {
  const operation = createRemoteOperation({ client, document, name })
  const controller = createQueryController({ operation, name })

  const $data = createStore<Data | null>(null, { name: `${name}.data`, skipVoid: false })
  const $error = createStore<ApolloError | null>(null, { name: `${name}.error`, skipVoid: false })

  sample({
    clock: operation.finished.success,
    fn: ({ data }) => data,
    target: [$data, $error.reinit],
  })

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

    __: operation.__,
  }
}
