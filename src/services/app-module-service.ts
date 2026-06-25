import type { CaseTypeConfig } from "../models/case-type.js";
import { loadCaseTypeRegistry } from "./case-type-registry-service.js";

export type AppModuleCode =
  | "private_employee"
  | "executive_complex"
  | "batch_termination"
  | "honorarios"
  | "public_sector";

export interface AppModuleDefinition {
  code: AppModuleCode;
  label: string;
  description: string;
  stage: number;
  advanced?: boolean;
}

export const APP_MODULES: AppModuleDefinition[] = [
  {
    code: "private_employee",
    label: "Trabajador empresa privada",
    description: "Empleados regidos por el Código del Trabajo",
    stage: 1,
  },
  {
    code: "executive_complex",
    label: "Ejecutivo / indemnización compleja",
    description: "Cláusulas contractuales, Art. 17 N°13 LIR e IUSC reliquidado",
    stage: 2,
    advanced: true,
  },
  {
    code: "batch_termination",
    label: "Batch termination / varios trabajadores",
    description: "Cálculo masivo con totales consolidados y comparación de escenarios",
    stage: 2,
    advanced: true,
  },
  {
    code: "honorarios",
    label: "Contrato a honorarios",
    description: "Prestadores de servicios y riesgo de relación laboral",
    stage: 3,
  },
  {
    code: "public_sector",
    label: "Sector público",
    description: "Funcionarios, contrata y estatutos administrativos",
    stage: 4,
  },
];

export function resolveAppModule(config: CaseTypeConfig): AppModuleCode {
  if (config.code === "SPECIAL_HONORARIOS") return "honorarios";
  if (config.code === "SPECIAL_PUBLIC_SECTOR") return "public_sector";
  return "private_employee";
}

export function listAppModules(): Array<
  AppModuleDefinition & {
    case_types: Array<{
      code: string;
      label: string;
      description: string;
      stage_route: string;
      example_file?: string;
      menu_group: string;
    }>;
  }
> {
  const registry = loadCaseTypeRegistry();

  return APP_MODULES.map((module) => {
    if (module.advanced) {
      return { ...module, case_types: [] };
    }
    return {
      ...module,
      case_types: registry.case_types
        .filter((ct) => resolveAppModule(ct) === module.code)
        .map((ct) => ({
          code: ct.code,
          label: ct.label,
          description: ct.description,
          stage_route: ct.stage_route,
          example_file: ct.example_file,
          menu_group: ct.menu_group,
        })),
    };
  });
}

export function listCaseTypesForModule(moduleCode: AppModuleCode) {
  const module = listAppModules().find((m) => m.code === moduleCode);
  if (!module) return [];
  return module.case_types;
}
