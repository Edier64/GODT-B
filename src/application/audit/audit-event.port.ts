export interface AuditEventInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventPort {
  record(input: AuditEventInput): Promise<void>;
}

export const AUDIT_EVENT_PORT = Symbol("AUDIT_EVENT_PORT");
