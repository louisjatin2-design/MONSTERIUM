// ---------------------------------------------------------------------------
// Battle3DStage — a real 3D arena for fights (Three.js).
//
// The battle gets its OWN little floating island. Both teams' monsters stand on
// it as full 3D models (procedural low-poly by default, or your Meshy GLB via
// src/assets/monsters3d/), and the camera is FREE — orbit / zoom around the
// arena with the mouse or a finger. Above every monster floats a simple info
// panel (name + HP / Energy / Ult bars) that always turns to face the camera.
//
// The Phaser battle scene stays the source of truth for the fight logic; it
// emits lightweight snapshot events (BATTLE_3D_*) that this stage renders, so
// the 3D view is a clean visual layer. Mounted behind ?battle3d=1.
// ---------------------------------------------------------------------------
import { useEffect, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EventBus, GameEvents } from '@game/EventBus';
import { MONSTER_DEFS } from '@data/monsters';
import { ELEMENT_COLORS } from '@data/elements';
import { RARITY_COLORS, RARITY_RANK } from '@data/rarities';
import { getMonsterFaction } from '@data/factions';
import { buildLowPolyMonster, type MonsterVisualSpec, type VisualStage } from '../../proto3d/lowpolyMonster';
import { attachMonsterModel } from './monsterModels';
import { EVOLUTION_LEVELS } from '@systems/ProgressionSystem';

// Combatants only carry a level here, so derive the visual evolution stage from
// it (same thresholds the rest of the game uses) → a different model per age.
function stageForLevel(level: number): VisualStage {
  if (level >= EVOLUTION_LEVELS.Elder) return 'Elder';
  if (level >= EVOLUTION_LEVELS.Adult) return 'Adult';
  if (level >= EVOLUTION_LEVELS.Juvenile) return 'Juvenile';
  return 'Baby';
}

interface InitMember { id: string; defId: string; level: number; name: string; isPlayer: boolean; boss?: boolean; }
interface InitPayload { players: InitMember[]; enemies: InitMember[]; }
interface StatsPayload { id: string; hp: number; maxHp: number; energy: number; maxEnergy: number; ult: number; ultCost: number; }

function monsterSpec(defId: string, id: string, level: number): MonsterVisualSpec {
  const def = MONSTER_DEFS[defId];
  const el = def?.elements[0] ?? 'Fire';
  return {
    id,
    element: el,
    elementColor: (ELEMENT_COLORS as Record<string, number>)[el] ?? 0x888888,
    accentColor: parseInt((RARITY_COLORS[def?.rarity ?? 'Common']).replace('#', ''), 16),
    rarityRank: RARITY_RANK[def?.rarity ?? 'Common'],
    faction: def ? getMonsterFaction(def) : 'Neutral',
    stage: stageForLevel(level),
  };
}

// One on-stage combatant: its model group, optional animation mixer, the
// billboard info panel and the latest stats used to redraw that panel.
interface StageUnit {
  id: string;
  group: THREE.Group;
  home: THREE.Vector3;
  facing: number;            // y-rotation so it looks at the enemy line
  bobPhase: number;
  hud: THREE.Sprite;
  hudCanvas: HTMLCanvasElement;
  hudTex: THREE.CanvasTexture;
  data: StatsPayload & { name: string; isPlayer: boolean };
  fainted: boolean;
  lunge: number;             // 0..1 lunge animation progress (0 = idle)
  hitFlash: number;          // seconds of hit-flash remaining
}

export function Battle3DStage({ hidden, style }: { hidden?: boolean; style?: CSSProperties }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0820);
    scene.fog = new THREE.Fog(0x140a30, 18, 46);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 6.5, 13);

    // FREE camera — orbit + zoom around the arena.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.6, 0);
    controls.minDistance = 5;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.49;   // don't dip under the island
    controls.update();

    // ── Lighting + atmosphere ────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x9a7aff, 0x140a28, 0.7));
    const key = new THREE.DirectionalLight(0xffe8cc, 1.4);
    key.position.set(6, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 50;
    (['left', 'right', 'top', 'bottom'] as const).forEach(s => { (key.shadow.camera as any)[s] = s === 'left' || s === 'bottom' ? -14 : 14; });
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5588, 0.5);
    rim.position.set(-8, 5, -6);
    scene.add(rim);

    // Scatter a few stars for depth.
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 220; i++) {
      const r = 60 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      starPos.push(Math.sin(ph) * Math.cos(th) * r, Math.abs(Math.cos(ph)) * r * 0.6 + 6, Math.sin(ph) * Math.sin(th) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })));

    // ── The little battle island ─────────────────────────────────────────────
    const island = new THREE.Group();
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f8a4a, flatShading: true, roughness: 0.9 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.8, 32), grassMat);
    top.position.y = -0.4; top.receiveShadow = true;
    island.add(top);
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, flatShading: true, roughness: 1 });
    const dirt = new THREE.Mesh(new THREE.ConeGeometry(8.5, 6, 32, 1, true), dirtMat);
    dirt.position.y = -3.8; dirt.rotation.x = Math.PI;
    island.add(dirt);
    // A glowing rune ring + a few rocks for arena flavour.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.2, 0.12, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0x9a6bff, emissive: 0x6a3acc, emissiveIntensity: 0.8, roughness: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    island.add(ring);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a8290, flatShading: true, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.5, 0), rockMat);
      rock.position.set(Math.cos(a) * 7.4, -0.1, Math.sin(a) * 7.4);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true; rock.receiveShadow = true;
      island.add(rock);
    }
    scene.add(island);

    // ── Unit + VFX bookkeeping ───────────────────────────────────────────────
    const units = new Map<string, StageUnit>();
    const vfx: Array<{ obj: THREE.Object3D; life: number; max: number; from?: THREE.Vector3; to?: THREE.Vector3; spin?: number }> = [];

    // Draw a unit's floating info panel onto its canvas texture.
    function drawHud(u: StageUnit) {
      const ctx = u.hudCanvas.getContext('2d')!;
      const W = u.hudCanvas.width, H = u.hudCanvas.height;
      ctx.clearRect(0, 0, W, H);
      // Name
      ctx.font = '700 30px Segoe UI, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = u.fainted ? '#888' : (u.data.isPlayer ? '#7dffb0' : '#ff9b9b');
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 6;
      ctx.strokeText(u.data.name, W / 2, 26);
      ctx.fillText(u.data.name, W / 2, 26);
      // Bars helper
      const bar = (y: number, ratio: number, col: string, bgCol = 'rgba(0,0,0,0.55)') => {
        const bw = W - 40, bx = 20;
        ctx.fillStyle = bgCol;
        roundRect(ctx, bx, y, bw, 16, 6); ctx.fill();
        ctx.fillStyle = col;
        roundRect(ctx, bx, y, bw * Math.max(0, Math.min(1, ratio)), 16, 6); ctx.fill();
      };
      const hpRatio = u.data.hp / Math.max(1, u.data.maxHp);
      bar(48, hpRatio, hpRatio > 0.5 ? '#44dd55' : hpRatio > 0.25 ? '#ffaa33' : '#ff3322');
      bar(70, u.data.energy / Math.max(1, u.data.maxEnergy), '#33ccff');
      bar(92, u.data.ult / Math.max(1, u.data.ultCost), '#ffd34a');
      u.hudTex.needsUpdate = true;
    }

    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function makeUnit(m: InitMember, pos: THREE.Vector3, facing: number): StageUnit {
      const group = buildLowPolyMonster(monsterSpec(m.defId, m.id, m.level));
      const baseScale = m.boss ? 2.1 : 1.35;
      group.scale.setScalar(baseScale);
      group.position.copy(pos);
      group.rotation.y = facing;
      scene.add(group);
      // Meshy GLB swap (procedural shows until/unless a model resolves).
      void attachMonsterModel(group, m.defId);

      // Billboard info panel.
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 120;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sprite.scale.set(3.0, 1.4, 1);
      sprite.position.copy(pos).add(new THREE.Vector3(0, m.boss ? 5.2 : 3.6, 0));
      sprite.renderOrder = 999;
      scene.add(sprite);

      const u: StageUnit = {
        id: m.id, group, home: pos.clone(), facing, bobPhase: Math.random() * Math.PI * 2,
        hud: sprite, hudCanvas: canvas, hudTex: tex,
        data: { id: m.id, name: m.name, isPlayer: m.isPlayer, hp: 1, maxHp: 1, energy: 0, maxEnergy: 1, ult: 0, ultCost: 1 },
        fainted: false, lunge: 0, hitFlash: 0,
      };
      drawHud(u);
      return u;
    }

    function clearUnits() {
      for (const u of units.values()) {
        scene.remove(u.group, u.hud);
        u.hudTex.dispose();
      }
      units.clear();
    }

    // ── Event wiring (driven by the Phaser battle) ───────────────────────────
    const onInit = (p: InitPayload) => {
      clearUnits();
      const place = (list: InitMember[], side: -1 | 1) => {
        const n = list.length;
        list.forEach((m, i) => {
          const z = (i - (n - 1) / 2) * 3.2;
          const pos = new THREE.Vector3(side * 5.2, 0, z);
          const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2; // look across the arena
          units.set(m.id, makeUnit(m, pos, facing));
        });
      };
      place(p.players, -1);
      place(p.enemies, 1);
    };

    const onStats = (s: StatsPayload) => {
      const u = units.get(s.id);
      if (!u) return;
      u.data = { ...u.data, ...s };
      if (s.hp <= 0) u.fainted = true;
      drawHud(u);
    };

    const onLunge = (d: { attackerId: string; targetId?: string }) => {
      const u = units.get(d.attackerId);
      if (u && !u.fainted) u.lunge = 1;
      // Launch a glowing orb from attacker toward the target for a visible hit.
      const target = d.targetId ? units.get(d.targetId) : undefined;
      if (u && target) {
        const orb = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45, 1),
          new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffaa33, emissiveIntensity: 1.4 }),
        );
        const from = u.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const to = target.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        orb.position.copy(from);
        scene.add(orb);
        vfx.push({ obj: orb, life: 0.32, max: 0.32, from, to });
      }
    };

    const onHit = (d: { id: string }) => {
      const u = units.get(d.id);
      if (!u) return;
      u.hitFlash = 0.32;
      // Big impact burst at the target.
      burst(u.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xffd0a0);
    };

    const onFaint = (d: { id: string }) => {
      const u = units.get(d.id);
      if (u) u.fainted = true;
    };

    function burst(at: THREE.Vector3, color: number) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.5, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }),
      );
      ring.position.copy(at);
      ring.lookAt(camera.position);
      scene.add(ring);
      vfx.push({ obj: ring, life: 0.45, max: 0.45, spin: 1 });
      for (let i = 0; i < 10; i++) {
        const shard = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.16),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }),
        );
        shard.position.copy(at);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
        scene.add(shard);
        vfx.push({ obj: shard, life: 0.5, max: 0.5, from: at.clone(), to: at.clone().add(dir.multiplyScalar(2.2)) });
      }
    }

    EventBus.on(GameEvents.BATTLE_3D_INIT, onInit);
    EventBus.on(GameEvents.BATTLE_3D_STATS, onStats);
    EventBus.on(GameEvents.BATTLE_3D_LUNGE, onLunge);
    EventBus.on(GameEvents.BATTLE_3D_HIT, onHit);
    EventBus.on(GameEvents.BATTLE_3D_FAINT, onFaint);

    // ── Render loop ──────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    const tmp = new THREE.Vector3();
    const tick = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      controls.update();
      ring.material.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.25;

      for (const u of units.values()) {
        const mixer = u.group.userData.mixer as THREE.AnimationMixer | undefined;
        if (mixer) mixer.update(dt);

        // Idle bob + faint sink.
        if (u.fainted) {
          u.group.position.y = THREE.MathUtils.lerp(u.group.position.y, -0.6, dt * 4);
          u.group.rotation.z = THREE.MathUtils.lerp(u.group.rotation.z, Math.PI * 0.45, dt * 4);
          (u.hud.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp((u.hud.material as THREE.SpriteMaterial).opacity, 0.25, dt * 3);
        } else {
          u.group.position.y = u.home.y + Math.sin(t * 2 + u.bobPhase) * 0.12;
          // Lunge toward the enemy line, then ease back.
          if (u.lunge > 0) {
            u.lunge = Math.max(0, u.lunge - dt * 3);
            const dir = u.data.isPlayer ? 1 : -1;
            u.group.position.x = u.home.x + dir * Math.sin(u.lunge * Math.PI) * 1.6;
          } else {
            u.group.position.x = THREE.MathUtils.lerp(u.group.position.x, u.home.x, dt * 6);
          }
        }

        // Hit flash → briefly scale/tilt.
        if (u.hitFlash > 0) {
          u.hitFlash = Math.max(0, u.hitFlash - dt);
          u.group.rotation.y = u.facing + Math.sin(u.hitFlash * 60) * 0.18;
        } else {
          u.group.rotation.y = u.facing;
        }

        // Keep the info panel pinned above the (bobbing) monster.
        u.hud.position.set(u.group.position.x, u.home.y + (u.group.scale.x > 2 ? 5.2 : 3.6) + Math.sin(t * 2 + u.bobPhase) * 0.12, u.group.position.z);
      }

      // Advance VFX.
      for (let i = vfx.length - 1; i >= 0; i--) {
        const f = vfx[i];
        f.life -= dt;
        const k = 1 - f.life / f.max;
        if (f.from && f.to) {
          tmp.copy(f.from).lerp(f.to, k);
          f.obj.position.copy(tmp);
        }
        if (f.spin) {
          f.obj.scale.setScalar(1 + k * 3);
          (f.obj as THREE.Mesh).material && ((((f.obj as THREE.Mesh).material) as THREE.Material).opacity = 1 - k);
          ((((f.obj as THREE.Mesh).material) as THREE.Material).transparent = true);
        }
        const mat = (f.obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(0, 1.4 * (f.life / f.max));
        if (f.life <= 0) { scene.remove(f.obj); vfx.splice(i, 1); }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      if (!mount.clientWidth) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      EventBus.off(GameEvents.BATTLE_3D_INIT, onInit);
      EventBus.off(GameEvents.BATTLE_3D_STATS, onStats);
      EventBus.off(GameEvents.BATTLE_3D_LUNGE, onLunge);
      EventBus.off(GameEvents.BATTLE_3D_HIT, onHit);
      EventBus.off(GameEvents.BATTLE_3D_FAINT, onFaint);
      clearUnits();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute', inset: 0,
        display: hidden ? 'none' : 'block',
        zIndex: 120,
        touchAction: 'none',
        ...style,
      }}
    />
  );
}
