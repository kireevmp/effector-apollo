import { Store, attach, createEvent, createStore, sample, scopeBind } from "effector"

import { type ApolloClient, type Cache } from "@apollo/client"

import { storify } from "../lib/storify"
import { setupSubscription } from "../setup_subscription"

import { type Query } from "./query"

interface WatchQueryOptions {
  /**
   * Your Apollo Client instance that'll be used for watching the cache.
   * By default, the same client you use to make requests will be used
   * to watch the cache.
   */
  client?: ApolloClient<unknown> | Store<ApolloClient<unknown>>

  /** Watch for optimistic updates? */
  optimistic?: boolean
}

/**
 * Watch for Apollo Cache changes and update your `Query` to match.
 *
 * Subscribes your query to Apollo Cache to always keep `$data`
 * in sync with Apollo Cache. Usually, `Query` only updates its
 * `$data` upon request. `watchQuery` changes that so your `Query`
 * behaves more like Apollo Client's React hooks.
 */
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

  const $client = storify(client, { name: `${name}.client` })

  const updated = createEvent<Cache.DiffResult<Data>>({ name: `${name}.updated` })
  const received = sample({ clock: updated, filter: ({ complete }) => Boolean(complete) })

  const $subscribed = createStore(false, { skipVoid: false, name: `${name}.subscribed` })

  const subscribeFx = attach({
    name: `${name}.subscriber`,
    source: { variables: query.__.$variables, client: $client },
    effect({ variables, client }) {
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
    fn: ({ result }) => result!,
    target: query.__.push,
  })

  setupSubscription({ subscribe: subscribeFx, setup: connect, name })
}
