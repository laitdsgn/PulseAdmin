import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
import { useCities } from "@/lib/queries";

/** Multi-select of cities for a `city` account's scope. */
export function CityChecklist({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { t, lang } = useI18n();
  const { data: cities = [] } = useCities();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("users.cities")}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {cities.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.includes(c.id)}
              onCheckedChange={(checked) => onChange(checked ? [...value, c.id] : value.filter((v) => v !== c.id))}
            />
            {lang === "pl" ? c.name : c.nameEn}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("users.citiesHint")}</p>
    </fieldset>
  );
}

/** A random password that satisfies the backend's 12–128 rule. */
export const generatePassword = (length = 20) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.!@#";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};
