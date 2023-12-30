import { beforeEach, describe, expect, it, vi } from "vitest"

import { createEvent } from "effector"

import { optional } from "../optional"

describe("optional", () => {
  const fn = vi.fn()

  const target = createEvent<unknown>()
  const source = optional(target)

  target.watch(fn)

  beforeEach(() => {
    fn.mockClear()
  })

  it("with void returns empty variables", () => {
    source()

    expect(fn).toHaveBeenCalledWith({})
  })

  it("with empty object preserves variables", () => {
    source({})

    expect(fn).toHaveBeenCalledWith({})
  })

  it("with filled object preserves variables", () => {
    source({ key: "value" })

    expect(fn).toHaveBeenCalledWith({ key: "value" })
  })
})
