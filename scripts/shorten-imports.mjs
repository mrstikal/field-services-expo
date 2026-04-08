#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const workspaceRoot = process.cwd();
const checkOnly = process.argv.includes("--check");

const appConfigs = [
  {
    root: path.join(workspaceRoot, "apps", "web"),
    aliases: [
      { prefix: "@/", dir: path.join(workspaceRoot, "apps", "web") },
      { prefix: "@lib/", dir: path.join(workspaceRoot, "apps", "web", "lib") },
      { prefix: "@components/", dir: path.join(workspaceRoot, "apps", "web", "components") },
      { prefix: "@shared/", dir: path.join(workspaceRoot, "packages", "shared-types") },
      { prefix: "@db/", dir: path.join(workspaceRoot, "packages", "db") }
    ]
  },
  {
    root: path.join(workspaceRoot, "apps", "mobile"),
    aliases: [
      { prefix: "@/", dir: path.join(workspaceRoot, "apps", "mobile") },
      { prefix: "@lib/", dir: path.join(workspaceRoot, "apps", "mobile", "lib") },
      { prefix: "@shared/", dir: path.join(workspaceRoot, "packages", "shared-types") }
    ]
  }
];

const validExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

function isInsideDir(target, dir) {
  const rel = path.relative(dir, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function normalizeImportPath(importPath, preserveExtension) {
  let result = toPosix(importPath);
  if (!preserveExtension) {
    for (const ext of sourceExtensions) {
      if (result.endsWith(ext)) {
        result = result.slice(0, -ext.length);
        break;
      }
    }
    if (result.endsWith("/index")) {
      result = result.slice(0, -"/index".length);
    }
  }
  return result;
}

function resolveModulePath(fromFile, rawSpecifier) {
  const basedir = path.dirname(fromFile);
  const candidateBase = path.resolve(basedir, rawSpecifier);

  if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
    return candidateBase;
  }

  for (const ext of validExtensions) {
    const withExt = `${candidateBase}${ext}`;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isDirectory()) {
    for (const ext of validExtensions) {
      const indexFile = path.join(candidateBase, `index${ext}`);
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        return indexFile;
      }
    }
  }

  return null;
}

function getBestAliasSpecifier(config, fromFile, rawSpecifier) {
  if (!rawSpecifier.startsWith("../")) {
    return null;
  }

  const resolved = resolveModulePath(fromFile, rawSpecifier);
  if (!resolved) {
    return null;
  }

  const preserveExtension = /\.[a-z0-9]+$/i.test(rawSpecifier);
  const candidates = [];

  for (const alias of config.aliases) {
    if (!isInsideDir(resolved, alias.dir)) {
      continue;
    }

    const relToAlias = path.relative(alias.dir, resolved);
    const normalizedRel = normalizeImportPath(relToAlias, preserveExtension);
    const suffix = normalizedRel ? normalizedRel : "";
    const aliasSpecifier = `${alias.prefix}${toPosix(suffix)}`;
    candidates.push(aliasSpecifier.replace(/\/$/, ""));
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return candidates[0];
}

function getConfigForFile(filePath) {
  return appConfigs.find((cfg) => isInsideDir(filePath, cfg.root));
}

function collectFiles(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build") {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

function isMockCall(expr) {
  if (!ts.isPropertyAccessExpression(expr)) {
    return false;
  }

  if (expr.name.text !== "mock") {
    return false;
  }

  if (!ts.isIdentifier(expr.expression)) {
    return false;
  }

  return expr.expression.text === "vi" || expr.expression.text === "jest";
}

function processFile(filePath) {
  const config = getConfigForFile(filePath);
  if (!config) {
    return { changed: false, content: null };
  }

  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const edits = [];

  function maybeQueueEdit(moduleLiteral) {
    const rawSpecifier = moduleLiteral.text;
    const nextSpecifier = getBestAliasSpecifier(config, filePath, rawSpecifier);
    if (!nextSpecifier || nextSpecifier === rawSpecifier) {
      return;
    }

    edits.push({
      start: moduleLiteral.getStart(sourceFile) + 1,
      end: moduleLiteral.getEnd() - 1,
      value: nextSpecifier
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      maybeQueueEdit(node.moduleSpecifier);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      maybeQueueEdit(node.moduleSpecifier);
    }

    if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport || isMockCall(callee)) {
        maybeQueueEdit(node.arguments[0]);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (edits.length === 0) {
    return { changed: false, content: null };
  }

  const sortedEdits = edits.sort((a, b) => b.start - a.start);
  let nextContent = content;
  for (const edit of sortedEdits) {
    nextContent = `${nextContent.slice(0, edit.start)}${edit.value}${nextContent.slice(edit.end)}`;
  }

  return { changed: true, content: nextContent };
}

const targets = appConfigs.flatMap((cfg) => collectFiles(cfg.root));
const changedFiles = [];

for (const filePath of targets) {
  const result = processFile(filePath);
  if (!result.changed) {
    continue;
  }

  changedFiles.push(filePath);
  if (!checkOnly) {
    fs.writeFileSync(filePath, result.content, "utf8");
  }
}

if (changedFiles.length === 0) {
  console.log("No imports to shorten.");
  process.exit(0);
}

for (const filePath of changedFiles) {
  console.log(path.relative(workspaceRoot, filePath));
}

if (checkOnly) {
  console.error(`Found ${changedFiles.length} file(s) with shorten-able imports.`);
  process.exit(1);
}

console.log(`Updated ${changedFiles.length} file(s).`);

