import { beforeEach, describe, expect, it, vi } from "vitest"

import { allSettled, fork } from "effector"

import { ApolloClient, InMemoryCache, gql } from "@apollo/client"
import { MockLink } from "@apollo/client/testing"

import { createQueryController } from "../query_controller"
import { createRemoteOperation } from "../remote_operation"

describe("createQueryController", () => {
  const document = gql`
    query {
      value
    }
  `

  const link = new MockLink([])
  const cache = new InMemoryCache()

  const client = new ApolloClient({ link, cache })
  const operation = createRemoteOperation({ client, document })

  const controller = createQueryController({ operation })

  const request = vi.fn(() => ({ data: "result" }))

  beforeEach(() => {
    request.mockClear()
  })

  describe("when stale", () => {
    it("refresh starts request", async () => {
      expect.assertions(1)

      const scope = fork({
        values: [
          [controller.$stale, true],
          [operation.__.$variables, { key: "value" }],
        ],
        handlers: [[operation.__.queryFx, request]],
      })

      await allSettled(controller.refresh, { scope, params: { key: "value" } })

      expect(request).toHaveBeenCalledTimes(1)
    })
  })

  describe("when fresh", () => {
    describe("with same variables", () => {
      it("refresh skips request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "value" }],
          ],
          handlers: [[operation.__.queryFx, request]],
        })

        await allSettled(controller.refresh, { scope, params: { key: "value" } })

        expect(request).not.toHaveBeenCalled()
      })

      it("start runs request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "value" }],
          ],
          handlers: [[operation.__.queryFx, request]],
        })

        await allSettled(controller.start, { scope, params: { key: "value" } })

        expect(request).toHaveBeenCalledTimes(1)
      })
    })

    describe("with different variables", () => {
      it("refresh runs request", async () => {
        expect.assertions(1)

        const scope = fork({
          values: [
            [controller.$stale, false],
            [operation.__.$variables, { key: "old" }],
          ],
          handlers: [[operation.__.queryFx, request]],
        })

        await allSettled(controller.refresh, { scope, params: { key: "new" } })

        expect(request).toHaveBeenCalledTimes(1)
      })
    })
  })
})
