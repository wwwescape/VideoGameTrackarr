import type { ReportedGame } from "../api/types";

// Splits CSV text into rows of cells: commas or semicolons (spreadsheets in many locales
// export with ;), double quotes around cells that contain them, "" for a quote inside.
export function parseCsv(text: string): string[][] {
  const delimiter =
    (text.split("\n")[0].match(/;/g) ?? []).length > (text.split("\n")[0].match(/,/g) ?? []).length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

// A CSV connector's file: a "name" column (or "title"), optionally "igdb_id" and "id" (the
// file's own id for the game; the name otherwise). Without a header row, the first column is
// the name. Rows with no name are skipped.
export function gamesFromCsv(text: string): ReportedGame[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ""));
  const hasHeader = header.includes("name") || header.includes("title");
  const column = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const nameAt = hasHeader ? column("name", "title") : 0;
  const igdbAt = hasHeader ? column("igdbid", "igdb") : -1;
  const idAt = hasHeader ? column("id") : -1;
  return (hasHeader ? rows.slice(1) : rows).flatMap((row) => {
    const name = row[nameAt];
    if (!name) return [];
    const igdbId = igdbAt >= 0 && /^\d+$/.test(row[igdbAt] ?? "") ? Number(row[igdbAt]) : undefined;
    return [{ id: (idAt >= 0 && row[idAt]) || name, name, ...(igdbId ? { igdbId } : {}) }];
  });
}
