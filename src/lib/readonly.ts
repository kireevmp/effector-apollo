import { type Event, type Store } from "effector"

export function readonly<T>(store: Store<T>): Store<T>
export function readonly<T>(event: Event<T>): Event<T>

export function readonly<T>(unit: Store<T> | Event<T>): Store<T> | Event<T> {
  return unit.map((v) => v, { skipVoid: false })
}
