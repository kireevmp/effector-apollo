import {
  createEffect,
  createEvent,
  createStore,
  merge,
  sample,
  type Effect,
  type EffectParams,
  type EffectResult,
  type Event,
  type EventCallable,
  type Store,
} from "effector"

import { type ApolloError } from "@apollo/client"
import { status, type EffectState } from "patronum/status"

import { patchHandler } from "./dragons"
import { readonly } from "./lib/readonly"
import { viewStatus, type ViewStatus } from "./lib/view_status"

interface CreateRemoteOperationOptions<Data, Variables> {
  handler: (variables: Variables) => Promise<Data>

  name?: string
}

export interface RemoteOperationInternals<Data, Variables> {
  $variables: Store<Variables>

  execute: EventCallable<Variables>
  executeFx: Effect<Variables, Data, ApolloError>

  called: Event<Promise<Data>>
}

export interface RemoteOperation<Data, Variables> extends ViewStatus {
  $status: Store<EffectState>

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
   * Internal tools
   */
  __: RemoteOperationInternals<Data, Variables>
}

export type OperationParams<Q extends RemoteOperation<any, any>> = EffectParams<
  Q["__"]["executeFx"]
>
export type OperationResult<Q extends RemoteOperation<any, any>> = EffectResult<
  Q["__"]["executeFx"]
>

export function createRemoteOperation<Data, Variables>({
  handler,

  name = "unknown",
}: CreateRemoteOperationOptions<Data, Variables>): RemoteOperation<Data, Variables> {
  const execute = createEvent<Variables>({ name: `${name}.execute` })
  const called = createEvent<Promise<Data>>({ name: `${name}.called` })

  // Should not be used before being populated by queryFx
  const $variables = createStore<Variables>({} as Variables, {
    name: `${name}.variables`,
    skipVoid: false,
  })

  const executeFx = createEffect<Variables, Data, ApolloError>({
    name: `${name}.executeFx`,
    handler,
  })

  patchHandler(executeFx, called)

  const $status = status(executeFx)

  const success = executeFx.done.map(({ params, result: data }) => ({ variables: params, data }))
  const failure = executeFx.fail.map(({ params, error }) => ({ variables: params, error }))

  sample({ clock: execute, target: executeFx })

  return {
    $status: readonly($status),
    ...viewStatus($status),

    finished: {
      success,
      failure,
      finally: merge([
        success.map((payload) => ({ status: "done", ...payload })),
        failure.map((payload) => ({ status: "fail", ...payload })),
      ]),
    },

    __: { execute, executeFx, called, $variables },
  }
}
