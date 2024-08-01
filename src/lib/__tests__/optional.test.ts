import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEvent } from "effector"

import type { OperationVariables } from "@apollo/client"

import { optional } from "../optional"

describe("optional", () => {
  const fn = vi.fn()

  beforeEach(() => {
    fn.mockClear()
  })

  it("with void returns empty variables", () => {
    const target = createEvent<Record<string, never>>()
    const source = optional(target)

    target.watch(fn)

    source()

    expect(fn).toHaveBeenCalledWith({})
  })

  it("with empty object preserves variables", () => {
    const target = createEvent<OperationVariables>()
    const source = optional(target)

    target.watch(fn)

    source({})

    expect(fn).toHaveBeenCalledWith({})
  })

  it("with filled object preserves variables", () => {
    const target = createEvent<OperationVariables>()
    const source = optional(target)

    target.watch(fn)

    source({ key: "value" })

    expect(fn).toHaveBeenCalledWith({ key: "value" })
  })
})
