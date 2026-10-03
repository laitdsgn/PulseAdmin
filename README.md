# PulseAdmin

Panel personelu Pulse („Kraków bez barier”): mapa zgłoszeń, moderacja zgłoszeń i komentarzy, zarządzanie zgłoszeniami i miejscami, użytkownicy i role, dziennik zmian oraz statystyki miasta. Korzysta z API [`PulseBackend`](../PulseBackend) (`/v1/admin/*`, `/v1/moderation/*`, `/v1/city/*`).

Stos: Bun (`Bun.serve` + HTML imports), React 19, Tailwind 4, shadcn/ui, react-router, TanStack Query, react-hook-form + zod, recharts, Leaflet. Interfejs po polsku i angielsku.

## Uruchomienie

```bash
bun install
cp .env.example .env      # opcjonalnie: PORT, API_BASE_URL
bun run dev               # http://localhost:3001, hot reload
```

Wymaga działającego backendu (domyślnie `http://localhost:3000`). Konto do logowania zakłada się w backendzie:

```bash
cd ../PulseBackend
bun run add-admin --username root --role admin
bun run add-admin --username mod1 --role moderator
bun run add-admin --username krk --role city --city krakow
```

Login i hasło są wypisywane tylko raz.

## Konfiguracja

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `PORT` | `3001` | Port panelu. |
| `API_BASE_URL` | `http://localhost:3000` | Adres backendu, do którego panel przekazuje `/v1/*`. |

## Architektura

- `src/index.ts` serwuje SPA i **proxuje `/v1/*` do backendu** (`src/proxy.ts`). Przeglądarka rozmawia wyłącznie z originem panelu: nie trzeba CORS, a zdjęcia zgłoszeń się ładują, mimo że backend wysyła `Cross-Origin-Resource-Policy: same-origin`. Frontend nie zna adresu API.
- Sesja (`src/lib/tokens.ts`): refresh token i access token (z datą ważności z JWT) leżą w `localStorage`, wspólnie dla wszystkich kart. Token odświeża się dopiero tuż przed wygaśnięciem, jedno odświeżenie naraz w obrębie karty i między kartami (Web Locks). Backend rotuje refresh tokeny, a ponowne użycie starego unieważnia wszystkie sesje (`refresh_reuse`), więc to ważne.
- Role (`src/lib/roles.ts`) odpowiadają strażnikom backendu: `admin` – wszystko; `moderator` – bez użytkowników i dziennika; `city` – tylko statystyki, skupiska i eksport CSV swoich miast.
- Filtry i otwarty element (`?id=`) są w URL, więc widoki da się linkować.
- Mapa (`/map`, moderator i admin) pobiera zgłoszenia i miejsca dla widocznego obszaru z publicznych `GET /v1/reports?bbox=` i `GET /v1/places?bbox=` (do 1000 punktów na warstwę; powyżej prosi o przybliżenie). Publiczne endpointy nie zwracają ukrytych zgłoszeń – te są tylko w zakładce Zgłoszenia.
- Zdjęcia zgłoszeń (`src/components/ReportPhoto.tsx`): widoczne ładowane z publicznego `/v1/photos/:id` (cache), zdjęcia ukrytych zgłoszeń – które publiczny endpoint odrzuca – z `GET /v1/admin/photos/:id` z tokenem, jako blob. Są w tabeli (miniatury, filtr `hasPhoto`), w szczegółach, w kolejce moderacji i na pulpicie („Najnowsze zdjęcia”).
- Teksty: `src/i18n/pl.ts` i `src/i18n/en.ts` (słownik `en` jest typowany kluczami `pl`; brak tłumaczenia = błąd `tsc`). Lokalizowane pola z API (tytuły zgłoszeń) przychodzą w języku z nagłówka `Accept-Language`.

### Limity za proxy

Backend liczy limity (np. 10 logowań lub odświeżeń na minutę) per IP i ufa `X-Forwarded-For` tylko przy `TRUST_PROXY_HOPS > 0`. Aplikacja mobilna łączy się z backendem bezpośrednio, więc domyślnie zostaje `0` – wtedy cały personel korzystający z panelu dzieli jeden limit (IP serwera panelu). Przy kilku osobach to wystarcza, bo token odświeża się raz na ~15 minut. Gdyby było za mało, backend musi ufać nagłówkowi tylko od adresu panelu.

## Weryfikacja

```bash
bun run typecheck   # tsc --noEmit
bun test            # sesja i klient API, proxy, role, słowniki, formatery
```

## Produkcja

```bash
API_BASE_URL=https://api.example.com PORT=3001 bun run start
```

`start` uruchamia ten sam serwer z `NODE_ENV=production` (zminifikowane bundle, bez HMR). Wystaw go za HTTPS (reverse proxy). Panel ma `noindex`; rozważ dodatkowe ograniczenie dostępu (VPN / allowlista IP).
