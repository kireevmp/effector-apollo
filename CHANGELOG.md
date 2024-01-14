# effector-apollo

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
