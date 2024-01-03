export function divide<L, R>(
  items: Array<L | R>,
  predicate: (item: L | R) => item is L,
): [L[], R[]] {
  const left: L[] = []
  const right: R[] = []

  for (const item of items) {
    if (predicate(item)) left.push(item)
    else right.push(item)
  }

  return [left, right]
}
