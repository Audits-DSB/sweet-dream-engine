import { api } from "@/lib/api";

export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
  entity: string;
  entityId: string;
  entityName: string;
  action: AuditAction;
  snapshot: Record<string, any>;
  endpoint: string;
  idField?: string;
}

const entityLabels: Record<string, string> = {
  client: "عميل",
  order: "طلب",
  delivery: "توصيل",
  supplier: "مورّد",
  material: "مادة",
  collection: "تحصيل",
  request: "طلب عميل",
  founder: "مؤسس",
  "founder-transaction": "معاملة مؤسس",
  "treasury-account": "حساب خزينة",
  "treasury-transaction": "معاملة خزينة",
  audits: "جرد",
  "client-inventory": "مخزون عميل",
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const now = new Date();
    const actionLabels: Record<AuditAction, string> = {
      create: "إنشاء",
      update: "تعديل",
      delete: "حذف",
    };

    const label = entityLabels[entry.entity] || entry.entity;
    const actionLabel = actionLabels[entry.action];

    await api.post("/notifications", {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: `audit_${entry.action}`,
      title: `${actionLabel} ${label}: ${entry.entityName}`,
      message: JSON.stringify({
        entity: entry.entity,
        entityId: entry.entityId,
        entityName: entry.entityName,
        action: entry.action,
        snapshot: entry.snapshot,
        endpoint: entry.endpoint,
        idField: entry.idField || "id",
      }),
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().slice(0, 5),
      read: false,
    });
  } catch {
    // Audit log failure should not block the main operation
  }
}
