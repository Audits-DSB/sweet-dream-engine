import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading = false,
}: ConfirmDeleteDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-base">{title || t.confirmDelete || "تأكيد الحذف"}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground ltr:ms-0 rtl:ms-0 ps-0">
            {description || t.confirmDeleteDesc || "هل أنت متأكد من حذف هذا العنصر؟ يمكنك استعادته لاحقاً من سجل الأنشطة."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-1">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={loading}
            data-testid="button-confirm-delete"
          >
            {loading ? (t.deleting || "جارٍ الحذف...") : (t.confirmDeleteBtn || "نعم، احذف")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid="button-cancel-delete"
          >
            {t.cancel || "إلغاء"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
