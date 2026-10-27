// Sorting for the lists whose rows are all in the page (Hardware, the Collections/Series/
// Platforms index, On Sale, Orphaned accessories, the sale lists, Steam Sync): a field and a
// direction, picked from the Sort menu or a table's column headers. The game lists sort on the
// server instead (utils/gameSortOptions.ts) but share the direction type and header cell.

export type SortDirection = "asc" | "desc";

export interface ListSort<F extends string> {
  field: F;
  direction: SortDirection;
}

export interface SortField<F extends string> {
  field: F;
  label: string;
  // The direction a field starts in when picked (e.g. newest or highest first).
  defaultDirection?: SortDirection;
}

// A row's value for one field. null/undefined means "nothing to show", which sorts last in
// either direction.
export type SortValue = string | number | null | undefined;

// Picking a field in the Sort menu: a new field starts in its default direction.
export function pickListSort<F extends string>(
  current: ListSort<F>,
  field: F,
  fields: SortField<F>[]
): ListSort<F> {
  if (current.field === field) return current;
  return { field, direction: fields.find((option) => option.field === field)?.defaultDirection ?? "asc" };
}

// Clicking a column header: the sorted column flips its direction, another one starts in its
// default.
export function nextListSort<F extends string>(
  current: ListSort<F>,
  field: F,
  fields: SortField<F>[]
): ListSort<F> {
  if (current.field === field) return { field, direction: current.direction === "asc" ? "desc" : "asc" };
  return pickListSort(current, field, fields);
}

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

// The rows in the sort's order, empty values last either way and ties by name A-Z.
export function sortRows<T, F extends string>(
  rows: readonly T[],
  sort: ListSort<F>,
  valueOf: Record<F, (row: T) => SortValue>,
  nameOf: (row: T) => string
): T[] {
  const read = valueOf[sort.field];
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row) => ({ row, value: read(row) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === undefined || a.value === "";
      const bEmpty = b.value === null || b.value === undefined || b.value === "";
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      let order = 0;
      if (!aEmpty) {
        order =
          typeof a.value === "number" && typeof b.value === "number"
            ? a.value - b.value
            : compareText(String(a.value), String(b.value));
      }
      return sign * order || compareText(nameOf(a.row), nameOf(b.row));
    })
    .map(({ row }) => row);
}

// Owned + wishlisted, owned, wishlisted; nothing for neither (last either way). Same order as
// the game lists' Library column.
export function libraryRank(row: { owned: boolean; wishlisted: boolean }): number | null {
  if (row.owned && row.wishlisted) return 0;
  if (row.owned) return 1;
  if (row.wishlisted) return 2;
  return null;
}
