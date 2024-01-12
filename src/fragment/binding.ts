import {
  attach,
  combine,
  createEvent,
  createStore,
  is,
  sample,
  scopeBind,
  type Event,
  type Store,
} from "effector"

import {
  type ApolloClient,
  type Cache,
  type DocumentNode,
  type OperationVariables,
  type StoreObject,
  type TypedDocumentNode,
} from "@apollo/client"
import { Kind, OperationTypeNode, type FragmentDefinitionNode } from "graphql"

import { fragmentName } from "../lib/name"
import { storify } from "../lib/storify"
import { setupSubscription } from "../setup_subscription"

interface CreateFragmentBindingOptions<Data, Variables> {
  /** Your Apollo Client instance. */
  client: ApolloClient<unknown> | Store<ApolloClient<unknown>>
  /**
   * A GraphQL Document with a single `fragment` that you're binding.
   */
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  /**
   * A trigger to setup the binding.
   *
   * When called, will start listening to the Apollo Cache. Usually,
   * this will will be your `appStarted` event.
   */
  setup: Event<void>

  /**
   * A map of Variables that your fragment uses.
   * Can be omitted if the fragment uses no variables.
   */
  variables?: Store<Variables>
  /**
   * Define how to identify a specific fragment.
   *
   * When provided with `Store<string>`, treat this as a ready-to-use
   * canonical Cache ID.
   *
   * When provided with `Store<StoreObject>`, treat this as an object
   * with all required _key fields_. It'll be passed to `cache.identify`.
   */
  id: Store<string> | Store<StoreObject>

  /** Watch for optimistic updates? */
  optimistic?: boolean

  /** The name of your binding. Will be derived from the `document` if abscent. */
  name?: string
}

interface FragmentBinding<Data, Variables> {
  /**
   * The fragment data. Will be null if entry was not found in cache, or if
   * the binding has not been set up yet.
   */
  $data: Store<Data | null>

  meta: {
    name: string
    document: TypedDocumentNode<Data, Variables>
    client: Store<ApolloClient<unknown>>
  }
}

/**
 * Allows you to bind a GraphQL fragment to Effector.
 *
 * Creates a live fragment binding to Apollo Cache. When cache updates,
 * so will this binding. This allows you to access on small chunks of
 * cached data.
 *
 * Note: binding _does not_ make a network request. It only binds already
 * existing, cached data so it's accessible from Effector.
 */
export function createFragmentBinding<
  Data,
  Variables extends OperationVariables = OperationVariables,
>({
  client,
  document,

  setup,

  id,
  variables,

  optimistic = true,

  name = fragmentName(document) || "unknown",
}: CreateFragmentBindingOptions<Data, Variables>): FragmentBinding<Data, Variables> {
  const { fragmentName, typeName } = extractFragment(document)

  const options: Omit<Cache.WatchOptions<Data, Variables>, "id" | "callback"> = {
    query: convertToQuery(document, fragmentName),
    returnPartialData: true,
    canonizeResults: true,
    immediate: true,
    optimistic,
  }

  const updated = createEvent<Cache.DiffResult<Data>>({ name: `${name}.updated` })
  const subscribe = createEvent<void>({ name: `${name}.subscribe` })

  const $data = createStore<Data | null>(null, { skipVoid: false, name: `${name}.data` })

  const $client = storify(client, { name: `${name}.client` })
  const $variables = is.store(variables)
    ? variables
    : createStore({} as Variables, { name: `${name}.variables` })

  const $id = combine($client, id, ({ cache }, id) =>
    typeof id === "string" ? id : cache.identify({ __typename: typeName, ...id }),
  )

  const subscribeFx = attach({
    source: { client: $client, id: $id, variables: $variables },
    effect: ({ client: { cache }, id, variables }) => {
      const callback = scopeBind(updated, { safe: true })

      return cache.watch({ ...options, variables, id, callback })
    },
  })

  sample({
    clock: [setup, $client.updates, $id.updates, $variables.updates],
    target: subscribe,
  })

  sample({
    clock: updated,
    fn: ({ complete, result }) => (complete ? result! : null),
    target: $data,
  })

  setupSubscription({ setup: subscribe, subscribe: subscribeFx, name })

  return {
    $data,

    meta: { name, document, client: $client },
  }
}

function extractFragment(document: DocumentNode) {
  const fragment = document.definitions.find(
    (node): node is FragmentDefinitionNode => node.kind === Kind.FRAGMENT_DEFINITION,
  )

  if (!fragment) throw new Error(`Provided document does not contain a fragment`)

  const fragmentName = fragment.name.value
  const typeName = fragment.typeCondition.name.value

  return { fragmentName, typeName }
}

function convertToQuery(document: DocumentNode, fragmentName: string): DocumentNode {
  return {
    ...document,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: OperationTypeNode.QUERY,
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FRAGMENT_SPREAD,
              name: { kind: Kind.NAME, value: fragmentName },
            },
          ],
        },
      },
      ...document.definitions,
    ],
  }
}
