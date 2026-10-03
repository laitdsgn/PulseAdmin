import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";

type Props = {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this text to enable the confirm button. */
  typeToConfirm?: string;
  onConfirm: () => unknown;
};

/** Confirmation step for destructive actions (hide, block, delete…). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  typeToConfirm,
  onConfirm,
}: Props) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const blocked = typeToConfirm !== undefined && typed !== typeToConfirm;

  return (
    <AlertDialog onOpenChange={(open) => !open && setTyped("")}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {typeToConfirm !== undefined && (
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={typeToConfirm} autoFocus />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={() => void onConfirm()}
          >
            {confirmLabel ?? t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
