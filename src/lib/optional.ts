import { type EventCallable } from "effector"

import { type OperationVariables } from "@apollo/client"

type EmptyVariables = Record<PropertyKey, never>
export type Optional<Payload> = Payload extends EmptyVariables ? void : Payload

export function optional<Payload extends OperationVariables>(
  source: EventCallable<Payload>,
): EventCallable<Optional<Payload>> {
  return source.prepend((payload) => (payload ?? {}) as Payload)
}
