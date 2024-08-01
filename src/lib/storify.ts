import { type Store, createStore, is } from "effector"

export function storify<T>(value: T | Store<T>, config: { name: string; sid: string }): Store<T> {
  if (is.store(value)) return value

  return createStore<T>(value, { ...config, skipVoid: false })
}
