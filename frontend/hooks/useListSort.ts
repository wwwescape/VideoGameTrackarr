import { useSessionState } from "./useSessionState";
import { nextListSort, pickListSort, type ListSort, type SortField } from "../utils/listSort";

// A list's sort, remembered for the browser session under `key`, with the two ways to change
// it: picking a field in the Sort menu and clicking a column header. A remembered field the
// page no longer offers falls back to `initial`.
export function useListSort<F extends string>(key: string, fields: SortField<F>[], initial: ListSort<F>) {
  const [stored, setSort] = useSessionState<ListSort<F>>(key, initial);
  const sort = fields.some((option) => option.field === stored?.field) ? stored : initial;
  return {
    sort,
    fields,
    pickField: (field: F) => setSort(pickListSort(sort, field, fields)),
    setDirection: (direction: ListSort<F>["direction"]) => setSort({ field: sort.field, direction }),
    clickHeader: (field: F) => setSort(nextListSort(sort, field, fields)),
  };
}

export type ListSortControl<F extends string> = ReturnType<typeof useListSort<F>>;
