import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type {
  CaseTypeConfig,
  CaseTypeInputSchema,
  CaseTypeRegistry,
  InputSchemaSection,
  StageRoute,
} from "../models/case-type.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let cachedRegistry: CaseTypeRegistry | null = null;

export function loadCaseTypeRegistry(): CaseTypeRegistry {
  if (cachedRegistry) return cachedRegistry;
  const path = join(packageRoot, "rules", "case_type_registry.yaml");
  cachedRegistry = parseYaml(readFileSync(path, "utf8")) as CaseTypeRegistry;
  return cachedRegistry;
}

export function getCaseType(code: string): CaseTypeConfig | undefined {
  return loadCaseTypeRegistry().case_types.find((t) => t.code === code);
}

export function listCaseTypesGrouped(): Array<{
  menu_group: string;
  items: Array<{
    code: string;
    label: string;
    description: string;
    stage_route: StageRoute;
    example_file?: string;
  }>;
}> {
  const registry = loadCaseTypeRegistry();
  const groups = new Map<string, CaseTypeConfig[]>();

  for (const ct of registry.case_types) {
    const list = groups.get(ct.menu_group) ?? [];
    list.push(ct);
    groups.set(ct.menu_group, list);
  }

  return [...groups.entries()].map(([menu_group, items]) => ({
    menu_group,
    items: items.map((t) => ({
      code: t.code,
      label: t.label,
      description: t.description,
      stage_route: t.stage_route,
      example_file: t.example_file,
    })),
  }));
}

function fieldKeysForCaseType(config: CaseTypeConfig): string[] {
  const registry = loadCaseTypeRegistry();
  const keys = new Set<string>();

  for (const path of config.required_fields) {
    const entry = Object.entries(registry.field_catalog).find(([, def]) => def.path === path);
    if (entry) keys.add(entry[0]);
  }

  for (const [, sectionKeys] of Object.entries(registry.section_fields)) {
    for (const key of sectionKeys) {
      const def = registry.field_catalog[key];
      if (!def) continue;
      if (config.required_fields.includes(def.path)) keys.add(key);
    }
  }

  return [...keys];
}

export function getInputSchema(code: string): CaseTypeInputSchema | null {
  const config = getCaseType(code);
  if (!config) return null;

  const registry = loadCaseTypeRegistry();
  const relevantKeys = fieldKeysForCaseType(config);
  const sections: InputSchemaSection[] = [];

  for (const [sectionId, sectionKeys] of Object.entries(registry.section_fields)) {
    const fields = sectionKeys
      .filter((key) => relevantKeys.includes(key))
      .map((key) => {
        const def = registry.field_catalog[key];
        return { key, ...def };
      });

    if (!fields.length) continue;

    const titles: Record<string, string> = {
      case_setup: "Case Setup",
      termination: "Termination",
      payroll: "Payroll",
      risk_flags: "Risk Flags",
    };

    sections.push({
      id: sectionId,
      title: titles[sectionId] ?? sectionId,
      fields,
    });
  }

  const evidenceSection: InputSchemaSection = {
    id: "evidence",
    title: "Evidence",
    fields: [],
    required_documents: config.required_evidence.map((key) => ({
      key,
      label: registry.evidence_labels[key] ?? key,
    })),
  };
  sections.push(evidenceSection);

  const warnings: string[] = [];
  if (config.stage_route === "STAGE3") {
    warnings.push("Caso de régimen especial: no usar cálculo final estándar sin revisión legal.");
  }
  if (config.stage_route === "BLOCKER") {
    warnings.push("Caso bloqueado: solo revisión de riesgo en modo borrador.");
  }

  const run_modes: Array<"draft" | "final_review"> =
    config.stage_route === "STAGE3" || config.stage_route === "BLOCKER"
      ? ["draft"]
      : ["draft", "final_review"];

  return {
    case_type: config.code,
    label: config.label,
    menu_group: config.menu_group,
    stage_route: config.stage_route,
    sections,
    run_modes,
    warnings,
    enabled_modules: config.enabled_modules,
  };
}

export function getExamplesDir(): string {
  return join(packageRoot, "examples");
}

export function loadExampleForCaseType(code: string): import("../models/case-input.js").CaseInput | null {
  const config = getCaseType(code);
  if (!config?.example_file) return null;
  const path = join(getExamplesDir(), config.example_file);
  const input = JSON.parse(readFileSync(path, "utf8")) as import("../models/case-input.js").CaseInput;
  input.case_type_code = code;
  return input;
}
