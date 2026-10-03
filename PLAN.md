# Plan implementacji panelu admina (PulseAdmin)

> **Status: zrealizowany (fazy 0–7).** Aktualny opis architektury: `README.md`, zasady dla agentów: `AGENTS.md`. Odstępstwa od planu: API wołane przez proxy serwera panelu (`/v1/*`), a nie bezpośrednio z przeglądarki (zdjęcia blokowane przez CORP backendu); `build.ts` usunięty – produkcja to `bun run start`.

Panel dla personelu Pulse („Kraków bez barier”): moderacja, zarządzanie zgłoszeniami i miejscami, użytkownicy i role, statystyki. Backend jest gotowy (`PulseBackend`, `/v1/admin/*`, opis w `PulseBackend/docs/endpoints/admin.md`).

## Decyzje (ustalone)

- Logowanie: login + hasło; konta zakłada `bun run add-admin` w `PulseBackend` (login i hasło wypisywane raz).
- Role: `admin` (wszystko), `moderator` (treści, miejsca, dashboard), `city` (tylko eksporty/statystyki miasta – bez widoków treści).
- Stos: istniejący szablon (Bun `serve` + HTML imports, React 19, Tailwind 4, shadcn/ui: button, card, input, label, select, textarea; lucide-react). Zero Vite.
- Zakres v1: kolejka moderacji, zgłoszenia i miejsca, użytkownicy i role, dashboard i statystyki.

## Proponowane dodatkowe zależności (do akceptacji)

| Pakiet | Po co |
|--------|-------|
| `react-router` | trasy (`/login`, `/`, `/moderation`, `/reports`, `/places`, `/users`, `/audit`) i ochrona tras wg roli |
| `@tanstack/react-query` | cache, paginacja kursorowa (`useInfiniteQuery`), odświeżanie po mutacjach |
| `recharts` | wykres „zgłoszenia / dzień” i słupki kategorii (przez shadcn `chart`) |
| `sonner` | powiadomienia (toast) o wyniku akcji |
| `react-hook-form` + `zod` + `@hookform/resolvers` | formularze (edycja miejsca, nowe konto) z walidacją zgodną z backendem |
| `leaflet` + `react-leaflet` (opcjonalnie) | podgląd lokalizacji zgłoszenia/miejsca na mapie |

Dodatkowe komponenty shadcn (generowane, bez nowych zależności poza radix): table, dialog, dropdown-menu, badge, tabs, sheet, skeleton, switch, checkbox, alert-dialog.

## Struktura

```
src/
  index.ts               # Bun.serve: SPA + (prod) statyczne pliki; port inny niż backend (3000) → 3001
  frontend.tsx, App.tsx  # router + providery
  lib/
    api.ts               # fetch z Bearer, obsługa 401 → refresh (raz) → ponowienie; błędy { error: { message, code } }
    auth.tsx             # kontekst: user, login/logout, tokeny, role
    types.ts             # typy odpowiedzi (wg docs/reference/models.md)
    format.ts            # daty, etykiety kategorii/statusów (pl)
  routes/                # login, dashboard, moderation, reports, places, users, audit, account
  components/            # layout (sidebar + topbar), DataTable, ConfirmDialog, RoleGuard, ...
```

Konfiguracja: `API_BASE_URL` (np. `http://localhost:3000`), wstrzykiwane przy buildzie/uruchomieniu (`Bun.env` → `define`); backend ma `cors()` otwarte, więc panel woła API bezpośrednio.

## Sesja i bezpieczeństwo

- Access token (15 min) w pamięci; refresh token w `localStorage` albo `sessionStorage` (decyzja poniżej). Jedno wspólne odświeżanie przy równoległych 401 (kolejka żądań), po `refresh_reuse`/błędzie → wylogowanie.
- `POST /admin/auth/logout` przy wylogowaniu; po `POST /admin/auth/password` wymuszone ponowne logowanie.
- `403 account_disabled` / `forbidden` → komunikat i wylogowanie; `429 too_many_attempts` → komunikat o blokadzie loginu na 15 min.
- Trasy zasłonięte przez `RoleGuard`; widoki wg roli: admin – wszystko; moderator – bez Użytkowników i Audytu; city – ekran z eksportami/statystykami miasta (`/v1/city/*`).
- Operacje destrukcyjne (usunięcie konta, blokada, ukrycie) przez `ConfirmDialog`.

## Fazy

**Faza 0 – fundament.** Zależności, ports/ENV, router, layout (sidebar, topbar z użytkownikiem i wylogowaniem), motyw (jasny/ciemny), `lib/api.ts` z odświeżaniem tokenu, `AuthProvider`, strona logowania, `RoleGuard`, usunięcie demo (`APITester`, `/api/hello`). *Gotowe, gdy:* logowanie kontem z `add-admin` działa, odświeżenie strony zachowuje sesję, wygaśnięcie tokenu jest niewidoczne dla użytkownika.

**Faza 1 – dashboard.** `GET /admin/dashboard` (+ filtr miasta z `GET /v1/cities`): kafelki (użytkownicy, zgłoszenia aktywne/ukryte, otwarte flagi, zużycie LLM z paskiem do limitu), wykres 30 dni, top kategorii; link z „otwarte flagi” do kolejki. Dla `city`: statystyki z `GET /v1/city/stats`, hotspoty, eksport `reports.csv`.

**Faza 2 – kolejka moderacji.** `GET /v1/moderation/flags` (open/resolved, kursor), podgląd treści (zgłoszenie/komentarz, powody, liczba flag), akcje `dismiss`/`hide`/`restore` przez `POST /moderation/flags/resolve`; skróty klawiszowe; po akcji następna pozycja.

**Faza 3 – zgłoszenia i komentarze.** Tabela `GET /admin/reports` (filtry: tekst, status, kategoria, miasto, autor, widoczność), szczegóły w panelu bocznym (zdjęcie `photoUrl`, mapa, flagi, autor → link do użytkownika), akcje: ukryj/przywróć (`/visibility`), edycja kategorii/ważności/opisu (`PATCH /v1/reports/:id`), usunięcie (`DELETE /v1/reports/:id`). Zakładka komentarzy (`GET /admin/comments`, ukryj/przywróć).

**Faza 4 – miejsca.** Tabela `GET /admin/places` (tekst, miasto, typ, `wheelchair`, `verified`), formularz edycji (`PATCH /admin/places/:id`: nazwa, adres, dostępność, opis 20–800 znaków, listy udogodnień/barier z walidacją rodzaju, `verified`), ostrzeżenie że zmiana opisu kasuje tłumaczenie EN.

**Faza 5 – użytkownicy i role (admin).** Lista z wyszukiwarką/filtrami (`GET /admin/users`), szczegóły ze statystykami, zmiana roli i zakresu miast (`PATCH`), blokada/odblokowanie, unieważnienie sesji, nadanie loginu i hasła istniejącemu kontu (`PUT …/credentials`), utworzenie konta personelu (`POST /admin/users`), usunięcie. Ochrona przed edycją własnego konta (`cannot_modify_self`).

**Faza 6 – audyt i konto.** `GET /admin/audit` (filtry aktor/akcja), zmiana własnego hasła; dopracowanie: stany ładowania/błędów, puste listy, dostępność (klawiatura, kontrast), widok mobilny.

**Faza 7 – wdrożenie.** `bun run build`, serwowanie statyczne (`start`), konfiguracja `API_BASE_URL`, CORS/`PUBLIC_URL` backendu, HTTPS; instrukcja w README i `AGENTS.md` podprojektu (zgodnie z zasadą AGENTS.md w katalogu nadrzędnym).

## Testy i weryfikacja

- Jednostkowe (`bun test`): `lib/api.ts` (odświeżanie, kolejka 401, mapowanie błędów), `RoleGuard`, formatery.
- Komponentowe (happy-dom + Testing Library, jeśli zgodzisz się na dodatek) dla logowania i formularzy; ręczny przegląd każdej fazy w przeglądarce (`/run`).
- Kontrakt: typy w `lib/types.ts` odpowiadają `PulseBackend/docs/reference/models.md`; zmiana endpointu w backendzie = zmiana docs + typów panelu.

## Decyzje (dawniej otwarte pytania)

1. Refresh token (oraz access token z datą ważności) w `localStorage`, wspólny dla kart.
2. Zależności zatwierdzone w całości, z Leafletem (mapa w szczegółach zgłoszenia/miejsca i skupiskach).
3. Interfejs pl + en (własne słowniki `src/i18n`, bez biblioteki).
4. Hosting: panel na osobnym porcie (domyślnie 3001) z proxy `/v1/*` do backendu; dodatkowe zabezpieczenie (VPN/allowlista) – decyzja przy wdrożeniu.
5. Rola `city`: tylko statystyki, skupiska i eksport CSV swoich miast.
6. Uprawnienia moderatora bez zmian (edycja miejsc, ukrywanie bez flag).
7. Dziennik zmian tylko dla admina; bez powiadomień o flagach w v1.
8. Eksport: tylko `reports.csv`.
