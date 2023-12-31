import { type Event, type EventCallable, type Store } from "effector"

import {
  type ApolloClient,
  type ApolloError,
  type DocumentNode,
  type TypedDocumentNode,
} from "@apollo/client"
import { EffectState } from "patronum/status"

import { optional, type Optional } from "./lib/optional"
import { type ViewStatus } from "./lib/view_status"
import { createRemoteOperation, type RemoteOperationInternals } from "./remote_operation"

interface CreateMutationOptions<Data, Variables> {
  client: ApolloClient<unknown>
  document: DocumentNode | TypedDocumentNode<Data, Variables>

  name?: string
}

interface MutationInternals<Data, Variables> extends RemoteOperationInternals<Data, Variables> {
  execute: EventCallable<Variables>
  document: TypedDocumentNode<Data, Variables>
}

export interface Mutation<Data, Variables> {
  start: EventCallable<Optional<Variables>>

  $status: Store<EffectState>
  status: ViewStatus

  finished: {
    success: Event<{ variables: Variables; data: Data }>
    failure: Event<{ variables: Variables; error: ApolloError }>

    finally: Event<
      { variables: Variables } & (
        | { status: "done"; data: Data }
        | { status: "fail"; error: ApolloError }
      )
    >
  }

  /**
   * Internal tools
   */
  __: MutationInternals<Data, Variables>
}

export function createMutation<Data, Variables>({
  client,
  document,

  name,
}: CreateMutationOptions<Data, Variables>) {
  const operation = createRemoteOperation<Data, Variables>({
    handler: (variables) =>
      client
        .mutate({ mutation: document, variables, fetchPolicy: "network-only" })
        .then(({ data }) => data),
    name,
  })

  return {
    start: optional(operation.execute),

    $status: operation.$status,
    status: operation.status,

    finished: operation.finished,

    meta: { name },
    __: { ...operation.__, document, execute: operation.execute },
  }
}
