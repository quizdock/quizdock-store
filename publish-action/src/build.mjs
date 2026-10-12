import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import {
  megabytes,
  questionCount,
  themeSlug,
  validateFiles,
  validateThemeFiles,
} from './validate.mjs';

export const TEMPLATE_NAME = 'quizdock-extensions';

/**
 * A fixed date for every entry, built from local fields: fflate writes the
 * zip's DOS time from local time, so the same files give the same bytes on
 * any machine, in any time zone.
 */
const ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0);

/**
 * Reads every quiz folder of `dir` (`<folder>/quiz.json` and `<folder>/media/`)
 * and every theme folder of `themesDir` (`<folder>/theme.json` and `media/`),
 * validates each one on its own, and writes to `outDir` a reproducible
 * `<slug>.quizdock.zip` per publishable quiz and `<slug>.quizdock-theme.zip`
 * per publishable theme, with their `index.json`. The
 * zips are built here: the repository holds the quizzes as files, readable
 * and diffable, never as archives. An invalid quiz is left out and reported;
 * the others are still published.
 *
 * @param {{
 *   dir: string, themesDir?: string, outDir: string, baseUrl: string, maxBytes: number,
 *   host: string, vendor: string, repository?: string,
 *   homepage?: string, issues?: string, now?: Date,
 * }} options
 */
export function buildIndex(options) {
  const { dir, outDir, baseUrl, maxBytes, host, vendor } = options;
  const notices = [];
  if (options.repository && options.repository !== TEMPLATE_NAME) {
    notices.push(
      `This repository is named "${options.repository}" rather than "${TEMPLATE_NAME}". Publishing works all the same; only the naming convention of the store is lost.`,
    );
  }

  const report = [];
  const valid = [];
  for (const { name, kind } of listEntries(dir)) {
    if (kind === 'file') {
      report.push({ file: name, path: name, errors: [strayFileMessage(name)], warnings: [] });
      continue;
    }
    // Annotations point at a file: the folder's manifest.
    const path = `${name}/quiz.json`;
    const files = readFolder(join(dir, name), 'quiz.json', maxBytes);
    if (!files) {
      report.push({
        file: name,
        path,
        errors: [
          `The folder weighs more than ${megabytes(maxBytes)}. In QuizDock, lighten or remove the quiz's heaviest media, then choose Export for publication again, unzip it and upload the new folder in place of this one.`,
        ],
        warnings: [],
      });
      continue;
    }
    const result = validateFiles(files);
    if (!result.ok) {
      report.push({ file: name, path, errors: result.errors, warnings: result.warnings });
      continue;
    }
    const zip = buildZip(files['quiz.json'], result.media);
    if (zip.length > maxBytes) {
      report.push({
        file: name,
        path,
        errors: [
          `The quiz weighs ${megabytes(zip.length)}, over the ${megabytes(maxBytes)} limit. In QuizDock, lighten or remove its heaviest media, then choose Export for publication again, unzip it and upload the new folder.`,
        ],
        warnings: result.warnings,
      });
      continue;
    }
    const entry = { file: name, path, slug: result.manifest.quiz.slug, errors: [], warnings: result.warnings };
    report.push(entry);
    valid.push({ entry, zip, manifest: result.manifest });
  }

  // Two folders, one slug: two versions of a quiz, or two quizzes with the
  // same title. Only the author can tell, so neither is published.
  const bySlug = Map.groupBy(valid, (v) => v.manifest.quiz.slug);
  const published = [];
  for (const [slug, group] of bySlug) {
    if (group.length > 1) {
      const names = group.map((v) => v.entry.file).join(', ');
      for (const v of group) {
        v.entry.errors.push(
          `Several folders carry the short name "${slug}" (${names}). If they are versions of the same quiz, delete the older folder. If they are different quizzes, give one of them another short name in QuizDock's Export for publication.`,
        );
      }
      continue;
    }
    published.push(group[0]);
  }

  mkdirSync(outDir, { recursive: true });
  const quizzes = published
    .sort((a, b) => a.manifest.quiz.slug.localeCompare(b.manifest.quiz.slug))
    .map(({ zip, manifest }) => {
      const { quiz } = manifest;
      const asset = `${quiz.slug}.quizdock.zip`;
      writeFileSync(join(outDir, asset), zip);
      return {
        kind: 'quiz',
        id: `${host}/${vendor}/${quiz.slug}`,
        slug: quiz.slug,
        url: `${baseUrl.replace(/\/$/, '')}/${asset}`,
        sha256: createHash('sha256').update(zip).digest('hex'),
        size: zip.length,
        bundleVersion: manifest.version ?? 0,
        title: quiz.title.trim(),
        description: quiz.description ?? null,
        language: quiz.language,
        tags: quiz.tags,
        license: quiz.license,
        questionCount: questionCount(manifest),
        updatedAt: quiz.updatedAt ?? null,
      };
    });

  const index = {
    format: 'quizdock/index',
    version: 1,
    source: {
      host,
      vendor,
      homepage: options.homepage ?? null,
      issues: options.issues ?? null,
    },
    generatedAt: (options.now ?? new Date()).toISOString(),
    quizzes,
    themes: options.themesDir ? buildThemes(options, report, outDir) : [],
  };
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  return { index, report, notices };
}

/**
 * The bundle as QuizDock reads it, always the same bytes for the same files
 * (with the fflate version the lockfile pins): entries sorted, a fixed date,
 * everything deflated at QuizDock's own level. Media are not all compressed
 * already: a video straight from a phone can shrink by half.
 */
export function buildZip(manifest, media, name = 'quiz.json') {
  const entries = { [name]: [manifest, { mtime: ZIP_DATE }] };
  for (const path of Object.keys(media).sort()) entries[path] = [media[path], { mtime: ZIP_DATE }];
  return zipSync(entries, { level: 6 });
}

/** What sits in the quizzes folder: quiz folders, and anything else to report. */
function listEntries(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return []; // the first run
    throw err;
  }
  return names
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => ({ name, kind: statSync(join(dir, name)).isDirectory() ? 'folder' : 'file' }));
}

function strayFileMessage(name) {
  if (name.toLowerCase().endsWith('.zip')) {
    return 'This is a zip. Unzip it on your computer, upload the folder you get into quizzes/, then delete this file.';
  }
  if (name === 'quiz.json') {
    return 'The quiz files were uploaded one by one. Upload the whole folder instead (the one you get by unzipping the export), then delete these files.';
  }
  return 'Only quiz folders belong in quizzes/. Delete this file.';
}

/**
 * The themes of `themesDir`, checked, zipped into `outDir` and reported into
 * `report` (`themes/<folder>`): the entries of the index's `themes`.
 */
function buildThemes(options, report, outDir) {
  const { themesDir, baseUrl, maxBytes, host, vendor } = options;
  const folder = themesDir.split(/[\\/]/).filter(Boolean).pop();
  const valid = [];
  for (const { name, kind } of listEntries(themesDir)) {
    const file = `${folder}/${name}`;
    if (kind === 'file') {
      report.push({ file, path: name, root: folder, errors: [strayThemeMessage(name)], warnings: [] });
      continue;
    }
    const path = `${name}/theme.json`;
    const files = readFolder(join(themesDir, name), 'theme.json', maxBytes);
    const result = files
      ? validateThemeFiles(files)
      : { ok: false, errors: [`The folder weighs more than ${megabytes(maxBytes)}. Lighten the theme's pictures or sounds in QuizDock, then export it again.`], warnings: [] };
    if (!result.ok) {
      report.push({ file, path, root: folder, errors: result.errors, warnings: result.warnings });
      continue;
    }
    const zip = buildZip(files['theme.json'], result.media, 'theme.json');
    const entry = { file, path, root: folder, errors: [], warnings: result.warnings };
    report.push(entry);
    if (zip.length > maxBytes) {
      entry.errors.push(`The theme weighs ${megabytes(zip.length)}, over the ${megabytes(maxBytes)} limit. Lighten its pictures or sounds in QuizDock, then export it again.`);
      continue;
    }
    valid.push({ entry, zip, manifest: result.manifest, slug: themeSlug(result.manifest.theme) });
  }
  const themes = [];
  for (const [slug, group] of Map.groupBy(valid, (v) => v.slug)) {
    if (group.length > 1) {
      const names = group.map((v) => v.entry.file).join(', ');
      for (const v of group) {
        v.entry.errors.push(`Several folders carry the short name "${slug}" (${names}). Delete the older one, or rename one of the themes in QuizDock and export it again.`);
      }
      continue;
    }
    const { zip, manifest } = group[0];
    const { theme } = manifest;
    const asset = `${slug}.quizdock-theme.zip`;
    writeFileSync(join(outDir, asset), zip);
    themes.push({
      kind: 'theme',
      id: `${host}/${vendor}/themes/${slug}`,
      slug,
      url: `${baseUrl.replace(/\/$/, '')}/${asset}`,
      sha256: createHash('sha256').update(zip).digest('hex'),
      size: zip.length,
      bundleVersion: manifest.version,
      name: theme.name.trim(),
      parent: theme.parent,
      license: theme.license,
      accessible: theme.accessibility?.status === 'compliant',
    });
  }
  return themes.sort((a, b) => a.slug.localeCompare(b.slug));
}

function strayThemeMessage(name) {
  if (name.toLowerCase().endsWith('.zip')) {
    return 'This is a zip. Unzip it on your computer, upload the folder you get into themes/, then delete this file.';
  }
  if (name === 'theme.json') {
    return 'The theme files were uploaded one by one. Upload the whole folder instead (the one you get by unzipping the export), then delete these files.';
  }
  return 'Only theme folders belong in themes/. Delete this file.';
}

/**
 * The manifest (`quiz.json`, `theme.json`) and the flat `media/` of a folder;
 * `null` when the folder holds more than `maxBytes` (nothing more is read).
 */
function readFolder(folder, manifestName, maxBytes) {
  const files = {};
  let total = 0;
  const add = (path, full) => {
    total += statSync(full).size;
    if (total > maxBytes) return false;
    files[path] = new Uint8Array(readFileSync(full));
    return true;
  };
  const manifest = join(folder, manifestName);
  try {
    if (statSync(manifest).isFile() && !add(manifestName, manifest)) return null;
  } catch {
    // no manifest: the validation says so
  }
  let media = [];
  try {
    media = readdirSync(join(folder, 'media'));
  } catch {
    // no media: fine for a quiz without images
  }
  for (const name of media.sort()) {
    const full = join(folder, 'media', name);
    if (!statSync(full).isFile()) continue;
    if (!add(`media/${name}`, full)) return null;
  }
  return files;
}

/** The report as Markdown: what was published, what was not and why. */
export function reportMarkdown({ index, report, notices }) {
  const lines = ['# Quiz publication', ''];
  for (const notice of notices) lines.push(`> ${notice}`, '');
  const failed = report.filter((r) => r.errors.length);
  const themes = index.themes?.length
    ? ` and **${index.themes.length}** theme(s)`
    : '';
  lines.push(`**${index.quizzes.length}** quiz(zes)${themes} published, **${failed.length}** not published.`, '');
  for (const r of report) {
    const status = r.errors.length ? '❌' : '✅';
    lines.push(`## ${status} ${r.file}`);
    for (const e of r.errors) lines.push(`- ${e}`);
    for (const w of r.warnings) lines.push(`- ⚠️ ${w}`);
    lines.push('');
  }
  if (report.length === 0) {
    lines.push('No quiz yet: unzip a QuizDock export and upload its folder into `quizzes`.');
  }
  return `${lines.join('\n')}\n`;
}

