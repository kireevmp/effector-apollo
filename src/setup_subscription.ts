import { createStore, createEffect, sample, type Event, type Effect } from "effector"

type Subscription = () => void

interface SetupSubscriptionOptions<Params> {
  subscribe: Effect<Params, Subscription, unknown>

  setup: Event<Params>
  teardown?: Event<unknown>

  name?: string
}

export function setupSubscription<Params>({
  subscribe,

  setup,
  teardown,

  name = "unknown",
}: SetupSubscriptionOptions<Params>) {
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
