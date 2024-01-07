import { Store } from "effector"

import { type EffectState } from "patronum/status"

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

export function viewStatus($status: Store<EffectState>): ViewStatus {
  return {
    $idle: $status.map((status) => status === "initial"),
    $pending: $status.map((status) => status === "pending"),
    $failed: $status.map((status) => status === "fail"),
    $succeeded: $status.map((status) => status === "done"),
    $finished: $status.map((status) => ["fail", "done"].includes(status)),
  }
}
