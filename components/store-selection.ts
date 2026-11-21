/** Resolve old shared links after source deduplication without discarding pending selections. */
export function resolveSelectedStoreId(
  stores: readonly { id: string; sourceAliases?: readonly string[] }[],
  selectedId: string | null,
): string | null {
  if (!selectedId) return null;
  const exact = stores.find((store) => store.id === selectedId);
  if (exact) return exact.id;
  return stores.find((store) => store.sourceAliases?.includes(selectedId))?.id ?? selectedId;
}
