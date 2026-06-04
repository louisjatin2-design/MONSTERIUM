# Monster-Animationen (Drop-in)

Hier kommen die **wichtigen Animationen** hinein, die für alle Monster-Modelle
geteilt werden (oder einzelne ergänzen). Auch hier gilt: einfach Datei ablegen,
kein Code nötig.

## So fügst du eine Animation hinzu

1. Exportiere die Animation als **`.glb`** (mit Skelett/Armature und der Clip-Spur).
   Geeignet sind z. B. Mixamo-Exports oder Animationen aus Blender.
2. Benenne die Datei nach der **Aktion**, in Kleinbuchstaben:

   ```
   src/assets/animations/idle.glb
   src/assets/animations/attack.glb
   src/assets/animations/hit.glb
   src/assets/animations/faint.glb
   src/assets/animations/ult.glb
   ```

3. Ablegen – fertig. Die Clips werden geladen und nach dem Dateinamen benannt,
   sodass das Spiel sie über ihren Namen ansteuern kann (`idle`, `attack`, …).

## Empfohlene Clip-Namen

| Datei         | Wann genutzt                          |
|---------------|----------------------------------------|
| `idle.glb`    | Ruhezustand (läuft automatisch)        |
| `attack.glb`  | normale Attacke                        |
| `ult.glb`     | Ultimate                               |
| `hit.glb`     | Treffer einstecken                     |
| `faint.glb`   | besiegt / K.O.                         |
| `win.glb`     | Sieg-Pose                              |

## Wichtig: Skelett-Kompatibilität

Geteilte Animationen funktionieren nur sauber, wenn die Modelle das **gleiche
Skelett (gleiche Bone-Namen)** verwenden – z. B. alle aus Meshy mit dem gleichen
Rig, oder alle mit dem Mixamo-Standard-Rig. Sonst die Animation lieber direkt mit
ins jeweilige Modell-GLB exportieren (`../monsters3d/<id>.glb`).
