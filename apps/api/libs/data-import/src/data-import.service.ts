import { Injectable } from '@nestjs/common';
import { parse, type Parser, type Options as CsvParseOptions } from 'csv-parse';
import type { Readable } from 'node:stream';

@Injectable()
export class DataImportService {
  /** Create a parser with sane defaults for Adam4Eve CSVs (semicolon, relaxed quotes). */
  createCsvParser(opts?: CsvParseOptions): Parser {
    return parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ';',
      relax_quotes: true,
      ...opts,
    });
  }

  async streamCsv<TRow extends Record<string, string>>(
    input: Readable,
    onRow: (row: TRow) => Promise<void> | void,
    options?: CsvParseOptions,
  ): Promise<void> {
    const parser = this.createCsvParser({
      ...options,
      columns: true,
    });

    input.pipe(parser);

    for await (const anyRow of parser) {
      const row = anyRow as TRow;
      await onRow(row);
    }
  }

  /**
   * Return ISO dates for the last N days ending at "yesterday" (UTC) relative to an anchor date.
   *
   * - If no anchor is provided, the anchor is "today" (current behavior).
   * - The returned list ALWAYS ends at (anchor - 1 day), matching how Adam4EVE daily files work.
   *
   * Example:
   * - anchorDateIso = "2026-01-10", n=3 => ["2026-01-07","2026-01-08","2026-01-09"]
   */
  getLastNDates(n: number, anchorDateIso?: string | Date): string[] {
    const dates: string[] = [];
    const anchor =
      anchorDateIso instanceof Date
        ? new Date(anchorDateIso)
        : anchorDateIso
          ? new Date(`${anchorDateIso}T00:00:00.000Z`)
          : new Date();

    // normalize anchor to UTC midnight and move to "yesterday" relative to anchor
    anchor.setUTCHours(0, 0, 0, 0);
    anchor.setUTCDate(anchor.getUTCDate() - 1);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(anchor);
      d.setUTCDate(anchor.getUTCDate() - i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }

  /** Simple batcher: flush when buffer reaches `size`. */
  createBatcher<T>(opts: {
    size: number;
    flush: (items: T[]) => Promise<void>;
  }) {
    let buf: T[] = [];
    return {
      async push(item: T) {
        buf.push(item);
        if (buf.length >= opts.size) {
          const copy = buf;
          buf = [];
          await opts.flush(copy);
        }
      },
      async finish() {
        if (buf.length) {
          const copy = buf;
          buf = [];
          await opts.flush(copy);
        }
      },
    };
  }
}
