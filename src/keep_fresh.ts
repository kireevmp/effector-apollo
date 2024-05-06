import { createStore, is, sample, type Event, type EventCallable, type Store } from "effector"

import { divide } from "./lib/divide"
import { not } from "./lib/not"
import { storify } from "./lib/storify"
import { type Query } from "./query/query"

export interface TriggerProtocol {
  "@@trigger": () => {
    setup: EventCallable<void>
    teardown: EventCallable<void>
    fired: Event<unknown> | Event<void>
  }
}

type Trigger = Event<any> | TriggerProtocol

interface KeepFreshOptions {
  /**
   * Controls whether the automatic refresh is enabled.
   *
   * By default, `keepFresh` will be always enabled.
   */
  enabled?: Store<boolean>

  /**
   * A list of triggers to start the query and launch a network request.
   *
   * Can either be a `Event` or a `TriggerProtocol`
   * ({@link https://withease.pages.dev/protocols/trigger | see documentation}).
   */
  triggers: Trigger[]
}

/**
 * Enables automatic refreshes for your query,
 * ensuring that the data stays up-to-date
 * in response to specific events or triggers.
 *
 * @remarks
 *  - By default, `keepFresh` is always enabled. You can optionally control its enabled state using the `enabled` option.
 *  - The query will be refetched when any of the specified triggers fire.
 *
 * @param query - The Query you want to keep fresh.
 * @param options - Options for customizing the refresh behavior.
 */
export function keepFresh<Data, Variables>(
  query: Query<Data, Variables>,
  { enabled, triggers }: KeepFreshOptions,
) {
  const name = `${query.meta.name}.fresh`

  const $enabled = storify(enabled ?? true, {
    name: `${name}.enabled`,
    sid: `apollo.${name}.$enabled`,
  })

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const [events, protocolSources] = divide<Event<any>, TriggerProtocol>(triggers, is.event)

  if (protocolSources.length > 0) {
    const protocols = protocolSources.map((proto) => proto["@@trigger"]())

    const $setup = createStore(false, {
      name: `${name}.setup`,
      sid: `apollo.${name}.$setup`,
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
      clock: $enabled.updates,
      filter: not($enabled),
      fn: () => false,
      target: [...protocols.map(({ teardown }) => teardown), $setup],
    })

    events.push(...protocols.map(({ fired }) => fired))
  }

  const refresh = sample({ clock: events, filter: $enabled })

  sample({
    clock: refresh,
    source: query.__.$variables,
    filter: not(query.$idle),
    // query.refresh would read cache, but we want to force a request
    target: query.start as EventCallable<Variables>,
  })
}
