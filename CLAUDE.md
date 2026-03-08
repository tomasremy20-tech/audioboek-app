# Audioboek Beoordelingen — Projectoverzicht voor Claude

## Wat is dit project?
Een Progressive Web App (PWA) waarmee de gebruiker audioboeken van **Passend Lezen** (nieuw.passendlezen.nl) bijhoudt, beoordeelt, en persoonlijke aanbevelingen krijgt via de Claude API. Volledig in het Nederlands, installeerbaar op Android.

---

## Huidige staat: ✅ LIVE

| | |
|---|---|
| **Live URL** | https://tomasremy20-tech.github.io/audioboek-app/ |
| **GitHub repo** | https://github.com/tomasremy20-tech/audioboek-app |
| **Hosting** | GitHub Pages, deploy vanaf `master` branch |
| **GitHub gebruiker** | tomasremy20-tech |
| **Datum aangemaakt** | 8 maart 2026 |

---

## Wat er vandaag is gebouwd

### Sessie 8 maart 2026
1. Volledige PWA gebouwd vanaf nul (HTML/CSS/JS, geen framework)
2. Node.js geïnstalleerd via winget voor lokale dev server
3. GitHub CLI geïnstalleerd via winget
4. GitHub account aangemaakt: `tomasremy20-tech`
5. Repo aangemaakt en gepusht naar GitHub
6. GitHub Pages geactiveerd → app is live
7. CLAUDE.md aangemaakt

---

## Projectstructuur

```
C:\Users\tomas\audioboek-app\
├── index.html          # Alle 4 pagina's (Boeken, Toevoegen, Tips, Instellingen)
├── style.css           # Mobile-first design, bottom navigation
├── app.js              # Alle logica: localStorage, Claude API, import parser
├── sw.js               # Service worker (offline caching)
├── manifest.json       # PWA manifest — start_url is "./index.html" (relatief!)
├── icon.svg            # App-icoon (hoofdtelefoon + boek + ster)
├── icon-maskable.svg   # Maskable icoon voor Android
├── server.js           # Lokale dev server (Node.js)
└── CLAUDE.md           # Dit bestand
```

---

## Functionaliteiten

### 1. Boeken pagina (tabblad 1)
- Lijst van alle boeken met gekleurde beoordelingsbadge
- Filterknoppen: Alle / Onbeoordeeld / Onzeker / Beoordeeld
- Zoekbalk op titel, auteur of genre
- Sortering: onbeoordeeld eerst, dan op datum (nieuwste eerst)
- Tik op een boek → beoordelingsmodal

### 2. Toevoegen pagina (tabblad 2)
- Handmatig formulier: titel (verplicht), auteur (verplicht), genre (dropdown met 17 opties)
- Importeer geplakte tekst van "Eerder geleend" pagina op Passend Lezen
  - Herkent: `Titel - Auteur`, `Titel — Auteur`, `Titel door Auteur`, tab-gescheiden
  - Preview stap: gebruiker kan gegevens controleren/aanpassen vóór import
  - Dubbele boeken worden overgeslagen bij JSON-import

### 3. Beoordelingsmodal (bottom sheet)
- Cijfer 1–3: rood | 4–5: oranje/geel | 6–7: groen
- "Ik weet het niet": apart paars ? (opgeslagen als beoordeling = 0)
- Boek verwijderen knop (met bevestiging)

### 4. Aanbevelingen pagina / Tips (tabblad 3)
- Statistieken: totaal / beoordeeld / onbeoordeeld
- Knop "Aanbevelingen ophalen" (vereist min. 3 beoordeelde boeken + API-sleutel)
- Claude API call → JSON response → kaarten met titel, auteur, genre, reden + zoeklink
- "Opnieuw luisteren?" sectie met alle "onzeker" boeken + directe zoeklink naar Passend Lezen

### 5. Instellingen pagina (tabblad 4)
- Claude API-sleutel invoeren (password field met toon/verberg toggle), opslaan in localStorage
- Herinneringsfrequentie: Uit / Dagelijks / Om de 3 dagen / Wekelijks / Om de 2 weken
- Meldingen inschakelen (browser Notification API)
- Exporteren als JSON / Importeren vanuit JSON
- Over deze app
- Alle gegevens wissen (dubbele bevestiging)

---

## Claude API integratie

```
Model:   claude-sonnet-4-20250514
Header:  anthropic-dangerous-direct-browser-access: true
Tokens:  max 2048
```

- Prompt: stuur alle beoordeelde boeken mee, vraag JSON terug met `smaakanalyse` + `aanbevelingen[]`
- Response: geparsed als JSON, getoond als kaarten met zoeklinks
- Fallback: als JSON parsing mislukt, toon raw tekst
- API-sleutel staat alleen in localStorage van de gebruiker, nergens anders

### Claude API-sleutel aanmaken
1. Ga naar https://console.anthropic.com
2. API Keys → Create Key
3. Sleutel begint met `sk-ant-...`
4. Invoeren in app: Instellingen → API-sleutel → Opslaan

---

## Technische aantekeningen

- **Relatieve paden**: `manifest.json` gebruikt `"start_url": "./index.html"` zodat het werkt op GitHub Pages subdirectory (`/audioboek-app/`)
- **Service worker scope**: sw.js staat in de root, cached `./`, `./index.html`, `./style.css`, `./app.js`, `./icon.svg`, `./icon-maskable.svg`, `./manifest.json`
- **Geen build stap**: puur statische bestanden, direct te bewerken
- **Data model boek**: `{ id, titel, auteur, genre, beoordeling, datumToegevoegd, datumBeoordeeld }`
  - `beoordeling: null` = onbeoordeeld
  - `beoordeling: 0` = "ik weet het niet"
  - `beoordeling: 1-7` = cijfer

---

## Lokaal draaien

```bash
"C:\Program Files\nodejs\node.exe" C:\Users\tomas\audioboek-app\server.js
# Open: http://localhost:8080
```

## Deployen na wijzigingen

```bash
cd C:\Users\tomas\audioboek-app
git add -A
git commit -m "beschrijving van wijziging"
git push
# GitHub Pages herdeployt automatisch binnen ~1 minuut
```

---

## Geïnstalleerde tools (8 maart 2026)
- **Node.js v24.14.0** — `C:\Program Files\nodejs\node.exe`
- **GitHub CLI v2.87.3** — `C:\Program Files\GitHub CLI\gh.exe`
- Git was al aanwezig — `C:\Program Files\Git\`

## Git config (lokaal in deze repo)
- `user.email`: `tomasremy20-tech@users.noreply.github.com`
- `user.name`: `tomasremy20-tech`

---

## Ideeën voor volgende sessies
- PNG iconen toevoegen (betere compatibiliteit op sommige Android-versies)
- Statistieken pagina: gemiddelde beoordeling, favoriete genres, boeken per maand
- Dark mode
- Pagend Lezen catalogus doorzoeken (als er een publieke API beschikbaar is)
- Periodic Background Sync voor echte achtergrond-notificaties
- Meerdere gebruikersprofielen (voor als meer mensen de app gebruiken)
