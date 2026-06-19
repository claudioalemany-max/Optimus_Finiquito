import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { CaseCatalog, Ruleset } from "../models/ruleset.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadRuleset(version = "2026-06"): Ruleset {
  const path = join(packageRoot, "rules", `chile_finiquito_rules.v${version}.yaml`);
  return parseYaml(readFileSync(path, "utf8")) as Ruleset;
}

export function loadCaseCatalog(): CaseCatalog {
  const path = join(packageRoot, "rules", "case_catalog.yaml");
  return parseYaml(readFileSync(path, "utf8")) as CaseCatalog;
}

export function rulesetHash(rules: Ruleset): string {
  return createHash("sha256").update(JSON.stringify(rules)).digest("hex").slice(0, 16);
}
