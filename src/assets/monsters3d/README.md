# Monster 3D-Modelle (Meshy AI Drop-in)

In diesen Ordner kommen die **3D-Modelle der Monster**. Du kannst jedes Monster
einzeln durch ein eigenes Modell ersetzen – ohne eine Zeile Code zu ändern.

## So tauschst du ein Modell aus

1. Erstelle/exportiere dein Modell in **Meshy AI** (oder einem anderen Tool) als
   **`.glb`** Datei (glTF Binary). Tipp in Meshy: „Download → GLB".
2. Benenne die Datei exakt nach der **Monster-ID** aus
   `src/data/monsters.ts`, in Kleinbuchstaben:

   ```
   src/assets/monsters3d/shadowfox.glb
   src/assets/monsters3d/luminos.glb
   src/assets/monsters3d/venomscale.glb
   ```

3. Lege die Datei hier ab. Fertig – beim nächsten Start (bzw. Build) zeigt das
   Spiel automatisch dein Modell statt des prozeduralen Platzhalters, sowohl im
   Lebensraum als auch im 3D-Kampf.

> Liegt **keine** passende Datei hier, nutzt das Spiel weiter das automatisch
> generierte Low-Poly-Monster. Du musst also nicht alle auf einmal ersetzen.

## Worauf achten

- **Format:** nur `.glb` (enthält Mesh, Material und optional Animationen in einer Datei).
- **Größe/Ausrichtung:** egal – das Spiel skaliert das Modell automatisch auf die
  richtige Höhe und setzt es auf den Boden (`normalizeModel` in
  `src/game/world3d/monsterModels.ts`). Blickrichtung idealerweise nach **+Z**.
- **Polycount:** mobil-freundlich halten (Meshy „low/medium" reicht meist).
- **Animationen:** Entweder direkt im Modell-GLB enthalten, oder allgemein über den
  Ordner [`../animations/`](../animations/README.md) (z. B. `idle`, `attack`).
  Eine Animation, deren Name `idle` enthält, wird automatisch abgespielt.

## Monster-IDs nachschlagen

Die gültigen IDs stehen als Schlüssel in `src/data/monsters.ts` (das `id`-Feld
jeder Monster-Definition). Genau diesen Wert als Dateinamen verwenden.
