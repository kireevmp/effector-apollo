import { type Store, attach, createEvent, sample, scopeBind } from "effector"

import { type ApolloClient, Cache, type OperationVariables } from "@apollo/client"
import type { QueryManager } from "@apollo/client/core/QueryManager"

import { storify } from "../lib/storify"
import { setupSubscription } from "../setup_subscription"

import type { Query } from "./query"

interface WatchQueryOptions {
  /**
   * Your Apollo Client instance that'll be used for watching the cache.
   * By default, the same client you use to make requests will be used
   * to watch the cache.
   */
  client?: ApolloClient<unknown> | Store<ApolloClient<unknown>>

  /**
   * Controls when `watchQuery` will listen to updates in cache.
   *
   * By default, this is when the {@link Query} has succeeded.
   * (i.e. run successfully at least once and not reset).
   *
   * ---
   *
   * Note: `enabled` being `true` is required but not sufficient for `Query`
   * to subscribe to cache. The query needs to aquire variables
   */
  enabled?: Store<boolean>

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
export function watchQuery<Data, Variables extends OperationVariables = OperationVariables>(
  query: Query<Data, Variables>,
  {
    client = query.meta.client,

    enabled: $enabled = query.$succeeded,

    optimistic = true,
  }: WatchQueryOptions = {},
): void {
  type WatchOptions = Omit<Cache.WatchOptions<Data, Variables>, "callback">

  const name = `${query.meta.name}.watch`
  const options: WatchOptions = { query: query.meta.document, optimistic }

  const $client = storify(client, { name: `${name}.client`, sid: `apollo.${name}.$client` })

  const updated = createEvent<Cache.DiffResult<Data>>({ name: `${name}.updated` })

  const subscribeFx = attach({
    name: `${name}.subscribe`,
    source: { variables: query.__.$variables, client: $client },
    effect({ variables, client }) {
      const callback = scopeBind(updated, { safe: true })

      return client.cache.watch({ ...options, variables, callback })
    },
  })

  const maskFx = attach({
    name: `${name}.mask`,
    source: { client: $client },
    effect: ({ client }, data: Data) => {
      // @ts-expect-error: private member
      const manager = client.queryManager as QueryManager<unknown>

      return manager.maskOperation({ data, document: query.meta.document, id: name })
    },
  })

  /** Fires when we _can_ connect */
  const ready = sample({ clock: $enabled, filter: (enabled) => enabled })
  const teardown = sample({ clock: $enabled, filter: (enabled) => !enabled })

  const setup = sample({
    clock: [ready, query.finished.finally, query.__.$variables],
    filter: $enabled,
    fn: (): void => undefined,
  })

  /**
   * When cache is updated, attempt to mask it
   * using client settings.
   */
  sample({
    clock: updated,
    filter: ({ complete }) => Boolean(complete),
    fn: ({ result }) => result!,
    target: maskFx,
  })

  /**
   * Once extraction & masking is complete,
   * push data into the query.
   */
  sample({
    clock: maskFx.doneData,
    target: query.__.push,
  })

  setupSubscription({ subscribe: subscribeFx, setup, teardown, name })
}
