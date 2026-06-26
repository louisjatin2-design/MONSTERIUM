# MONSTERIUM

Ein Monster-Sammel-, Zucht- und Kampf-RPG fürs Web (mobiloptimiert, Hoch- und
Querformat). Du baust eine Insel auf, brütest und züchtest Monster, ziehst sie
in Lebensräumen groß und kämpfst dich durch eine Story-Kampagne sowie gegen
andere Spieler.

## Tech-Stack

- **React 18** – UI-Layer (Panels, HUD, Overlays)
- **Zustand** (`persist` + `immer`) – Spielzustand, account-bezogen im
  `localStorage` gespeichert
- **Phaser 3** – 2D-Szenen (Inselansicht, Kampf, Minispiele)
- **Three.js** – 3D-Welt (`World3D`) und 3D-Kampfbühne (`Battle3DStage`),
  inkl. prozedural generierter Low-Poly-Modelle
- **Vite** + **TypeScript** – Build & Dev-Server
- **Supabase** (optional) – Multiplayer-Backend (Profile, Clans, PvP, Auktionen)

## Schnellstart

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Dev-Server auf http://localhost:3000
npm run build      # Typecheck + Produktions-Build nach dist/
npm run preview    # gebauten Build lokal ansehen
npm run typecheck  # nur TypeScript prüfen (tsc --noEmit)
```

## Projektstruktur

```
index.html              Einstiegspunkt der App (lädt src/main.tsx)
src/
  main.tsx              React-Bootstrap
  App.tsx               Wurzelkomponente, Panel-Routing (ActivePanel)
  data/                 Statische Spieldaten (Monster, Attacken, Gebäude,
                        Inseln, Quests, Achievements, Season Pass, …)
  store/                Zustand-Stores
    gameStore.ts        Kompletter Spielzustand + Aktionen (persist v… + migrate)
    authStore.ts        Login/Account, Supabase-Erkennung
  systems/              Spiellogik (rein, ohne UI)
    BattleSystem.ts     Schadens-/Kampfberechnung
    BreedingSystem.ts   Zucht-Ergebnisse
    EconomySystem.ts    Kosten, Verkaufswerte, Einkommen
    ProgressionSystem.ts Level/Evolution/Rang/Tempel-Limits
    StatSystem.ts       Effektive Werte inkl. Rüstung/Boni
  game/                 Phaser & Three.js
    scenes/             Boot, Preload, MainMenu, Island, Battle
    scenes/minigames/   Kampf-Minispiele (Rhythm, Timing, Mash, …)
    world3d/            React-Wrapper für die Three.js-Welt & Kampfbühne
    objects/            Phaser-Sprites (Monster, Gebäude, Eier, …)
  proto3d/              Low-Poly-3D-Generatoren (Monster/Gebäude/Inseln) +
                        gemeinsame Helfer (ll.ts) – vom Spiel genutzt
  ui/
    components/         Alle React-Panels & HUD
    responsiveScale.ts  Einheitliches Skalierungssystem (--ui-scale, --vh/--vw)
    styles/global.css   Globales Styling (Path-to-Nowhere-Look, Transitions)
  net/                  Online-Adapter (Supabase + lokaler Mock-Fallback)
supabase/
  config.toml
  migrations/           SQL für Multiplayer, PvP, Auktionen, Clans
.github/workflows/      Deploy nach GitHub Pages
shots/                  Screenshots
```

## Architektur-Hinweise

- **Panels** werden über `EventBus`/`GameEvents` ausgelöst und zentral in
  `App.tsx` über den `ActivePanel`-Typ gerendert.
- **Drei Render-Layer** arbeiten zusammen: React (UI) liegt über Phaser
  (2D-Szenen) und Three.js (`World3D` für die 3D-Insel/-Kampf).
- **Persistenz:** Jeder Account hat seinen eigenen Spielstand
  (`localStorage`-Schlüssel pro Benutzername). Bei **neuen persistenten
  Feldern** im `gameStore` die Store-Version erhöhen **und** `migrate`
  ergänzen, sonst gehen alte Spielstände kaputt.
- **Vor jedem Commit:** `npm run typecheck` und `npm run build` müssen grün
  sein.

## Features (Überblick)

- **Sammeln & Brüten:** Eier ausbrüten, Monster über Lebensräume passend zu
  Element/Seltenheit großziehen, Pokédex/Bestiarium freischalten.
- **Zucht:** Eltern kombinieren, Ergebnis-Wahrscheinlichkeiten, neue Formen.
- **Progression:** Leveln, Evolution, Rang-Ups (schalten passive Fähigkeiten
  frei), Tempel heben das Levellimit (Element-Futter ab Lv 100+).
- **Kampf:** Story-Kampagne mit Cutscenes, Element-/Fraktions-Synergien,
  Attacken-Detailansicht, Energie-System und Kampf-Minispiele.
- **Wirtschaft:** Gold/Diamanten, Shop, Crate-Shop & Glücksrad, Rüstungs-
  Crafting aus Drop-Materialien.
- **Inselbau:** Lebensräume, Tempel, Farmen platzieren; bewohner-basiertes
  Einkommen.
- **Engagement:** Quests, Achievements, Season Pass (tägliche Aufgaben,
  gestaffelte Belohnungen), Bindungs-/Relationship-Aufgaben.
- **Multiplayer:** asynchrone PvP-Arena (Elo, Verteidigungs-Teams,
  Matchmaking mit Bot-Rückfall), Clans, Auktionshaus für Monster-Handel.

## Multiplayer / Supabase

Online-Funktionen laufen über Supabase. Fehlen die Zugangsdaten, fällt der
Client automatisch auf einen lokalen Mock zurück – das Spiel bleibt voll
spielbar.

1. Repo-Secrets setzen: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.
2. Die Migrationen unter `supabase/migrations/` auf das Supabase-Projekt
   anwenden.

## Deployment

`./.github/workflows/deploy.yml` baut das Projekt und veröffentlicht `dist/`
auf GitHub Pages (`VITE_BASE=/MONSTERIUM/`). Die Supabase-Secrets werden beim
Build aus den Repo-Secrets injiziert.
