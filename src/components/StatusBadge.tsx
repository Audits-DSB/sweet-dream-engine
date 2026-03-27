interface StatusBadgeProps {
  status: string;
  variant?: "default" | "success" | "warning" | "destructive" | "info" | "muted" | "primary";
}

const variantStyles: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
};

const statusVariantMap: Record<string, string> = {
  // General
  "Active": "success",
  "Inactive": "muted",
  "Enabled": "success",
  "Disabled": "muted",
  
  // Requests
  "Client Requested": "info",
  "Pending Review": "warning",
  "Approved": "success",
  "Rejected": "destructive",
  "Converted to Order": "primary",
  "Cancelled": "muted",
  
  // Orders
  "Draft": "muted",
  "Processing": "warning",
  "Confirmed": "info",
  "Awaiting Purchase": "warning",
  "Ready for Delivery": "primary",
  "Partially Delivered": "warning",
  "Delivered": "success",
  "Invoiced": "info",
  "Closed": "muted",
  
  // Collections
  "Awaiting Confirmation": "warning",
  "Partially Paid": "warning",
  "Installment Active": "info",
  "Paid": "success",
  "Overdue": "destructive",
  "Written Off": "muted",

  // Inventory
  "In Stock": "success",
  "Low Stock": "warning",
  "Expired": "destructive",
  "Depleted": "muted",

  // Audits
  "Completed": "success",
  "Discrepancy": "warning",
  "Scheduled": "info",
  "In Progress": "primary",
};

const statusLabelMap: Record<string, string> = {
  "Processing": "قيد المعالجة",
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolvedVariant = variant || statusVariantMap[status] || "default";
  const styles = variantStyles[resolvedVariant] || variantStyles.default;
  const label = statusLabelMap[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
