import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CSV_PATH,
  DEFAULT_TRANSLATIONS_PATH,
  UTF8_BOM,
  exportTranslationsToCsv,
  importCsvToTranslations,
  loadTranslationsFromTs,
  parseCsv,
  serializeCsv,
  validateDialogueCsv,
} from '../scripts/dialogue-csv.mjs';
import { TRANSLATIONS } from '../src/i18n/translations';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kfir-csv-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('Phase 6.3.2B UTF-8 BOM CSV Dialogue Pipeline', () => {
  it('writes content/dialogue.csv with UTF-8 BOM bytes and passes full validation', () => {
    expect(fs.existsSync(DEFAULT_CSV_PATH)).toBe(true);
    const bytes = fs.readFileSync(DEFAULT_CSV_PATH);
    // Exact UTF-8 BOM bytes EF BB BF for Excel Hebrew compatibility
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);

    const raw = bytes.toString('utf8');
    const result = validateDialogueCsv(raw, {
      requireShiranM9: true,
      existingTranslations: TRANSLATIONS,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rows.length).toBe(Object.keys(TRANSLATIONS.en).length);

    const shiranM9 = result.rows.find((r) => r.key === 'shiran.msg.m9');
    expect(shiranM9?.he).toBe('מתי אתה חוזר הביתה?');
  });

  it('supports lossless export -> edit -> import round-trip preserving quotes, commas, and Hebrew', () => {
    const dir = makeTempDir();
    const csvPath = path.join(dir, 'dialogue.csv');
    const outTsPath = path.join(dir, 'translations.ts');

    const exported = exportTranslationsToCsv(DEFAULT_TRANSLATIONS_PATH, csvPath);
    expect(exported.count).toBe(Object.keys(TRANSLATIONS.en).length);

    // Edit one line with commas & quotes inside text and add a translator note
    const parsed = parseCsv(fs.readFileSync(csvPath, 'utf8'), { checkBom: true });
    expect(parsed.hasBom).toBe(true);
    const targetRow = parsed.rows.find((r) => r.key === 'hud.badge')!;
    targetRow.en = 'IKEA, "SECURITY"';
    targetRow.he = 'אבטחה, "איקאה"';
    targetRow.notes = 'Keep uppercase in EN';

    fs.writeFileSync(csvPath, serializeCsv(parsed.rows), 'utf8');

    const imported = importCsvToTranslations(csvPath, outTsPath, { checkExisting: false });
    expect(imported.count).toBe(exported.count);

    const reloaded = loadTranslationsFromTs(outTsPath);
    expect(reloaded.en['hud.badge']).toBe('IKEA, "SECURITY"');
    expect(reloaded.he['hud.badge']).toBe('אבטחה, "איקאה"');
    expect(reloaded.he['shiran.msg.m9']).toBe('מתי אתה חוזר הביתה?');
    expect(reloaded.en['m3.title']).toBe(TRANSLATIONS.en['m3.title']);
    expect(reloaded.he['m3.title']).toBe(TRANSLATIONS.he['m3.title']);
  });

  it('rejects missing BOM, duplicate keys, empty values, placeholder mismatches, and refuses to overwrite', () => {
    const dir = makeTempDir();
    const outTsPath = path.join(dir, 'translations.ts');
    const sentinel = '// DO NOT OVERWRITE\n';
    fs.writeFileSync(outTsPath, sentinel, 'utf8');

    // 1. Missing BOM
    const noBomCsv = 'key,category,speaker_hint,en,he,notes\r\nshiran.msg.m9,shiran,SHIRAN,When are you coming home?,מתי אתה חוזר הביתה?,\r\n';
    expect(validateDialogueCsv(noBomCsv).valid).toBe(false);

    // 2. Placeholder mismatch + duplicate key + empty he
    const badCsv = serializeCsv([
      {
        key: 'shiran.msg.m9',
        category: 'shiran',
        speaker_hint: 'SHIRAN',
        en: 'When are you coming home?',
        he: 'מתי אתה חוזר הביתה?',
        notes: '',
      },
      {
        key: 'mission.banner.started',
        category: 'mission',
        speaker_hint: '',
        en: 'MISSION {num} STARTED',
        he: 'המשימה החלה', // missing {num}
        notes: '',
      },
      {
        key: 'hud.title',
        category: 'hud',
        speaker_hint: '',
        en: 'Title',
        he: '',
        notes: '',
      },
      {
        key: 'hud.title',
        category: 'hud',
        speaker_hint: '',
        en: 'Title 2',
        he: 'כותרת',
        notes: '',
      },
    ]);
    expect(badCsv.startsWith(UTF8_BOM)).toBe(true);
    const badResult = validateDialogueCsv(badCsv);
    expect(badResult.valid).toBe(false);
    expect(badResult.errors.some((e) => e.includes('placeholder mismatch'))).toBe(true);
    expect(badResult.errors.some((e) => e.includes('duplicate key'))).toBe(true);
    expect(badResult.errors.some((e) => e.includes('empty Hebrew'))).toBe(true);

    // 3. Altered shiran.msg.m9
    const badShiranCsv = serializeCsv([
      {
        key: 'shiran.msg.m9',
        category: 'shiran',
        speaker_hint: 'SHIRAN',
        en: 'When are you coming home?',
        he: 'מתי אתה מגיע?',
        notes: '',
      },
    ]);
    expect(validateDialogueCsv(badShiranCsv).valid).toBe(false);

    const badCsvPath = path.join(dir, 'bad.csv');
    fs.writeFileSync(badCsvPath, badCsv, 'utf8');
    expect(() => importCsvToTranslations(badCsvPath, outTsPath)).toThrow(/NOT modified/);
    expect(fs.readFileSync(outTsPath, 'utf8')).toBe(sentinel);
  });
});
