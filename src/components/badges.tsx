import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n";
import type { Category, ReportStatus, Role, Severity, Wheelchair } from "@/lib/enums";
import { kindOf } from "@/lib/enums";
import { cn } from "@/lib/utils";

const KIND_COLORS = {
  barrier: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  facility: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  live: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
} as const;

export function CategoryBadge({ category }: { category: Category }) {
  const t = useT();
  return <Badge className={cn("border-transparent", KIND_COLORS[kindOf(category)])}>{t(`category.${category}`)}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useT();
  const variant = severity === "blocking" ? "destructive" : severity === "difficult" ? "secondary" : "outline";
  return <Badge variant={variant}>{t(`severity.${severity}`)}</Badge>;
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const t = useT();
  return <Badge variant={status === "active" ? "default" : "outline"}>{t(`status.${status}`)}</Badge>;
}

export function HiddenBadge({ hidden }: { hidden: boolean }) {
  const t = useT();
  return hidden ? <Badge variant="destructive">{t("common.hidden")}</Badge> : null;
}

export function RoleBadge({ role }: { role: Role }) {
  const t = useT();
  return <Badge variant={role === "user" ? "outline" : "secondary"}>{t(`role.${role}`)}</Badge>;
}

const WHEELCHAIR_COLORS: Record<Wheelchair, string> = {
  yes: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  limited: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  no: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  unknown: "",
};

export function WheelchairBadge({ value }: { value: Wheelchair }) {
  const t = useT();
  return (
    <Badge
      variant={value === "unknown" ? "outline" : "default"}
      className={cn(WHEELCHAIR_COLORS[value], value !== "unknown" && "border-transparent")}
    >
      {t(`wheelchair.${value}`)}
    </Badge>
  );
}
