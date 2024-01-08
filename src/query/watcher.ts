import { attach, createEvent, createStore, sample, scopeBind } from "effector"

import { type ApolloClient, type Cache } from "@apollo/client"

import { setupSubscription } from "../setup_subscription"

import { type Query } from "./query"

interface WatchQueryOptions {
  client?: ApolloClient<unknown>

  optimistic?: boolean
}

export function watchQuery<Data, Variables>(
  query: Query<Data, Variables>,
  {
    client = query.meta.client,

    optimistic = true,
  }: WatchQueryOptions = {},
): void {
  type WatchOptions = Omit<Cache.WatchOptions<Data, Variables>, "callback">

  const name = `${query.meta.name}.watch`
  const options: WatchOptions = { query: query.meta.document, optimistic }

  const updated = createEvent<Cache.DiffResult<Data>>({ name: `${name}.updated` })
  const received = sample({ clock: updated, filter: ({ complete }) => complete })

  const $subscribed = createStore(false, { skipVoid: false, name: `${name}.subscribed` })

  const subscribeFx = attach({
    name: `${name}.subscriber`,
    source: query.__.$variables,
    effect(variables) {
      const callback = scopeBind(updated, { safe: true })
      return client.cache.watch({ ...options, variables, callback })
    },
  })

  $subscribed.on(query.__.execute, () => true)

  const connect = sample({
    clock: [query.__.execute, query.__.$variables],
    filter: $subscribed,
    fn: (): void => undefined,
  })

  /**
   * When cache is updated, push new data into query.
   * We only push complete updates, and ignore "partial" data.
   * We must request partial data to be able to always subscribe. */
  sample({
    clock: received,
    fn: ({ result }) => result,
    target: query.__.push,
  })

  setupSubscription({ subscribe: subscribeFx, setup: connect, name })
}
