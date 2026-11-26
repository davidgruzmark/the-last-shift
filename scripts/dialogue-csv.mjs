import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

export const UTF8_BOM = '\uFEFF';
export const DEFAULT_CSV_PATH = path.resolve(process.cwd(), 'content/dialogue.csv');
export const DEFAULT_TRANSLATIONS_PATH = path.resolve(process.cwd(), 'src/i18n/translations.ts');
export const CSV_HEADERS = ['key', 'category', 'speaker_hint', 'en', 'he', 'notes'];

/**
 * Loads TRANSLATIONS object from a TypeScript translations module using the TypeScript compiler.
 */
export function loadTranslationsFromTs(tsPath = DEFAULT_TRANSLATIONS_PATH) {
  const source = fs.readFileSync(tsPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });

  const exportsObj = {};
  const moduleObj = { exports: exportsObj };
  const context = vm.createContext({
    exports: exportsObj,
    module: moduleObj,
  });
  vm.runInContext(transpiled.outputText, context, { filename: tsPath });

  const translations = moduleObj.exports.TRANSLATIONS;
  if (!translations || typeof translations !== 'object' || !translations.en || !translations.he) {
    throw new Error(`Invalid TRANSLATIONS export in ${tsPath}`);
  }
  return translations;
}

/**
 * Infers a clean category and speaker hint from a translation key.
 */
export function inferRowMetadata(key) {
  const parts = String(key).split('.');
  const category = parts[0] || 'general';
  let speakerHint = '';

  const lower = key.toLowerCase();
  if (lower.startsWith('shiran.') || lower.includes('.shiran')) {
    speakerHint = 'SHIRAN';
  } else if (lower.startsWith('friends.msg.david')) {
    speakerHint = 'DAVID';
  } else if (lower.startsWith('friends.msg.mor')) {
    speakerHint = 'MOR';
  } else if (lower.startsWith('friends.msg.lior')) {
    speakerHint = 'LIOR';
  } else if (lower.startsWith('friends.msg.kfir') || lower.startsWith('dialogue.')) {
    speakerHint = 'KFIR';
  } else if (lower.includes('.danny')) {
    speakerHint = 'DANNY';
  } else if (lower.includes('.maya')) {
    speakerHint = 'MAYA';
  } else if (lower.includes('.yossi')) {
    speakerHint = 'YOSSI';
  } else if (lower.includes('.manager') || lower.startsWith('call.')) {
    speakerHint = 'SHIFT MANAGER';
  } else if (lower.startsWith('m') && /^m\d+\./.test(lower)) {
    speakerHint = 'MISSION';
  }

  return { category, speakerHint };
}

/**
 * Escapes a single cell for RFC-4180 CSV serialization.
 */
export function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes row objects into UTF-8 BOM CSV text.
 */
export function serializeCsv(rows, headers = CSV_HEADERS) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    const cells = headers.map((col) => escapeCsvCell(row[col] ?? ''));
    lines.push(cells.join(','));
  }
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * Parses RFC-4180 CSV content (handles quotes, doubled quotes, commas, and multiline cells).
 * Enforces UTF-8 BOM presence when checkBom is enabled.
 */
export function parseCsv(rawText, { checkBom = true } = {}) {
  if (typeof rawText !== 'string' || rawText.length === 0) {
    return { hasBom: false, headers: [], rows: [], errors: ['CSV file is empty'] };
  }

  const hasBom = rawText.startsWith(UTF8_BOM);
  const errors = [];
  if (checkBom && !hasBom) {
    errors.push('Missing UTF-8 BOM (\\uFEFF) at start of CSV — required for Hebrew compatibility.');
  }

  const text = hasBom ? rawText.slice(1) : rawText;
  const records = [];
  let currentField = '';
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      if (currentField.length > 0) {
        errors.push(`Unexpected quote inside unquoted field near character ${i}`);
      }
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      records.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    errors.push('Unterminated quoted CSV field at end of file.');
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    records.push(currentRow);
  }

  if (records.length === 0) {
    errors.push('CSV contains no header row.');
    return { hasBom, headers: [], rows: [], errors };
  }

  const headers = records[0].map((h) => h.trim());
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const cols = records[r];
    if (cols.length === 1 && cols[0] === '') continue;
    if (cols.length !== headers.length) {
      errors.push(
        `Row ${r + 1}: expected ${headers.length} columns (${headers.join(', ')}), got ${cols.length}.`,
      );
      continue;
    }
    const obj = { __line: r + 1 };
    headers.forEach((h, idx) => {
      obj[h] = cols[idx];
    });
    rows.push(obj);
  }

  return { hasBom, headers, rows, errors };
}

/**
 * Extracts interpolation tokens like {name}, {count}, {total} sorted consistently.
 */
export function extractPlaceholders(text) {
  const matches = String(text ?? '').match(/\{[A-Za-z0-9_]+\}/g);
  return matches ? [...matches].sort() : [];
}

/**
 * Validates parsed CSV structure, EN/HE completeness, placeholder parity, and locked lines.
 */
export function validateDialogueCsv(rawText, options = {}) {
  const { requireShiranM9 = true, existingTranslations = null } = options;
  const parsed = parseCsv(rawText, { checkBom: true });
  const errors = [...parsed.errors];
  const warnings = [];

  for (const requiredCol of ['key', 'en', 'he']) {
    if (!parsed.headers.includes(requiredCol)) {
      errors.push(`Missing required CSV header column: "${requiredCol}".`);
    }
  }

  if (errors.length > 0 && parsed.rows.length === 0) {
    return { valid: false, errors, warnings, rows: [] };
  }

  const seenKeys = new Set();
  for (const row of parsed.rows) {
    const line = row.__line ?? '?';
    const key = String(row.key ?? '').trim();
    const en = String(row.en ?? '');
    const he = String(row.he ?? '');

    if (!key) {
      errors.push(`Row ${line}: empty translation key.`);
      continue;
    }
    if (seenKeys.has(key)) {
      errors.push(`Row ${line}: duplicate key "${key}".`);
      continue;
    }
    seenKeys.add(key);

    if (en.trim().length === 0) {
      errors.push(`Row ${line} (${key}): empty English ("en") text.`);
    }
    if (he.trim().length === 0) {
      errors.push(`Row ${line} (${key}): empty Hebrew ("he") text.`);
    }

    const enTokens = extractPlaceholders(en);
    const heTokens = extractPlaceholders(he);
    if (JSON.stringify(enTokens) !== JSON.stringify(heTokens)) {
      errors.push(
        `Row ${line} (${key}): placeholder mismatch — en has [${enTokens.join(', ')}], he has [${heTokens.join(', ')}].`,
      );
    }

    if (key === 'shiran.msg.m9' && he !== 'מתי אתה חוזר הביתה?') {
      errors.push(
        `Row ${line} (shiran.msg.m9): Hebrew text must stay verbatim 'מתי אתה חוזר הביתה?'.`,
      );
    }
  }

  if (requireShiranM9 && !seenKeys.has('shiran.msg.m9')) {
    errors.push('Missing required key "shiran.msg.m9".');
  }

  if (existingTranslations) {
    for (const existingKey of Object.keys(existingTranslations.en ?? {})) {
      if (!seenKeys.has(existingKey)) {
        warnings.push(`Key "${existingKey}" exists in translations.ts but is missing from CSV.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rows: parsed.rows,
  };
}

/**
 * Exports translations.ts entries to a UTF-8 BOM CSV file, preserving any existing notes column.
 */
export function exportTranslationsToCsv(
  tsPath = DEFAULT_TRANSLATIONS_PATH,
  csvPath = DEFAULT_CSV_PATH,
) {
  const translations = loadTranslationsFromTs(tsPath);
  const enKeys = Object.keys(translations.en);
  const heKeys = new Set(Object.keys(translations.he));

  const existingNotes = new Map();
  if (fs.existsSync(csvPath)) {
    const prevParsed = parseCsv(fs.readFileSync(csvPath, 'utf8'), { checkBom: false });
    for (const row of prevParsed.rows) {
      if (row.key && row.notes) {
        existingNotes.set(row.key, row.notes);
      }
    }
  }

  const missingInHe = enKeys.filter((k) => !heKeys.has(k));
  if (missingInHe.length > 0) {
    throw new Error(`Cannot export: Hebrew is missing keys: ${missingInHe.join(', ')}`);
  }

  const rows = enKeys.map((key) => {
    const meta = inferRowMetadata(key);
    return {
      key,
      category: meta.category,
      speaker_hint: meta.speakerHint,
      en: translations.en[key],
      he: translations.he[key],
      notes: existingNotes.get(key) ?? '',
    };
  });

  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  const csvContent = serializeCsv(rows, CSV_HEADERS);
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  return { count: rows.length, csvPath };
}

/**
 * Formats regenerated src/i18n/translations.ts TypeScript source from validated rows.
 */
export function renderTranslationsTs(rows) {
  const enLines = rows.map((r) => `    ${JSON.stringify(r.key)}: ${JSON.stringify(r.en)},`);
  const heLines = rows.map((r) => `    ${JSON.stringify(r.key)}: ${JSON.stringify(r.he)},`);
  return [
    "export type LanguageCode = 'en' | 'he';",
    '',
    'export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {',
    '  en: {',
    ...enLines,
    '  },',
    '  he: {',
    ...heLines,
    '  },',
    '};',
    '',
  ].join('\n');
}

/**
 * Validates CSV first and atomically regenerates translations.ts only when valid.
 */
export function importCsvToTranslations(
  csvPath = DEFAULT_CSV_PATH,
  tsPath = DEFAULT_TRANSLATIONS_PATH,
  options = {},
) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  const rawCsv = fs.readFileSync(csvPath, 'utf8');
  const existing =
    options.checkExisting && fs.existsSync(tsPath) ? loadTranslationsFromTs(tsPath) : null;
  const validation = validateDialogueCsv(rawCsv, {
    requireShiranM9: options.requireShiranM9 ?? true,
    existingTranslations: existing,
  });

  if (!validation.valid) {
    const err = new Error(
      `CSV validation failed (${validation.errors.length} errors) — translations.ts was NOT modified:\n- ${validation.errors.join('\n- ')}`,
    );
    err.validationErrors = validation.errors;
    throw err;
  }

  const tsContent = renderTranslationsTs(validation.rows);
  fs.mkdirSync(path.dirname(tsPath), { recursive: true });
  fs.writeFileSync(tsPath, tsContent, 'utf8');
  return { count: validation.rows.length, tsPath, warnings: validation.warnings };
}

function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  let csvPath = DEFAULT_CSV_PATH;
  let tsPath = DEFAULT_TRANSLATIONS_PATH;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--csv' && rest[i + 1]) {
      csvPath = path.resolve(rest[++i]);
    } else if (rest[i] === '--ts' && rest[i + 1]) {
      tsPath = path.resolve(rest[++i]);
    }
  }
  return { command, csvPath, tsPath };
}

function runCli() {
  const { command, csvPath, tsPath } = parseCliArgs(process.argv.slice(2));
  if (command === 'export') {
    const res = exportTranslationsToCsv(tsPath, csvPath);
    console.log(`Exported ${res.count} bilingual keys with UTF-8 BOM to ${res.csvPath}`);
    return;
  }

  if (command === 'validate') {
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found: ${csvPath}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(csvPath, 'utf8');
    const existing = fs.existsSync(tsPath) ? loadTranslationsFromTs(tsPath) : null;
    const res = validateDialogueCsv(raw, {
      requireShiranM9: true,
      existingTranslations: existing,
    });
    if (!res.valid) {
      console.error(`Dialogue CSV validation FAILED (${res.errors.length} error(s)):`);
      for (const e of res.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    if (res.warnings.length > 0) {
      console.warn(`Dialogue CSV warnings (${res.warnings.length}):`);
      for (const w of res.warnings) console.warn(`  - ${w}`);
    }
    console.log(`Dialogue CSV valid (${res.rows.length} keys, UTF-8 BOM verified).`);
    return;
  }

  if (command === 'import') {
    const res = importCsvToTranslations(csvPath, tsPath, {
      requireShiranM9: true,
      checkExisting: true,
    });
    if (res.warnings.length > 0) {
      console.warn(`Dialogue CSV import warnings (${res.warnings.length}):`);
      for (const w of res.warnings) console.warn(`  - ${w}`);
    }
    console.log(`Imported ${res.count} validated keys into ${res.tsPath}`);
    return;
  }

  console.error('Usage: node scripts/dialogue-csv.mjs <export|validate|import> [--csv path] [--ts path]');
  process.exit(1);
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  try {
    runCli();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
