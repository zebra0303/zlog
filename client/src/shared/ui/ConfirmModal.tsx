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
      <div className="mt-2 flex flex-col items-center gap-3 text-center sm:gap-4">
        <div className="rounded-full bg-[var(--color-primary)]/10 p-3 text-[var(--color-primary)]">
          <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8" />
        </div>
        <p className="text-base font-medium whitespace-pre-wrap text-[var(--color-text)] sm:text-lg">
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
