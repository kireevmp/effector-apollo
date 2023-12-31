import { createStore, createEffect, sample, type Event, type Effect } from "effector"

type Subscription = () => void

interface SetupSubscriptionOptions {
  subscribe: Effect<void, Subscription, unknown>

  setup: Event<unknown>
  teardown?: Event<unknown>

  name?: string
}

export function setupSubscription({
  subscribe,

  setup,
  teardown,

  name = "unknown",
}: SetupSubscriptionOptions) {
  const $subscription = createStore<Subscription | null>(null, {
    name: `${name}.subscription`,
    serialize: "ignore",
    skipVoid: false,
  })

  const unsubFx = createEffect({
    name: `${name}.subscriber`,
    handler: (unsub: Subscription) => unsub(),
  })

  sample({ clock: setup, target: subscribe })
  sample({ clock: subscribe.doneData, target: $subscription })

  sample({
    clock: [setup, teardown].filter(Boolean),
    source: $subscription,
    filter: Boolean,
    target: unsubFx,
  })
}
