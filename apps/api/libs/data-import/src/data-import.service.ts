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
