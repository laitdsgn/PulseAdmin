# AGENTS.md – PulseAdmin

Panel personelu Pulse (React SPA serwowane przez `Bun.serve`). Opis architektury, konfiguracji i uruchomienia: [`README.md`](./README.md). Ogólne zasady Bun: [`CLAUDE.md`](./CLAUDE.md).

## Zasady

- Panel woła API **tylko względnymi ścieżkami `/v1/...`** przez `apiFetch` / `apiDownload` (`src/lib/api.ts`); serwer panelu przekazuje je do backendu (`src/proxy.ts`). Nie wpisuj adresu backendu do frontendu.
- Tokeny obsługuje wyłącznie `src/lib/tokens.ts`. Nie wołaj `/v1/admin/auth/refresh` z innego miejsca – równoległe odświeżenia kończą się `refresh_reuse` (wylogowanie wszystkich sesji), a limit to 10/min na IP.
- Kontrakt: typy w `src/lib/types.ts` i enumy w `src/lib/enums.ts` odpowiadają `PulseBackend/docs/reference/` (`models.md`, `enumerations.md`). Zmiana endpointu w backendzie = zmiana docs backendu + typów i widoków tutaj.
- Uprawnienia widoków: `src/lib/roles.ts` musi odpowiadać strażnikom w `PulseBackend/src/routes/admin.ts`, `community.ts` (moderacja) i `city.ts`.
- Każdy tekst UI przez `useT()` / `useI18n()` z kluczem w `src/i18n/pl.ts` **i** `src/i18n/en.ts`.
- Listy: `useInfiniteList` (`src/lib/queries.ts`) + `DataTable`; klucz zapytania to `[ścieżka, filtry]`, więc po mutacji odśwież przez `useInvalidate()(ścieżka)`.
- Filtry trzymaj w URL (`useUrlFilters`).
- Akcje destrukcyjne (ukrycie, blokada, usunięcie) przez `ConfirmDialog`.
- `src/components/ui/` to wygenerowane komponenty shadcn (`bunx --bun shadcn@latest add …`). Po dodaniu nowego sprawdź importy: `cn` ma pochodzić z `@/lib/utils`, a motyw z `@/lib/theme` (nie `next-themes`).
- Formatowanie: prettier (`.prettierrc`, szerokość 120), bez katalogu `components/ui`.

## Weryfikacja przed zakończeniem

```bash
bun run typecheck
bun test
```

Zmiany w UI sprawdź w przeglądarce (`bun run dev`, backend na `:3000`, konta z `bun run add-admin` w `PulseBackend`).
