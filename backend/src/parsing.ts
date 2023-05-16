import { parse } from 'csv-parse/sync';

export function parseCsv(csv: string): any[] {
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
  });
}
