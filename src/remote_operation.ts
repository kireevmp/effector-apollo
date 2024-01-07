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

interface ExecutionParams<Variables, Meta> {
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
  /** Current operation status */
  $status: Store<EffectState>

  /** Set of events that signal the end of your operation */
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
   * Internal tools
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
  const execute = createEvent<ExecutionParams<Variables, Meta>>({ name: `${name}.execute` })
  const called = createEvent<Promise<Data>>({ name: `${name}.called` })

  // Should not be used before being populated by queryFx
  const $variables = createStore({} as Variables, { name: `${name}.variables`, skipVoid: false })

  const executeFx = createEffect<ExecutionParams<Variables, Meta>, Data, ApolloError>({
    name: `${name}.executeFx`,
    handler,
  })

  const $status = status(executeFx)

  const success = executeFx.done.map(({ params, result: data }) => ({ ...params, data }))
  const failure = executeFx.fail.map(({ params, error }) => ({ ...params, error }))

  sample({ clock: execute, target: executeFx })

  patchHandler(executeFx, called)

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
