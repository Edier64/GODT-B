export interface AuditEventPort {
  record(input: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export const AUDIT_EVENT_PORT = Symbol("AUDIT_EVENT_PORT");
