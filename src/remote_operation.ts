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

import { type ApolloError } from "@apollo/client"
import { status, type EffectState } from "patronum/status"

import { readonly } from "./lib/readonly"
import { viewStatus, type ViewStatus } from "./lib/view_status"

export type OperationResult<Data> = { data: Data }

interface CreateRemoteOperationOptions<Data, Variables> {
  handler: (variables: Variables) => Promise<Data>

  name?: string
}

export interface RemoteOperationInternals<Data, Variables> {
  $variables: Store<Variables>
  executeFx: Effect<Variables, Data, ApolloError>
}

export interface RemoteOperation<Data, Variables> {
  execute: EventCallable<Variables>

  $status: Store<EffectState>
  /** What is the current status of my operation? */
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
   * Internal tools
   */
  __: RemoteOperationInternals<Data, Variables>
}

export function createRemoteOperation<Data, Variables>({
  handler,

  name = "unknown",
}: CreateRemoteOperationOptions<Data, Variables>): RemoteOperation<Data, Variables> {
  const execute = createEvent<Variables>({ name: `${name}.execute` })

  // Should not be used before being populated by queryFx
  const $variables = createStore<Variables>({} as Variables, {
    name: `${name}.variables`,
    skipVoid: false,
  })

  const executeFx = createEffect<Variables, Data, ApolloError>({
    name: `${name}.executeFx`,
    handler,
  })

  const $status = status(executeFx)

  const success = executeFx.done.map(({ params, result: data }) => ({ variables: params, data }))
  const failure = executeFx.fail.map(({ params, error }) => ({ variables: params, error }))

  sample({ clock: execute, target: executeFx })

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

    __: { executeFx, $variables },
  }
}
