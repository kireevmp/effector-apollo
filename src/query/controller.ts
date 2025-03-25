import { type EventCallable, createEvent, sample } from "effector"

import type { RemoteOperation } from "../remote_operation"

export interface QueryMeta {
  force: boolean
}

interface QueryControllerOptions<Data, Variables> {
  operation: RemoteOperation<Data, Variables, QueryMeta>

  name: string
}

export interface QueryController<Variables> {
  start: EventCallable<Variables>
  refresh: EventCallable<Variables>
}

export function createQueryController<Data, Variables>({
  operation,
  name,
}: QueryControllerOptions<Data, Variables>): QueryController<Variables> {
  const start = createEvent<Variables>({ name: `${name}.start` })
  const refresh = createEvent<Variables>({ name: `${name}.refresh` })

  sample({
    clock: refresh,
    fn: (variables) => ({ variables, meta: { force: false } }),
    target: operation.__.execute,
  })

  sample({
    clock: start,
    fn: (variables) => ({ variables, meta: { force: true } }),
    target: operation.__.execute,
  })

  return { start, refresh }
}
