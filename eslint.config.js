import js from "@eslint/js"
import ts from "typescript-eslint"
import prettier from "eslint-plugin-prettier/recommended"
import imports from "eslint-plugin-import-x"

/** @type {import('typescript-eslint').Config} */
const config = [
  { ignores: ["dist", "coverage"] },
  { ignores: ["eslint.config.js", "vitest.config.ts", "rollup.config.js"] },

  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  imports.flatConfigs.recommended,
  imports.flatConfigs.typescript,

  prettier,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",

      "sort-imports": ["warn", { allowSeparatedGroups: true, ignoreDeclarationSort: true }],

      "import-x/no-default-export": "error",
      "import-x/no-duplicates": ["error", { "prefer-inline": true }],
      "import-x/newline-after-import": "error",

      "import-x/order": [
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
  },

  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
]

export default config
