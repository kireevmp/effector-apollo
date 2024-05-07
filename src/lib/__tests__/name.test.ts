import { describe, expect, it } from "vitest"

import { gql } from "@apollo/client"

import { fragmentName } from "../name"

describe("fragmentName", () => {
  it("derives name from fragment", () => {
    const document = gql`
      fragment test on Example {
        value
      }
    `

    expect(fragmentName(document)).toBe("test")
  })

  it("does not throw on documents without fragments", () => {
    const document = gql`
      query test {
        value
      }
    `

    expect(fragmentName(document)).toBeNull()
  })
})
