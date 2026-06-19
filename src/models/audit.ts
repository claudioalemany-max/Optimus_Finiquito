export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
}

export interface AuditLog {
  case_id: string;
  entries: AuditEntry[];
}
