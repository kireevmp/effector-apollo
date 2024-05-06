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

import { patchHandler } from "./dragons"
import { readonly } from "./lib/readonly"
import { status, viewStatus, type OperationStatus, type ViewStatus } from "./lib/status"

export interface ExecutionParams<Variables, Meta> {
  variables: Variables
  meta: Meta
}

interface CreateRemoteOperationOptions<Data, Variables, Meta> {
  handler: (params: ExecutionParams<Variables, Meta>) => Promise<Data>

  name?: string
}

export interface RemoteOperationInternals<Data, Variables, Meta> {
  $variables: Store<Variables>

  execute: EventCallable<ExecutionParams<Variables, Meta>>
  executeFx: Effect<ExecutionParams<Variables, Meta>, Data, ApolloError>

  called: Event<Promise<Data>>
}

export interface RemoteOperation<Data, Variables, Meta> extends ViewStatus {
  /** Reset operation state to `initial`. */
  reset: EventCallable<void>

  /** Current operation status. */
  $status: Store<OperationStatus>

  /** Set of events that signal the end of your operation. */
  finished: {
    /** The operation has succeeded, use `data` freely. */
    success: Event<{ variables: Variables; meta: Meta; data: Data }>
    /** The operation has failed, and you need to handle `error`. */
    failure: Event<{ variables: Variables; meta: Meta; error: ApolloError }>

    finally: Event<
      { variables: Variables; meta: Meta } & (
        | { status: "done"; data: Data }
        | { status: "fail"; error: ApolloError }
      )
    >
  }

  /**
   * Internal tools, useful for testing.
   */
  __: RemoteOperationInternals<Data, Variables, Meta>
}

export type OperationParams<Q extends RemoteOperation<any, any, any>> = EffectParams<
  Q["__"]["executeFx"]
>
export type OperationResult<Q extends RemoteOperation<any, any, any>> = EffectResult<
  Q["__"]["executeFx"]
>

export function createRemoteOperation<Data, Variables, Meta>({
  handler,

  name = "unknown",
}: CreateRemoteOperationOptions<Data, Variables, Meta>): RemoteOperation<Data, Variables, Meta> {
  const reset = createEvent<void>({ name: `${name}.reset` })
  const execute = createEvent<ExecutionParams<Variables, Meta>>({ name: `${name}.execute` })
  const called = createEvent<Promise<Data>>({ name: `${name}.called` })

  // Should not be used before being populated by executeFx
  const $variables = createStore({} as Variables, {
    name: `${name}.variables`,
    sid: `apollo.${name}.$variables`,
    skipVoid: false,
  })

  const executeFx = createEffect<ExecutionParams<Variables, Meta>, Data, ApolloError>({
    name: `${name}.executeFx`,
    handler,
  })

  const $status = status(executeFx, {
    name: `${name}.status`,
    sid: `apollo.${name}.$status`,
  })

  const success = executeFx.done.map(({ params, result: data }) => ({ ...params, data }))
  const failure = executeFx.fail.map(({ params, error }) => ({ ...params, error }))

  sample({ clock: execute, target: executeFx })
  sample({ clock: reset, target: $status.reinit })

  patchHandler(executeFx, called)

  return {
    reset,

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
