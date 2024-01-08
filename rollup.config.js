import typescript from "rollup-plugin-ts"

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.mjs", format: "esm" },
    { file: "dist/index.cjs", format: "cjs" },
  ],
  plugins: [typescript({ transpiler: "typescript" })],
  external: ["effector", "graphql", /patronum(\/\w+)?/],
}
