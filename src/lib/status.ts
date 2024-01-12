/** Adapted from {@link https://github.com/effector/patronum/blob/main/src/status/index.ts} */
import { createStore, type Effect, type Store, type StoreWritable } from "effector"

export type OperationStatus = "initial" | "pending" | "done" | "fail"

export function status<Params, Done, Fail = Error>(
  effect: Effect<Params, Done, Fail>,
  config: { name: string; sid: string },
): StoreWritable<OperationStatus> {
  const $status = createStore<OperationStatus>("initial", config)

  $status
    .on(effect, () => "pending")
    .on(effect.done, () => "done")
    .on(effect.fail, () => "fail")

  return $status
}

export interface ViewStatus {
  /** Has this operation ever fetched? */
  $idle: Store<boolean>
  /** Is this operation fetching right now? */
  $pending: Store<boolean>
  /** Has fetching this operation failed? */
  $failed: Store<boolean>
  /** Has fetching this operation succeeded? */
  $succeeded: Store<boolean>
  /** Has fetching this operation finished? */
  $finished: Store<boolean>
}

export function viewStatus($status: Store<OperationStatus>): ViewStatus {
  return {
    $idle: $status.map((status) => status === "initial"),
    $pending: $status.map((status) => status === "pending"),
    $failed: $status.map((status) => status === "fail"),
    $succeeded: $status.map((status) => status === "done"),
    $finished: $status.map((status) => ["fail", "done"].includes(status)),
  }
}
