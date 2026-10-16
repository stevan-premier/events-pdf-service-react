# Dopune / Liste

Samostalna React + TypeScript aplikacija za preuzimanje sportskih lista u PDF formatu.

## Pokretanje

```sh
npm install
npm run dev
```

## API

- Terminska lista: `GET /api/events/generate_daily_events/1`
- Ostali sportovi: `GET /api/events/generate_daily_events/2`

Podrazumevano se poziva `/api` na istoj adresi kao aplikacija. Za drugi server kopirajte `.env.example` u `.env.local` i podesite `VITE_API_BASE_URL` na njegovu osnovnu adresu (bez `/api`). Server mora da dozvoli CORS za adresu ove aplikacije.

Za lokalni razvoj možete umesto toga ostaviti `VITE_API_BASE_URL` prazno i podesiti `API_PROXY_TARGET`. Vite tada prosleđuje `/api` i `/vc/api` pozive tom serveru. Posle promene konfiguracije ponovo pokrenite razvojni server. Za produkciju podesite reverse proxy za `/api` i `/vc/api` ili `VITE_API_BASE_URL` pre build-a.

Aplikacija ne zavisi od back-office projekta, njegovih datoteka, prijave ili skladišta tokena. Ne uključuje autentifikaciju; navedeni endpointi moraju biti dostupni na ciljnom serveru.

Očekivani odgovor je niz redova ili `{ "data": [...] }`: vreme generisanja, naziv sporta, zaglavlje sa datumom i tržištima, zatim događaji. PDF koristi ugrađene Arial, Arial Narrow Bold i Franklin Gothic Medium Cond fontove. Koriste se `jspdf` i `jspdf-autotable`. PDF se generiše u pregledaču nakon klika; na početnoj strani se veličina i vreme prikazuju tek posle uspešnog generisanja.

Fudbal je A4 uspravno prema vizuelnom primeru; ostali sportovi koriste dimenzije originalnog Excel PDF-a (313,39 × 443,36 mm), fontove od 9–10 pt i jednake širine kolona kvota. Zaglavlja se ponavljaju na novoj strani. Dokument zahteva prikaz po širini (`fullwidth`), koji zavisi od podrške PDF preglednika. Fudbal ima grupe po datumima i naizmenične tirkizne redove; ostali sportovi imaju odvojene tabele i istaknute granice tržišta.

## Provera i objavljivanje

```sh
npm run lint
npm run build
npm run preview
```

Objavite sadržaj direktorijuma `dist` na statičkom hostingu sa podešenim API pristupom. PDF biblioteke se učitavaju tek prilikom preuzimanja liste.

## Prevodi PDF grupa

Pre generisanja učitava se `/vc/api/static/i18n?groups=GENERAL,BETS,BET_GROUPS&locale=cg`. Jezik se podešava kroz `VITE_PDF_LOCALE`. Košarkaške grupe se povezuju sa `BET_GROUP_BASKETBALL_*` ključevima; oznake iz odgovora (npr. `K1+(PR.)`) normalizuju se na kratke nazive za štampu (`KP1`) bez menjanja redosleda ili vrednosti podataka. Dugi prevodi prelome se u zaglavlju; kvote i limiti ostaju u jednom redu.
