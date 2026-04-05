#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOBILE_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(MOBILE_ROOT, 'config', 'stylesheet-guard-baseline.json');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '.expo', 'android', 'ios', 'dist', 'build']);

const RULES = [
  {
    key: 'react-native-stylesheet-import',
    regex: /import\s*\{[^}]*\bStyleSheet\b[^}]*}\s*from\s*['"]react-native['"]/gms,
    message: "Forbidden StyleSheet import from 'react-native'.",
  },
  {
    key: 'stylesheet-create',
    regex: /\bStyleSheet\s*\.\s*create\s*\(/g,
    message: 'Forbidden use of StyleSheet.create().',
  },
  {
    key: 'jsx-style-prop',
    // Match only JSX style props (`style={...}`), not HTML style attributes in template strings.
    regex: /\bstyle\s*=\s*\{/g,
    message: 'Forbidden JSX style prop. Use NativeWind className instead.',
  },
];

const STYLE_PROP_ALLOWLIST = new Set([
  'components/report/SignaturePad.tsx:55',
  'components/swipeable-task-card.tsx:160',
  'components/task-detail-transition.tsx:52',
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function lineNumberFromIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

async function walkFiles(dirPath, collector) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      await walkFiles(absolutePath, collector);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }

    collector.push(absolutePath);
  }
}

async function findViolations() {
  const files = [];
  await walkFiles(MOBILE_ROOT, files);

  const violations = [];

  for (const absolutePath of files) {
    const source = await fs.readFile(absolutePath, 'utf8');
    const relativeFile = toPosixPath(path.relative(MOBILE_ROOT, absolutePath));

    for (const rule of RULES) {
      for (const match of source.matchAll(rule.regex)) {
        const index = match.index ?? 0;
        const line = lineNumberFromIndex(source, index);

        if (rule.key === 'jsx-style-prop') {
          const allowlistKey = `${relativeFile}:${line}`;
          if (STYLE_PROP_ALLOWLIST.has(allowlistKey)) {
            continue;
          }
        }

        const signature = `${rule.key}|${relativeFile}|${line}`;

        violations.push({
          signature,
          rule: rule.key,
          file: relativeFile,
          line,
          message: rule.message,
        });
      }
    }
  }

  violations.sort((a, b) => a.signature.localeCompare(b.signature));
  return violations;
}

async function readBaseline() {
  try {
    const content = await fs.readFile(BASELINE_PATH, 'utf8');
    const parsed = JSON.parse(content);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return new Set(entries);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function updateBaseline(violations) {
  const baselineDir = path.dirname(BASELINE_PATH);
  await fs.mkdir(baselineDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    entries: violations.map((item) => item.signature),
  };

  await fs.writeFile(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`Baseline saved: ${toPosixPath(path.relative(MOBILE_ROOT, BASELINE_PATH))}`);
  console.log(`Recorded violations: ${payload.entries.length}`);
}

async function checkViolations(violations) {
  const baseline = await readBaseline();

  if (!baseline) {
    console.error('Missing baseline file for stylesheet guard.');
    console.error('Run: pnpm guard:stylesheet:update-baseline');
    process.exitCode = 1;
    return;
  }

  const newViolations = violations.filter((item) => !baseline.has(item.signature));

  if (newViolations.length === 0) {
    console.log(`OK: No new violations. Current baseline entries: ${baseline.size}`);
    return;
  }

  console.error(`Found ${newViolations.length} new stylesheet violations:`);

  for (const item of newViolations) {
    console.error(`- ${item.file}:${item.line} [${item.rule}] ${item.message}`);
  }

  console.error('If this change is intentional, update baseline: pnpm guard:stylesheet:update-baseline');
  process.exitCode = 1;
}

async function main() {
  const shouldUpdateBaseline = process.argv.includes('--update-baseline');
  const violations = await findViolations();

  if (shouldUpdateBaseline) {
    await updateBaseline(violations);
    return;
  }

  await checkViolations(violations);
}

main().catch((error) => {
  console.error('Guard script failed:', error);
  process.exitCode = 1;
});

