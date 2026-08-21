#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const errors = [];
const notes = [];

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "CHANGELOG.md",
  "config/upstream.lock.json",
  "docs/README.md",
  "docs/PRD.md",
  "docs/STATUS.md",
  "docs/UX_SPEC.md",
  "docs/CREATIVE_DIRECTION_PROFILE.md",
  "docs/PRODUCTION_WORKFLOW.md",
  "docs/ARCHITECTURE.md",
  "docs/DOMAIN_MODEL.md",
  "docs/API_CONTRACTS.md",
  "docs/MEDIA_PIPELINE.md",
  "docs/GPU_OPERATIONS.md",
  "docs/COST_MODEL.md",
  "docs/SECURITY_AND_RECOVERY.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/TEST_PLAN.md",
  "docs/TRACEABILITY.md",
  "docs/DECISIONS.md",
  "docs/UPSTREAM_INTEGRATION.md",
  "docs/CHANGE_CONTROL.md",
  "docs/SOURCES.md"
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
}

function walk(dir) {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "vendor"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function lineAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

for (const markdownFile of walk(root).filter((file) => extname(file).toLowerCase() === ".md")) {
  const text = readFileSync(markdownFile, "utf8");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (/^(https?:|mailto:|data:)/i.test(target) || target.startsWith("#")) continue;
    target = target.split("#", 1)[0].split("?", 1)[0];
    if (!target) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${relative(root, markdownFile)}:${lineAt(text, match.index)} has an invalid encoded link: ${target}`);
      continue;
    }
    const resolved = isAbsolute(target) ? target : resolve(dirname(markdownFile), target);
    if (!existsSync(resolved)) {
      errors.push(`${relative(root, markdownFile)}:${lineAt(text, match.index)} has a broken link: ${match[1]}`);
    }
  }
}

if (existsSync(join(root, "docs/PRD.md")) && existsSync(join(root, "docs/TRACEABILITY.md"))) {
  const prd = readFileSync(join(root, "docs/PRD.md"), "utf8");
  const traceability = readFileSync(join(root, "docs/TRACEABILITY.md"), "utf8");
  const definitions = [...prd.matchAll(/^\s*-\s+\*\*((?:FR|NFR)-\d{3})\b[^*]*:\*\*/gm)].map((match) => match[1]);
  const counts = new Map();
  for (const id of definitions) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts) {
    if (count !== 1) errors.push(`Requirement ${id} is defined ${count} times in docs/PRD.md`);
    if (!new RegExp(`\\b${id}\\b`).test(traceability)) errors.push(`Requirement ${id} is missing from docs/TRACEABILITY.md`);
  }
  if (definitions.length === 0) errors.push("No requirement definitions were found in docs/PRD.md");
  notes.push(`Requirements checked: ${definitions.length}`);
}

if (existsSync(join(root, "docs/DECISIONS.md"))) {
  const decisions = readFileSync(join(root, "docs/DECISIONS.md"), "utf8");
  const ids = [...decisions.matchAll(/^\|\s*((?:D|O)-\d{3})\s*\|/gm)].map((match) => match[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate decision/open-decision ID: ${id}`);
    seen.add(id);
  }
  notes.push(`Decision IDs checked: ${ids.length}`);
}

const lockPath = join(root, "config/upstream.lock.json");
if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    if (!/^[0-9a-f]{40}$/i.test(lock.commit ?? "")) errors.push("config/upstream.lock.json has an invalid commit SHA");
    const vendorPath = resolve(root, lock.path ?? "");
    if (!existsSync(vendorPath) || !statSync(vendorPath).isDirectory()) {
      errors.push(`Pinned upstream path does not exist: ${lock.path}`);
    } else {
      try {
        const actual = execFileSync("git", ["-C", vendorPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        if (actual.toLowerCase() !== String(lock.commit).toLowerCase()) {
          errors.push(`Upstream lock mismatch: lock=${lock.commit}, submodule=${actual}`);
        } else {
          notes.push(`Upstream lock matches: ${actual.slice(0, 12)}`);
        }
      } catch (error) {
        errors.push(`Could not inspect upstream Git commit: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`Could not parse config/upstream.lock.json: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error("Documentation checks failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Documentation checks passed.");
for (const note of notes) console.log(`- ${note}`);
