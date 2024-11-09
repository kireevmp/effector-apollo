import { defineViteConfig } from "smartbundle"
import { defineConfig, mergeConfig } from "vitest/config"

export default defineConfig(async () => {
  const smartbundleConfig = await defineViteConfig()

  return mergeConfig(
    smartbundleConfig,
    defineConfig({
      test: {
        name: "effector-apollo",
        coverage: { provider: "istanbul" },

        pool: "threads",
        isolate: false,
      },
    }),
  )
})
