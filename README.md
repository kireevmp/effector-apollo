# effector-apollo

A lightweight wrapper around [Apollo Client](https://apollographql.com/docs/react) to interoperate with [☄️ Effector](https://effector.dev/).
Create and manage your GraphQL Queries & Mutations _declaratively_, with Effector, while using powerful Apollo Client features, like normalized cache and Apollo Link.

## 🔗 Installation & use

```bash
$ npm install effector-apollo
# or
$ yarn add effector-apollo
# or
$ pnpm add effector-apollo
```

Note that this library requires `effector@23` and `@apollo/client` as peer dependencies, so make sure you have them installed in your project.

## API

### `createQuery`

Creates a new query that allows you to read data from GraphQL server or cache on request.

**Options:**

- `client`: `ApolloClient | Store<ApolloClient>` that the query will use to fetch data
- `document`: `DocumentNode` describing your query
- `context?`: `DefaultContext | Store<DefaultContext>` allows you to provide arbitrary context to your Apollo Link

**Returns:** a new `Query` instance

### `Query`

**Commands:**

- `start`: `EventCallable<Variables>` unconditionally starts your query, and _will_ send a network request
- `refresh`: `EventCallable<Variables>` will refresh the query, using cache if possible
- `reset`: `EventCallable<void>` resets your query to its initial state

**Query state:**

- `$data`: `Store<Data | null>` containing your query data
- `$error`: `Store<ApolloError | null>` possibly containing query execution error
- `$status`: `Store<'initial' | 'pending' | 'done' | 'fail'>` reflecting current status of your query, which is also split into separate 'convenience' stores
  - `$idle`: `true` if the `Query` has not ever started
  - `$pending`: `true` if the `Query` is currently fetching
  - `$failed`: `true` if the `Query` has failed with some `ApolloError`
  - `$succeeded`: `true` if the `Query` has succeeded with data
  - `$finished`: `true` if the `Query` has finished with either success or failure

**Query state events:**

- `finished.success`: `Event<{ variables: Variables; meta: QueryMeta, data: Data }>` is fired when your `Query` succeeds, providing `variables` that you called the query with, and `data` that the query has returned
- `finished.failure`: `Event<{ variables: Variables; meta: QueryMeta, error: ApolloError }>` is fired when your `Query` fails, providing `variables` and the corresponding `error`
- `finished.finally`: `Event` is fired when your `Query` finishes with either `status: "done"` or `status: "fail"`, and will provide you with `data`/`error`

#### Example usage

```ts
const query = createQuery({
  client,
  document: gql`
    query user {
      user {
        id
        name
      }
    }
  `,
})

sample({
  clock: appStarted,
  target: query.start,
})
```

### `createMutation`

Creates a new mutation to modify data on your GraphQL server.

**Options:**

- `client`: `ApolloClient | Store<ApolloClient>` that the mutation will use to fetch data
- `document`: `DocumentNode` describing your mutation
- `context?`: `DefaultContext | Store<DefaultContext>` allows you to provide arbitrary context to your Apollo Link

**Returns:** a new `Mutation` instance

### `Mutation`

**Commands:**

- `start`: `EventCallable<Variables>` unconditionally starts your `Mutation`, and _will_ send a network request immediately
- `reset`: `EventCallable<void>` resets your mutation to its initial state

**Mutation state:**

- `$status`: `Store<'initial' | 'pending' | 'done' | 'fail'>` reflecting current status of your `Mutation`, which is also split into separate 'convenience' stores
  - `$idle`: `true` if the `Mutation` has not ever started
  - `$pending`: `true` if the `Mutation` is currently fetching
  - `$failed`: `true` if the `Mutation` has failed with some `ApolloError`
  - `$succeeded`: `true` if the `Mutation` has succeeded with data
  - `$finished`: `true` if the `Mutation` has finished with either success or failure

**Mutation state events:**

- `finished.success`: `Event<{ variables: Variables; data: Data }>` is fired when your `Mutation` succeeds with `data` that the GraphQL server has returned
- `finished.failure`: `Event<{ variables: Variables; error: ApolloError }>` is fired when your `Mutation` fails with the corresponding execution `error`
- `finished.finally`: `Event` that's fired when your `Mutation` finishes with either `status: "done"` or `status: "fail"`, and will provide you with `data`/`error`

### `createFragmentBinding`

`createFragmentBinding` sets up a light, read-only binding into Apollo Cache. This can come in handy to access entities from your Apollo Cache without requiring a specific `Query` to do that.

Like [`useFragment`](https://www.apollographql.com/docs/react/data/fragments/#usefragment) from Apollo Client, fragment binding **does not trigger network requests on its own**. Rather, it keeps data in sync between Apollo Cache and Effector.

Unlike `useFragment`, however, `createFragmentBinding`'s primary purpose is to provide you with _singleton-like_ entities that your business logic might requre. Common examples would be: currently logged in `User` entity, a specific `Setting`, or feature flags.

**Options:**

- `client`: `ApolloClient | Store<ApolloClient>` that provides cached data
- `document`: `DocumentNode` with a single `fragment` definition you want to bind
- `id`: `Store<string> | Store<StoreObject>` to identify a specific `fragment`

  - When provided with `Store<string>`, binding will treat this as a ready-to-use [Canonical Cache ID](https://www.apollographql.com/docs/react/caching/cache-interaction/#obtaining-an-objects-cache-id) (like `User:137`)
  - When provided with `Store<StoreObject>`, binding treats this as an object with _key fields_ that uniquely identify your `fragment`

    Unless you [customize your cache ID](https://www.apollographql.com/docs/react/caching/cache-configuration/#customizing-cache-ids),
    `id` or `_id` are your _key fields_. So, `Store<{ id: string }>` is usually the way to go!

    If you did customize cache ID for your fragment, provide all necessary _key fields_ set in your type policy.

    💡 You do not need to provide `__typename` in this `Store`, as it is inferred from your `fragment`.

- `variables?`: `Store<Variables>` that your `fragment` requires to resolve
  - You can omit this if your `fragment` does not require any variables
  - ⚠️ If the `fragment` **does** need variables, you must provide this option with correct `Variables`, otherwise you'll never receive data
- `setup`: `Event` that the binding will initialize on (upon trigger)
  - Usually, that would be your `appStarted` event, but you can also use any other trigger, like `Query.finished.success`
- `teardown`: `Event` tears down the binding, clearing `$data` and stopping listening for updates
- `optimistic?`: `boolean` can be set to `false` to disable reading `optimistic` cache

**Returns:** a new `FragmentBinding`

### `FragmentBinding`

A live binding into `ApolloCache` for a specific fragment.

- `$data`: `Store<Data | null>` containing your `fragment` data (or `null` if no `fragment` was found in Cache)
- `$active`: `Store<boolean>` marking if your binding is active or not

### `watchQuery`

`watchQuery` allows you to subscribe a particular query to Apollo Cache. By default, `Query` only reads data through a request, and does not read cache (unlike Apollo's React hooks).

This operator allows you to connect `Query` to cache if you expect other parts of your app to request the same query. This will help you avoid extra requests.

**Options:**

- `query`: `Query` that you want to subscribe to cache
- `optimistic?`: `boolean` can be set to `false` to disable reading `optimistic` cache
- `client?`: `ApolloClient | Store<ApolloClient>` to use cache from. Will use the client from `createQuery` if not provided

### `keepFresh`

Enables automatic refreshes for a query, ensuring that the data stays up-to-date in response to specific events or triggers.

**Options:**

- `query`: `Query` you want to keep fresh
- `triggers`: `Array<Event | TriggerProtocol>` containing triggers that will invalidate the query and initiate a network request for fresh data. Trigger can be either:
  - any `Event`, or
  - [`TriggerProtocol`](https://withease.pages.dev/protocols/trigger) from any library that implements it
    - 💡 [`@withease/web-api`](https://withease.pages.dev/web-api) is a great package with triggers like tab visibility change or network status change
    - [`patronum/interval`](https://patronum.effector.dev/methods/interval/) can refresh your query on a timer
- `enabled?`: `Store<boolean>` that controls whether the automatic refresh is enabled or disabled. If ommited, defaults to _always enabled_

<details>
  <summary><b>Example usage:</b></summary>

Fetch the query when network connection is restored

```ts
import { keepFresh, createQuery } from "effector-apollo"
import { trackNetworkStatus } from "@withease/web-api"

const userQuery = createQuery({ client, document: USER_QUERY })

// If the connection is lost, fetch User as soon as it is restored
keepFresh(userQuery, {
  triggers: [trackNetworkStatus],
})
```

---

Refetch a related query when a mutation fails

```ts
import { keepFresh, createQuery, createMutation } from "effector-apollo"

const userQuery = createQuery({ client, document: USER_QUERY })
const updateCountryMutation = createMutation({ client, document: UPDATE_COUNTRY_MUTATION })

// When update fails, data may become inconsistent,
// so we refetch User, ensuring data is most up to date
keepFresh(userQuery, {
  triggers: [updateCountryMutation.finished.failure],
})
```

</details>

### `paginate`

`paginate` creates a `fetchMore`-like function for your query, allowing for easy pagination powered by Apollo Cache.

Note that this operator requires two things from you to work properly:

1. You must define a proper Field Policy on a paginated field using a [`merge` function](https://www.apollographql.com/docs/react/caching/cache-field-behavior/#the-merge-function) of `InMemoryCache`. This allows to store paginated results in the cache
2. The `Query` must not be "idle" when you use pagination. Fetch the Query using `.refresh` or `.start` before paginating.

Triggering the event returned by `paginate(query)` will

- shallowly merge last used `query` variables and new variables provided to `paginate`
- execute the `query` to fetch the next page based on updated variables
- merge pages using your policy (as defined in `InMemoryCache`)
- store results in `query.$data`

Read more about [Pagination API](https://www.apollographql.com/docs/react/pagination/core-api) in Apollo.

**Options:**

- `query`: `Query` that will be paginated

**Returns:** `EventCallable<Partial<Variables>>` which you can call to fetch the next page

<details>
  <summary><b>Example usage:</b></summary>

Paginate a query using a cursor in a Relay-style pagination.

```ts
import { createQuery, paginate } from "effector-apollo"
import { gql } from "@apollo/client"

const document = gql`
  query list($cursor: String) {
    items(cursor: $cursor) {
      nodes {
        id
      }

      pageInfo {
        endCursor
      }
    }
  }
`

const listQuery = createQuery({ client, document })

const nextPageRequested = createEvent<void>()

sample({
  // when the next page is requested
  clock: nextPageRequested,
  // take the end cursor of the list
  source: listQuery.$data.map(({ items }) => items.pageInfo.endCursor),
  // construct an update to query variables
  fn: (cursor) => ({ cursor }),
  // launch pagination
  target: paginate(listQuery),
})
```

</details>

### `optimistic`

`optimistic` helps you define an optimistic response for your mutation. This will fill in data in Apollo Cache when running the mutation, so that your UI is responsive to user action. See more in Apollo Client "[Optimistic results](https://www.apollographql.com/docs/react/performance/optimistic-ui/)" documentation.

**Options:**

- `mutation`: `Mutation` that you want to define an optimistic response for
- `fn`: `Variables => Data` function that constructs an optimistic response for a mutation
- `client?`: `ApolloClient | Store<ApolloClient>` to write response to. Will use the client from `createMutation` if not provided

## 💬 Pick your library

When starting a new project from scratch, please, take a look at [Farfetched](https://farfetched.pages.dev/), a great data fetching tool, before using `effector-apollo`.

This library is an _interoperability_ layer for projects that already use Apollo Client. It makes your life easier by giving you access to your GraphQL data from Effector.

This library strives to keep its API similar to Farfetched so that your future migration to this tool is simpler.

## Releases policy

Versions `0.x.x` may contain breaking changes in minor releases, which will be documented.
