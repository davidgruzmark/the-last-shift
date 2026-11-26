declare module 'node:fs' {
  export interface ByteBuffer extends Uint8Array {
    toString(encoding?: string): string;
  }
  const fs: {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf8'): string;
    readFileSync(path: string): ByteBuffer;
    writeFileSync(path: string, data: string, encoding?: 'utf8'): void;
    mkdtempSync(prefix: string): string;
    rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  };
  export default fs;
}

declare module 'node:os' {
  const os: {
    tmpdir(): string;
  };
  export default os;
}

declare module 'node:path' {
  const path: {
    join(...paths: string[]): string;
    resolve(...paths: string[]): string;
  };
  export default path;
}

declare module '../scripts/dialogue-csv.mjs' {
  export const UTF8_BOM: string;
  export const DEFAULT_CSV_PATH: string;
  export const DEFAULT_TRANSLATIONS_PATH: string;
  export const CSV_HEADERS: string[];

  export interface DialogueCsvRow {
    __line?: number;
    key: string;
    category?: string;
    speaker_hint?: string;
    en: string;
    he: string;
    notes?: string;
    [col: string]: unknown;
  }

  export interface CsvParseResult {
    hasBom: boolean;
    headers: string[];
    rows: DialogueCsvRow[];
    errors: string[];
  }

  export interface CsvValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    rows: DialogueCsvRow[];
  }

  export function loadTranslationsFromTs(
    tsPath?: string,
  ): Record<'en' | 'he', Record<string, string>>;
  export function inferRowMetadata(key: string): { category: string; speakerHint: string };
  export function escapeCsvCell(value: unknown): string;
  export function serializeCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string;
  export function parseCsv(rawText: string, options?: { checkBom?: boolean }): CsvParseResult;
  export function extractPlaceholders(text: string): string[];
  export function validateDialogueCsv(
    rawText: string,
    options?: {
      requireShiranM9?: boolean;
      existingTranslations?: Record<'en' | 'he', Record<string, string>> | null;
    },
  ): CsvValidationResult;
  export function exportTranslationsToCsv(
    tsPath?: string,
    csvPath?: string,
  ): { count: number; csvPath: string };
  export function renderTranslationsTs(rows: DialogueCsvRow[]): string;
  export function importCsvToTranslations(
    csvPath?: string,
    tsPath?: string,
    options?: { requireShiranM9?: boolean; checkExisting?: boolean },
  ): { count: number; tsPath: string; warnings: string[] };
}
