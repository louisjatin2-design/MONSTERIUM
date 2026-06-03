# Fortsetzungs-Prompt: Monster Collector RPG — verbleibende Features

Diese Datei beschreibt die noch offenen Arbeitsschritte des großen Feature-Updates.
Kopiere den folgenden Block als neue Aufgabe für die nächste Session.

---

## Kontext / bereits erledigt (Branch `claude/monster-collector-rpg-features-DMoa2`, PR #53)

Bereits umgesetzt und getestet (`tsc` + `npm run build` grün):
- **Gruppe 2 (teilw.):** Fraktions-System `src/data/factions.ts` (Gut/Böse/Neutral aus
  Element+Seltenheit, Lore-Titel, `mixedTeamPenalty`/`pureTeamBonus`); Habitat-Einkommen
  bewohner-basiert (`habitatGoldPerHour` in EconomySystem, in `gameStore.tickTimers`);
  Legendär+-Habitat-Einschränkung in `eligibleHabitats`.
- **Gruppe 3 (teilw.):** `BattleSelectScreen.tsx` (Story/Multiplayer/Dungeons, WIP-Marker).
- **Gruppe 5 (teilw.):** Evolutions-Namens-Update; Labor `LabPanel.tsx` + `rankUpMonster`
  (rankStars, dynamische Levelgrenze); Achievements `src/data/achievements.ts` +
  `AchievementsPanel.tsx`.
- **Gruppe 6:** Tempel-Logik repariert — `getEffectiveMaxLevel`/`getTempleCappedLevel`/
  `getMonsterTempleLevel` in `ProgressionSystem.ts`; Tempel-Defs für alle Elemente in
  `buildings.ts`; feed/xp nutzen das effektive Limit.
- **Gruppe 7:** Rüstungs-System `src/data/armor.ts` (Materialien + Crafting), Store-Aktionen
  (`craftArmor`/`equipArmor`/`unequipArmor`/`addMaterials`), Drops in `recordBattleWon`,
  Boni in `StatSystem.instanceStats`, RÜSTUNG-Tab in `MonsterInstanceDetail.tsx`.
- **Gruppe 8 (teilw.):** Exponentielle Verkaufswerte (`calculateSellValue`); Daily Chest.
- **Gruppe 9:** Pokedex-Filter (Element + Fraktion) + Fraktions-Icons.
- **Gruppe 12:** Super-lineare Futterkosten (`calculateFeedCost`).

Architektur-Hinweise:
- React (UI) + Zustand (`src/store/gameStore.ts`, persist v11 + `migrate`) + Phaser
  (`src/game/scenes/Battle.ts`, `Island.ts`) + Three.js (`src/game/world3d/World3D.tsx`).
- Panels werden über `EventBus`/`GameEvents` und `ActivePanel` in `App.tsx` geöffnet.
- **Wichtig:** Bei neuen persistenten State-Feldern Version in `gameStore` erhöhen und
  `migrate` ergänzen. `node_modules` ggf. mit `npm install` herstellen, dann
  `npm run typecheck` und `npm run build` vor jedem Commit.

---

## AUFGABE (in dieser Reihenfolge, Gruppe für Gruppe, jeweils committen)

Lies zuerst die gesamte Projektstruktur. Nutze Platzhalter-Assets mit `TODO(assets)`.
Markiere WIP klar im Code. Frag bei grundlegenden Designentscheidungen nach.

### Gruppe 1 — Visuelles & Background (Three.js / `World3D.tsx`)
- Ersetze Overlay-Hintergründe durch einen **layerbasierten Parallax-Himmel** (mehrere
  Sky-Domes/Planes mit Tiefe), der beim Zoomen **nicht bricht**.
- Mehrere unabhängige **Wolken-Layer** (unterschiedliche Geschwindigkeit/Größe/Opazität).
- **Day/Night-Cycle** nach Geräteuhrzeit (`new Date().getHours()`): 00:00 dunkel + Mond +
  Lampenlicht, 12:00 Sonne im Zenit; smooth interpolieren (Sonnen-/Mond-Position,
  Lichtfarbe, Ambient, Fog). Tipp: zentrale `getDayNightState(date)`-Funktion.
- Gesamtes UI näher an **Path to Nowhere**: dunkel, detailreich, scharfe Kanten,
  cinematisch (CSS in `src/ui/styles/global.css`, Panel-Stile).
- Alle Screen-Wechsel animieren (Slide/Fade) — z. B. CSS-Transitions auf Panels.

### Gruppe 2 — Monster & Habitate (Rest, 3D)
- 3D-Monster-Modelle bewegen sich **zufällig** im Habitat (Wander-AI im World3D).
- Größe **proportional zur Habitatgröße**; Größe/Level sichtbar unterschiedlich.
- Designs nach Fraktion anpassen (nutze `getMonsterFaction` aus `factions.ts`).
- **Wettereffekte** im Habitat beeinflussen sichtbar Verhalten/Stimmung der Monster.

### Gruppe 3 — Kampfsystem (Rest)
- **3D-Kampfscreen**: ganzes Monster-Modell sichtbar (nicht nur Avatar), Lebens-/Status-
  balken darunter; Monster wirken aktiv kämpfend. (Battle ist aktuell Phaser
  `src/game/scenes/Battle.ts` — entscheiden: Three.js-Battle oder Phaser-3D-Look.)
- **Gut/Böse-Synergien** im Kampf: nutze `mixedTeamPenalty`/`pureTeamBonus` aus
  `factions.ts` in der Schadensberechnung; Story-Event-Ausnahmen (Buff).
- **Attacken-Detail-Screen** beim Auswählen: Name/Beschreibung, Vorschau-Schaden über
  Gegnerköpfen, Energieverbrauch, Cooldown, Statuseffekte.
- **Energie-Button** dauerhaft sichtbar; bei voller Energie → „Zug überspringen".
- **Rhythm-Minigame** (Noten fallen von oben, Tippen im richtigen Moment) als optionale
  Interaktion → Schadens-Bonus / Energie-Reload. (vgl. `src/game/scenes/minigames/`).
- **Boss-Raids** (mehrere Spieler vs. Riesen-Boss, Echtzeit) — Multiplayer-Backend nötig;
  Achievement-Zähler `stats.bossRaidWins` existiert bereits.
- **Passive Fähigkeiten** über Rang-Ups freischaltbar, dauerhaft aktiv.

### Gruppe 4 — Story & Cutscenes
- Cutscenes vor/nach jedem Kampf (Text-/Bildpanels, Path-to-Nowhere-Stil) auf der
  Abenteuer-Karte (`StoryMap.tsx`, `src/data/storyBattles.ts`).
- Lore/Hintergrund deutlich ausbauen.
- **Bestiary-Einträge** schrittweise freischalten je nach Kämpfen/Besitz eines Monsters
  (Counter pro defId im Store; im Pokedex/CompendiumPanel anzeigen).

### Gruppe 5 — Rest
- **Futter für Level 100+**: element-/seltenheitsspezifisches Futter, in speziellen Farmen
  hergestellt; als Voraussetzung fürs Leveln über 100 (Rank-Levels) prüfen.
- **Interrogations / Relationship-Tasks** (Path-to-Nowhere-Stil) → monsterspezifische Boni.
- **Season Pass**: zeitlich begrenzt, tägliche Aufgaben, gestaffelte Belohnungen.

### Gruppe 10 — Multiplayer (Backend erforderlich)
- Clans (beitreten/erstellen), Clan-Kriege (wöchentlich, Ranglisten), Monster-Trading via
  Auktionshaus, Echtzeit-PvP, Freundesliste (stärkste Monster + Stats), Leaderboards.
- **Hinweis:** aktuell rein lokaler Zustand (localStorage). Erfordert Server/Realtime-Layer
  (z. B. WebSocket/Firebase). Designentscheidung mit Nutzer klären.

### Gruppe 8/11 — Rest
- **Crate Shop** (ziehbare Inhalte: Monster/Items/Rüstungen), **Glücksrad** verbessern
  (bessere Preise/UI), **Auktionshaus** (mit Gruppe 10).
- **Saisonale Monster/Events** mit exklusiven Belohnungen und zeitbegrenzten Story-Kapiteln.

### Gruppe 13 — Charakter-Design & Mobiloptimierung
- Monster visuell markanter (Path to Nowhere) für emotionale Bindung.
- Vollständige Kompatibilität **Hoch- und Querformat** ohne Wechsel
  (vgl. `src/ui/responsiveScale.ts`, `viewport.ts`).

---

## Definition of Done je Schritt
1. `npm run typecheck` und `npm run build` grün.
2. Neue persistente Felder: Store-Version erhöhen + `migrate` ergänzen.
3. WIP klar kommentiert, fehlende Assets als `TODO(assets)`.
4. Pro Gruppe ein aussagekräftiger Commit; am Ende Branch pushen, PR #53 aktualisieren.
