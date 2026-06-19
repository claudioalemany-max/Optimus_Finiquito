import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { BurdenOfProofRules, EvidenceRequirementsRules } from "../models/fix1.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadEvidenceRequirements(): EvidenceRequirementsRules {
  const path = join(packageRoot, "rules", "evidence_requirements_by_cause.yaml");
  return parseYaml(readFileSync(path, "utf8")) as EvidenceRequirementsRules;
}

export function loadBurdenOfProofRules(): BurdenOfProofRules {
  const path = join(packageRoot, "rules", "burden_of_proof_rules.yaml");
  return parseYaml(readFileSync(path, "utf8")) as BurdenOfProofRules;
}

export function loadCourtRiskRules(): {
  rules: Array<{ code: string; message: string; source?: string; applies_to_causes?: string[] }>;
} {
  const path = join(packageRoot, "rules", "court_risk_rules.yaml");
  return parseYaml(readFileSync(path, "utf8")) as {
    rules: Array<{ code: string; message: string; source?: string; applies_to_causes?: string[] }>;
  };
}
