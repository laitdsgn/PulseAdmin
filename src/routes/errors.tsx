import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function ForbiddenPage() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("forbidden.title")}</h1>
      <p className="text-muted-foreground">{t("forbidden.body")}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/">{t("notFound.back")}</Link>
      </Button>
    </div>
  );
}

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/">{t("notFound.back")}</Link>
      </Button>
    </div>
  );
}
