import { useConfirm } from "./useConfirm";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useI18n } from "../i18n";
import { AlertCircle } from "lucide-react";

export function ConfirmModal() {
  const { isOpen, message, onConfirm, onCancel } = useConfirm();
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="flex flex-col items-center gap-4 py-4 text-center sm:py-6">
        <div className="rounded-full bg-[var(--color-primary)]/10 p-3 text-[var(--color-primary)]">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="text-lg font-medium whitespace-pre-wrap text-[var(--color-text)]">
          {message}
        </p>
        <div className="mt-4 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" className="sm:w-32" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button className="sm:w-32" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
