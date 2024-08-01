// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "effector-apollo",
    coverage: { provider: "istanbul" },

    pool: "threads",
    isolate: false,
  },
})
