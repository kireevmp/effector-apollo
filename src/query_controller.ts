import { createEvent, createStore, sample, type EventCallable, type StoreWritable } from "effector"

import { equal } from "@wry/equality"

import { RemoteOperation } from "./remote_operation"

interface QueryControllerOptions<Data, Variables> {
  operation: RemoteOperation<Data, Variables>

  name?: string
}

export interface QueryController<Variables> {
  start: EventCallable<Variables>
  refresh: EventCallable<Variables>

  $stale: StoreWritable<boolean>
}

export function createQueryController<Data, Variables>({
  operation,
  name = "unknown",
}: QueryControllerOptions<Data, Variables>): QueryController<Variables> {
  const start = createEvent<Variables>()
  const refresh = createEvent<Variables>()

  const $stale = createStore<boolean>(true, { skipVoid: false, name: `${name}.stale` })

  sample({
    clock: refresh,
    source: { stale: $stale, prev: operation.__.$variables },
    filter: ({ stale, prev }, params) => stale || !equal(prev, params),
    fn: (_, variables) => variables,
    target: start,
  })

  sample({
    clock: start,
    target: operation.start,
  })

  return {
    start,
    refresh,

    $stale,
  }
}
