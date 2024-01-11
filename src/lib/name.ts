import { Kind, type DocumentNode, type OperationDefinitionNode } from "graphql"

export function nameOf(document: DocumentNode): string | null {
  return (
    document.definitions.find(
      (node): node is OperationDefinitionNode =>
        node.kind === Kind.OPERATION_DEFINITION && !!node.name,
    )?.name?.value ?? null
  )
}
