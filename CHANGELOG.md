# effector-apollo

## 0.8.0

### Minor Changes

- 8638a92: Support Fragment Masking (`@apollo/client@^3.12.0`)

### Patch Changes

- e1a1cfa: Update dependencies

## 0.7.0

### Minor Changes

- 40d7d65: Support `Store` as context for `Query` and `Mutation`

### Patch Changes

- 23a93ed: Update dependencies
- ba55c68: Improve `Query` tests
- 40d9d6b: Update tsconfig

## 0.6.0

### Minor Changes

- f1c669d: Migrate to [`smartbundle`](https://github.com/XaveScor/smartbundle) – huge thanks to [@XaveScor](https://github.com/XaveScor/)
- c1bd746: Allow explicit control over subscription in `watchQuery`
- 1336eac: Enable `verbatimModuleSyntax`
- a75ee13 & eee5e89: Update dependencies & tooling

### Patch Changes

- 10854d9: Migrate to eslint@9

## 0.5.0

### Minor Changes

- f7b2102: Add `paginate` operator for `Query`
- a2a2024: Limit package contents to `dist`

### Patch Changes

- df81bf6: Fix `watchQuery` to allow resubscribing on variable changes
- 93fcb18: Update internal dependencies

## 0.4.2

### Patch Changes

- 60e05b5: Bump `vitest` & `vite` [CVE-2024-23331]

## 0.4.1

### Patch Changes

- 0d2fef3: Allow arbitrary payload in `setup`/`teardown` of `createFragmentBinding`

## 0.4.0

This release brings a couple of new features and improvements.

- A way to create a live binding into Apollo Cache with `createFragmentBinding`
- Support passing `ApolloClient` through `Store` to enable better `fork` experience
- `keepFresh` operator to refetch `Query` on an arbitrary trigger

### Minor Changes

- 724aa7e: Add `createFragmentBinding` to watch Apollo Cache on fragment level
- 132db54: Add type tests for `Query`
- 0275788: Add documentation and expose `keepFresh`
- 107639a: Add documentation for `createFragmentBinding`
- cbf602d: Add `teardown` to `createFragmentBinding`
- f2d1e2e: Allow passing `ApolloClient` to operations via `Store`

### Patch Changes

- ebf953d: Provide every created Store with `sid`
- e89db15: Add pre-commit git hooks for testing
