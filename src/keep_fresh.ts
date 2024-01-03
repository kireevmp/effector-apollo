import { createStore, is, sample, type Event, type EventCallable, type Store } from "effector"

import { not } from "patronum/not"

import { divide } from "./lib/divide"
import { type Query } from "./query"

export interface TriggerProtocol {
  "@@trigger": () => {
    setup: EventCallable<void>
    teardown: EventCallable<void>
    fired: Event<unknown> | Event<void>
  }
}

type Trigger = Event<any> | TriggerProtocol

interface KeepFreshOptions {
  enabled: Store<boolean>
  invalidateOn: Trigger[]
}

export function keepFresh<Data, Variables>(
  query: Query<Data, Variables>,
  { enabled, invalidateOn }: KeepFreshOptions,
) {
  const name = `${query.meta.name}.fresh`

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const [triggers, protocolSources] = divide<Event<any>, TriggerProtocol>(invalidateOn, is.event)

  if (protocolSources.length > 0) {
    const protocols = protocolSources.map((proto) => proto["@@trigger"]())

    const $setup = createStore(false, {
      name: `${name}.setup`,
      serialize: "ignore",
      skipVoid: false,
    })

    sample({
      clock: query.finished.success,
      filter: not($setup),
      fn: () => true,
      target: [...protocols.map(({ setup }) => setup), $setup],
    })

    sample({
      clock: enabled.updates,
      filter: not(enabled),
      fn: () => false,
      target: [...protocols.map(({ teardown }) => teardown), $setup],
    })

    triggers.push(...protocols.map(({ fired }) => fired))
  }

  const refresh = sample({ clock: triggers, filter: enabled })

  sample({
    clock: refresh,
    fn: () => true,
    target: query.$stale,
  })

  sample({
    clock: refresh,
    source: query.__.$variables,
    filter: not(query.$idle),
    target: query.refresh as EventCallable<Variables>,
  })
}
