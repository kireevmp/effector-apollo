import { type DocumentNode, Kind, type OperationDefinitionNode } from "graphql"

export function operationName(document: DocumentNode): string | null {
  return (
    document.definitions.find(
      (node): node is OperationDefinitionNode =>
        node.kind === Kind.OPERATION_DEFINITION && !!node.name,
    )?.name?.value ?? null
  )
}

export function fragmentName(document: DocumentNode): string | null {
  return (
    document.definitions.find((node) => node.kind === Kind.FRAGMENT_DEFINITION)?.name?.value ?? null
  )
}
