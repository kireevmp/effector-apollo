import {
  createEffect,
  createEvent,
  createStore,
  merge,
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
  type QueryOptions,
  type TypedDocumentNode,
} from "@apollo/client"
import { status, type EffectState } from "patronum/status"

import { readonly } from "./lib/readonly"
import { viewStatus, type ViewStatus } from "./lib/view_status"

export type OperationResult<Data> = { data: Data }

interface CreateRemoteOperationOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  name?: string
}

export interface RemoteOperationInternals<Data, Variables> {
  $variables: Store<Variables>
  document: TypedDocumentNode<Data, Variables>

  queryFx: Effect<Variables, OperationResult<Data>, ApolloError>
}

export interface RemoteOperation<Data, Variables> {
  execute: EventCallable<Variables>

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
  __: RemoteOperationInternals<Data, Variables>
}

export function createRemoteOperation<Data, Variables>({
  client,
  document,

  name = "unknown",
}: CreateRemoteOperationOptions<Data, Variables>): RemoteOperation<Data, Variables> {
  type Params = Variables
  type Result = OperationResult<Data>

  const options: QueryOptions<Variables, Data> = {
    query: document,
    returnPartialData: false,
    canonizeResults: true,
  }

  const execute = createEvent<Params>({ name: `${name}.execute` })

  // Should not be used before being populated by queryFx
  const $variables = createStore<Params>({} as Params, {
    name: `${name}.variables`,
    skipVoid: false,
  })

  const queryFx = createEffect<Params, Result, ApolloError>({
    name: `${name}.query`,
    handler: (variables) => client.query({ ...options, variables, fetchPolicy: "network-only" }),
  })

  const $status = status(queryFx)

  const success = queryFx.done.map(({ params, result: { data } }) => ({ variables: params, data }))
  const failure = queryFx.fail.map(({ params, error }) => ({ variables: params, error }))

  sample({ clock: execute, target: queryFx })

  return {
    execute,

    $status: readonly($status),
    status: viewStatus($status),

    finished: {
      success,
      failure,
      finally: merge([
        success.map((payload) => ({ status: "done", ...payload })),
        failure.map((payload) => ({ status: "fail", ...payload })),
      ]),
    },

    __: { queryFx, $variables, document },
  }
}
