/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig.json",
  },
  settings: {
    "import/resolvers": {
      typescript: true,
      node: true,
    },
  },
  plugins: ["prettier", "import", "@typescript-eslint"],
  overrides: [
    {
      files: [".eslintrc.cjs", "vitest.config.ts", "rollup.config.js"],
      parserOptions: { project: "tsconfig.node.json" },
      rules: {
        "import/no-default-export": "off",
      },
    },
    {
      files: "*.test.ts",
      rules: {
        "@typescript-eslint/require-await": "off",
      },
    },
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/prefer-promise-reject-errors": "off",

    "sort-imports": ["warn", { allowSeparatedGroups: true, ignoreDeclarationSort: true }],

    "import/no-default-export": "error",
    "import/no-duplicates": ["error", { "prefer-inline": true }],
    "import/newline-after-import": "error",

    "import/order": [
      "error",
      {
        "newlines-between": "always",
        "groups": ["builtin", "external", "internal", "parent", "sibling"],
        "pathGroups": [
          { pattern: "effector", group: "external", position: "before" },
          { pattern: "vitest", group: "builtin", position: "after" },
        ],
        "pathGroupsExcludedImportTypes": [],
        "alphabetize": { order: "asc", orderImportKind: "desc", caseInsensitive: true },
      },
    ],
  },
}
