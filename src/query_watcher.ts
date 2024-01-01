import { attach, createEvent, sample, scopeBind, type Event } from "effector"

import { type ApolloClient, type Cache } from "@apollo/client"

import { type Query } from "./query"
import { setupSubscription } from "./setup_subscription"

interface WatchQueryOptions {
  client: ApolloClient<unknown>

  setup?: Event<unknown>
  teardown?: Event<unknown>

  optimistic?: boolean
  immediate?: boolean
}

export function watchQuery<Data, Variables>(
  query: Query<Data, Variables>,
  {
    client,

    setup = query.__.execute,
    teardown,

    optimistic = true,
    immediate = true,
  }: WatchQueryOptions,
): void {
  type WatchOptions = Omit<Cache.WatchOptions<Data, Variables>, "callback">

  const name = `${query.meta.name}.watch`
  const options: WatchOptions = { query: query.__.document, optimistic, immediate }

  const updated = createEvent<Cache.DiffResult<Data>>({ name: `${name}.updated` })

  const subscribeFx = attach({
    name: `${name}.subscriber`,
    source: query.__.$variables,
    effect(variables) {
      const callback = scopeBind(updated, { safe: true })
      return client.cache.watch({ ...options, variables, callback })
    },
  })

  setupSubscription({ subscribe: subscribeFx, setup, teardown, name })

  /**
   * When cache is updated, push new data into query.
   * We only push complete updates, and ignore "partial" data.
   * We must request partial data to be able to always subscribe. */
  sample({
    clock: updated,
    filter: ({ complete }) => complete,
    fn: ({ result }) => result,
    target: query.__.push,
  })

  /**
   * When cache is changed by `optimistic` update, mark query as stale.
   * This is ususally done by mutations to keep UI responsive.
   *
   * To make query fresh, either
   * 1. skip `optimistic` by passing `false` in config, thus ignoring these, or
   * 2. use `updateQuery` operator to bind mutation that does optimistic update
   */
  sample({
    clock: updated,
    filter: ({ fromOptimisticTransaction }) => fromOptimisticTransaction,
    fn: () => true,
    target: query.$stale,
  })
}
