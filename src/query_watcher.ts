import { attach, createEvent, createStore, sample, scopeBind } from "effector"

import { type ApolloClient, type Cache, type FetchPolicy } from "@apollo/client"

import { type Query } from "./query"
import { setupSubscription } from "./setup_subscription"

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

  sample({
    clock: $subscribed.updates,
    fn: (status): FetchPolicy => (status ? "cache-first" : "network-only"),
    target: query.__.$policy,
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

  /**
   * To avoid fetching queries that are in cache, we mark query
   * as fresh when we get data from Cache, assuming that's not optimistic.
   *
   * These are 'trusted', just like Apollo trusts them. */
  sample({
    clock: received,
    filter: ({ fromOptimisticTransaction }) => !fromOptimisticTransaction,
    fn: () => false,
    target: query.$stale,
  })

  setupSubscription({ subscribe: subscribeFx, setup: connect, name })
}
