import { EventCallable, EventCallableAsReturnType, createEvent, sample } from "effector"

import { not } from "../lib/not"

import { Query } from "./query"

/**
 * A pagination helper for a {@link Query}.
 *
 * Allows you to fetch more records of your query
 * by reusing most recent `variables`, just like `fetchMore` does.
 *
 * This requires the Query to not be `idle`, so ensure you
 * first call `.start` or `.refresh` on a query before fetching new page.
 *
 * `paginate` does not provide a way to merge different pages,
 * instead, it employs pre-defined `typePolicies` on your
 * `InMemoryCache`.
 * Make sure you define a proper merge/read strategy in your `typePolicy`
 * when creating the `client`.
 *
 * Documentation:
 * {@link https://www.apollographql.com/docs/react/pagination/core-api | Apollo Pagination API}
 *
 * @example
 *
 * sample({
 *   clock: pageRequested,
 *   source: query.$data.map(data => data.pageInfo.endCursor),
 *   fn: (cursor) => ({ cursor }),
 *   target: paginate(query)
 * })
 *
 * @returns Event to trigger pagination
 */
export function paginate<Variables>(
  query: Query<any, Variables>,
): EventCallableAsReturnType<Partial<Variables>> {
  const paginate = createEvent<Partial<Variables>>({ name: `${query.meta.name}.paginate` })

  sample({
    clock: paginate,
    source: query.__.$variables,
    fn: (original, override) => ({ ...original, ...override }),
    // We can't paginate idle queries that have no variables yet
    filter: not(query.$idle),
    // force a network request for pagination
    target: query.start as EventCallable<Variables>,
  })

  return paginate
}
