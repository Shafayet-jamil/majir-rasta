// নদী, পাড়, পুরান ঢাকার দালান, ঘাট, ব্রিজ
import * as THREE from 'three';
import { mat, box, cyl, textBoard, textSprite, makePerson, makeKite } from './models.js';
import { GHATS_LEFT, GHATS_RIGHT } from './text.js';

export const RIVER_HALF = 30; // নদীর অর্ধেক চওড়া
export const CHUNK = 60;
export const GHAT_SPACING = 170;
export const GHAT_START = -150;
export const BRIDGE_Z = -720;
export const BRIDGE_EVERY = 1500;
export const AHSAN_Z = -330;

// ---------- টেক্সচার ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function waterTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#56685c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const l = 8 + Math.random() * 26;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(160,185,170,0.35)' : 'rgba(40,55,48,0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + l / 2, y - 3, x + l, y);
      g.stroke();
    }
  });
}

// পুরান দালান: রং, দাগ, সবুজ খড়খড়ি জানালা
function buildingTexture(base, shutter) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 6 + Math.random() * 30);
    }
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(30,30,20,0.25)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let y = 14; y < h; y += 64) {
      for (let x = 12; x < w; x += 64) {
        g.fillStyle = 'rgba(20,20,20,0.85)';
        g.fillRect(x, y, 22, 32);
        g.fillStyle = shutter;
        g.fillRect(x - 6, y, 6, 32);
        g.fillRect(x + 22, y, 6, 32);
        g.fillStyle = 'rgba(255,255,255,0.15)';
        g.fillRect(x - 8, y + 34, 42, 4);
      }
    }
  });
}

const BUILDING_STYLES = [
  ['#9b4a3a', '#2e7d32'], ['#c9a35a', '#1b5e20'], ['#c98f8f', '#00695c'], ['#8a8f7f', '#33691e'],
  ['#d8cfb8', '#2e7d32'], ['#b5651d', '#004d40'], ['#7e8c6a', '#5d4037'], ['#e0b0a0', '#1565c0'],
];
let buildingMats = [];
let tinMat;

// বক্সের UV বড় করি যাতে জানালা দালানের সাইজ মতো রিপিট হয়
function scaledBox(w, h, d, unit = 8) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const faceDims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * (faceDims[f][0] / unit), uv.getY(idx) * (faceDims[f][1] / unit));
    }
  }
  return geo;
}

export function ghatInfo(i) {
  const side = i % 2 === 0 ? 1 : -1; // ১ = ডান (পুরান ঢাকা), -১ = বাম (কেরানীগঞ্জ)
  const list = side === 1 ? GHATS_RIGHT : GHATS_LEFT;
  const name = list[Math.floor(i / 2) % list.length];
  return { index: i, side, name, z: GHAT_START - i * GHAT_SPACING, ringX: side * (RIVER_HALF - 8.5) };
}

export function bridgeName(k) {
  if (k === 0) return 'বাবুবাজার ব্রিজ';
  return pickFrom(['বুড়িগঙ্গা সেতু ' + (k + 1), 'নতুন ব্রিজ (৩০ বছর ধইরা নির্মাণাধীন)'], k);
}
function pickFrom(a, k) {
  return a[k % a.length];
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.ghats = new Map();
    this.bridges = new Map();
    this.colliders = []; // স্থির বাধা: {x,z,r} বা {x,z,hx,hz}
    this.kites = [];

    if (!buildingMats.length) {
      buildingMats = BUILDING_STYLES.map(([b, s]) => new THREE.MeshLambertMaterial({ map: buildingTexture(b, s) }));
      tinMat = new THREE.MeshLambertMaterial({ color: 0x90a4ae });
    }

    // আকাশ ও আলো
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a30, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
    this.sun.position.set(-40, 80, 30);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0xcfd8dc, 80, 420);
    scene.background = new THREE.Color(0xcfd8dc);

    // পানি
    this.waterTex = waterTexture();
    this.waterTex.repeat.set(30, 60);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(RIVER_HALF * 2 + 8, 900),
      new THREE.MeshLambertMaterial({ map: this.waterTex, color: 0xb8c8bc })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.05;
    scene.add(this.water);

    // ঘুড়ি
    for (let i = 0; i < 9; i++) {
      const k = makeKite();
      k.userData.base = new THREE.Vector3((Math.random() < 0.7 ? 1 : -1) * (25 + Math.random() * 40), 30 + Math.random() * 25, -Math.random() * 300);
      k.userData.phase = Math.random() * 10;
      scene.add(k);
      this.kites.push(k);
    }
  }

  // খেলোয়াড় যেখানে আছে তার সামনে-পিছে দুনিয়া বানাই/মুছি
  update(pz, t) {
    const first = Math.floor(-(pz + 160) / CHUNK);
    const last = Math.floor(-(pz - 460) / CHUNK);
    for (let k = Math.max(first, -3); k <= last; k++) if (!this.chunks.has(k)) this.buildChunk(k);
    for (const [k, objs] of this.chunks) {
      if (k < first - 1) {
        objs.forEach((o) => this.disposeObj(o));
        this.chunks.delete(k);
      }
    }
    // ঘাট
    const gFirst = Math.max(0, Math.ceil((GHAT_START - (pz + 170)) / GHAT_SPACING));
    const gLast = Math.floor((GHAT_START - (pz - 460)) / GHAT_SPACING);
    for (let i = gFirst; i <= gLast; i++) if (!this.ghats.has(i)) this.buildGhat(i);
    for (const [i, gh] of this.ghats) {
      if (gh.z > pz + 180) {
        gh.objs.forEach((o) => this.disposeObj(o));
        this.colliders = this.colliders.filter((c) => c.owner !== gh);
        this.ghats.delete(i);
      }
    }
    // ব্রিজ
    for (let k = 0; ; k++) {
      const bz = BRIDGE_Z - k * BRIDGE_EVERY;
      if (bz < pz - 500) break;
      if (bz > pz + 180) {
        if (this.bridges.has(k)) {
          const b = this.bridges.get(k);
          b.objs.forEach((o) => this.disposeObj(o));
          this.colliders = this.colliders.filter((c) => c.owner !== b);
          this.bridges.delete(k);
        }
        continue;
      }
      if (!this.bridges.has(k)) this.buildBridge(k, bz);
    }

    // পানি খেলোয়াড়ের সাথে চলে, টেক্সচার দুনিয়ার সাথে স্থির
    this.water.position.z = pz - 250;
    this.waterTex.offset.set(t * 0.004, (-this.water.position.z / 900) * 60 + t * 0.01);

    for (const k of this.kites) {
      const b = k.userData.base;
      if (b.z > pz + 50) b.z -= 380;
      const ph = t * 0.8 + k.userData.phase;
      k.position.set(b.x + Math.sin(ph) * 3, b.y + Math.sin(ph * 1.3) * 2, b.z);
      k.rotation.z = Math.sin(ph) * 0.4;
    }

    // ঘাটের রিং ঝলমল
    for (const gh of this.ghats.values()) {
      const s = 1 + Math.sin(t * 5) * 0.08;
      gh.ring.scale.set(s, s, s);
      gh.ring.rotation.z = t;
    }
  }

  add(obj, list) {
    this.scene.add(obj);
    list.push(obj);
    return obj;
  }

  disposeObj(o) {
    this.scene.remove(o);
    o.traverse?.((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material && c.material.map && c.isSprite) {
        c.material.map.dispose();
        c.material.dispose();
      }
    });
  }

  buildChunk(k) {
    const objs = [];
    const z0 = -k * CHUNK;
    const zc = z0 - CHUNK / 2;
    // মাটি
    for (const side of [1, -1]) {
      const ground = box(140, 3, CHUNK, side === 1 ? 0x8d7b5a : 0x7d8b55);
      ground.position.set(side * (RIVER_HALF + 70), -0.3, zc);
      this.add(ground, objs);
      // পাড়ের সিঁড়ি/ঢাল
      const edge = box(3, 1.6, CHUNK, side === 1 ? 0x9e9e9e : 0x6d5c3d);
      edge.position.set(side * (RIVER_HALF + 1.5), 0.2, zc);
      edge.rotation.z = side * -0.35;
      this.add(edge, objs);
    }

    // বিশেষ জায়গা
    const special = (zz) => zz <= z0 && zz > z0 - CHUNK;
    if (special(20)) this.buildSadarghat(objs);
    if (special(AHSAN_Z)) this.buildAhsanManzil(objs, AHSAN_Z);

    // ডান পাড়: ঘনবসতি পুরান ঢাকা
    const nearAhsan = Math.abs(zc - AHSAN_Z) < 70;
    const nearSadar = zc > -60;
    if (!nearAhsan && !nearSadar) {
      let z = z0;
      while (z > z0 - CHUNK) {
        const d = 7 + Math.random() * 9;
        this.oldBuilding(objs, RIVER_HALF + 8 + Math.random() * 4, z - d / 2, d, 1);
        if (Math.random() < 0.7) this.oldBuilding(objs, RIVER_HALF + 26 + Math.random() * 8, z - d / 2, d, 1, 1.4);
        z -= d + 0.5;
      }
    }
    // বাম পাড়: কেরানীগঞ্জ — টিনের ঘর, গাছ, ডকইয়ার্ড
    {
      let z = z0;
      while (z > z0 - CHUNK) {
        const r = Math.random();
        const d = 6 + Math.random() * 8;
        if (r < 0.35) this.tinShed(objs, -(RIVER_HALF + 9 + Math.random() * 6), z - d / 2, d);
        else if (r < 0.7) this.tree(objs, -(RIVER_HALF + 6 + Math.random() * 20), z - d / 2);
        else this.oldBuilding(objs, -(RIVER_HALF + 14 + Math.random() * 10), z - d / 2, d, -1, 0.8);
        z -= d + 1;
      }
    }
    this.chunks.set(k, objs);
  }

  oldBuilding(objs, x, z, depth, side, hMul = 1) {
    const w = 8 + Math.random() * 8;
    const h = (7 + Math.random() * 14) * hMul;
    const m = buildingMats[Math.floor(Math.random() * buildingMats.length)];
    const b = new THREE.Mesh(scaledBox(w, h, depth), m);
    b.position.set(x + (side * w) / 2, h / 2 + 1, z);
    this.add(b, objs);
    // ছাদের পানির ট্যাংক
    if (Math.random() < 0.6) {
      const t = cyl(0.9, 0.9, 1.4, 0x212121, 10);
      t.position.set(b.position.x + (Math.random() - 0.5) * w * 0.5, h + 1.7, z + (Math.random() - 0.5) * depth * 0.5);
      this.add(t, objs);
    }
    // কার্নিশ
    if (Math.random() < 0.5) {
      const c = box(w + 0.6, 0.4, depth + 0.6, 0xe0d6c0);
      c.position.set(b.position.x, h + 1.1, z);
      this.add(c, objs);
    }
  }

  tinShed(objs, x, z, d) {
    const w = 6 + Math.random() * 4;
    const h = 3 + Math.random() * 2;
    const b = box(w, h, d, [0xb0bec5, 0x8d6e63, 0x90a4ae][Math.floor(Math.random() * 3)]);
    b.position.set(x, h / 2 + 1, z);
    this.add(b, objs);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.2, d + 1), tinMat);
    roof.position.set(x, h + 1.2, z);
    roof.rotation.z = 0.12;
    this.add(roof, objs);
  }

  tree(objs, x, z) {
    const trunk = cyl(0.3, 0.4, 3, 0x5d4037, 6);
    trunk.position.set(x, 2.5, z);
    this.add(trunk, objs);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 1.5, 8, 6), mat(Math.random() < 0.5 ? 0x388e3c : 0x2e7d32));
    top.position.set(x, 5.5, z);
    this.add(top, objs);
  }

  buildSadarghat(objs) {
    // সদরঘাট লঞ্চ টার্মিনাল
    const term = box(16, 9, 70, 0xe3f2fd);
    term.position.set(RIVER_HALF + 10, 5.5, -15);
    this.add(term, objs);
    const band = box(16.2, 1.2, 70.2, 0x1565c0);
    band.position.set(RIVER_HALF + 10, 7, -15);
    this.add(band, objs);
    const roof = box(18, 0.6, 72, 0x37474f);
    roof.position.set(RIVER_HALF + 10, 10.2, -15);
    this.add(roof, objs);
    const sign = textBoard('সদরঘাট লঞ্চ টার্মিনাল', 3, { color: '#fff', bg: 'rgba(183,28,28,0.95)', size: 64 });
    sign.position.set(RIVER_HALF + 1.9, 12.5, -15);
    sign.rotation.y = -Math.PI / 2;
    this.add(sign, objs);
    // পন্টুন
    const pont = box(6, 1, 60, 0x455a64);
    pont.position.set(RIVER_HALF - 3, 0.3, -15);
    this.add(pont, objs);
    this.colliders.push({ x: RIVER_HALF - 3, z: -15, hx: 3, hz: 30, kind: 'pontoon' });
    for (let i = 0; i < 14; i++) {
      const p = makePerson([0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xffffff][i % 5]);
      p.position.set(RIVER_HALF - 2 - Math.random() * 3, 1.3, -40 + Math.random() * 50);
      this.add(p, objs);
    }
    const hawker = textSprite('বরিশাল! বরিশাল! চাঁদপুর!', 1.4, { color: '#fff', bg: 'rgba(0,0,0,0.55)', size: 44 });
    hawker.position.set(RIVER_HALF - 3, 4.5, -5);
    this.add(hawker, objs);
  }

  buildAhsanManzil(objs, z) {
    const x = RIVER_HALF + 22;
    const pink = 0xd9849f;
    const lawn = box(20, 0.4, 70, 0x689f38);
    lawn.position.set(RIVER_HALF + 10, 1.2, z);
    this.add(lawn, objs);
    const main = box(16, 12, 56, pink);
    main.position.set(x + 6, 7, z);
    this.add(main, objs);
    const mid = box(4, 10, 54, 0xe8a5b8);
    mid.position.set(x - 3.5, 6, z);
    this.add(mid, objs);
    // বারান্দার খিলান সারি
    for (let i = -6; i <= 6; i++) {
      const col = cyl(0.35, 0.35, 9, 0xfafafa, 8);
      col.position.set(x - 5.6, 5.5, z + i * 4.2);
      this.add(col, objs);
    }
    // বড় সিঁড়ি
    for (let s = 0; s < 6; s++) {
      const step = box(2, 0.8, 14 - s * 1.2, 0xeeeeee);
      step.position.set(x - 8 - (5 - s) * 1.6, 1.3 + s * 0.8, z);
      this.add(step, objs);
    }
    // গম্বুজ
    const drum = cyl(5, 5, 4, pink, 16);
    drum.position.set(x + 2, 15, z);
    this.add(drum, objs);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc76b8a));
    dome.position.set(x + 2, 17, z);
    dome.scale.y = 1.25;
    this.add(dome, objs);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 8), mat(0xffd54f));
    spire.position.set(x + 2, 25, z);
    this.add(spire, objs);
    const sign = textSprite('আহসান মঞ্জিল', 2.6, { color: '#fff', bg: 'rgba(136,14,79,0.85)', size: 60 });
    sign.position.set(x - 4, 30, z);
    this.add(sign, objs);
  }

  buildGhat(i) {
    const info = ghatInfo(i);
    const objs = [];
    const { side, z } = info;
    const gh = { ...info, objs, waiting: null, people: [] };
    // ভাসমান পন্টুন + কাঠের সাঁকো
    const pont = box(5, 1, 12, 0x546e7a);
    pont.position.set(side * (RIVER_HALF - 3.5), 0.3, z);
    this.add(pont, objs);
    const bridge = box(6, 0.4, 2.4, 0x8d6e63);
    bridge.position.set(side * (RIVER_HALF + 1), 1.1, z);
    this.add(bridge, objs);
    this.colliders.push({ x: side * (RIVER_HALF - 3.5), z, hx: 2.5, hz: 6, kind: 'pontoon', owner: gh });
    // নামের বোর্ড
    const pole = box(0.3, 7, 0.3, 0x424242);
    pole.position.set(side * (RIVER_HALF - 1.5), 4, z - 5);
    this.add(pole, objs);
    const sign = textBoard(info.name, 1.8, { color: '#fff', bg: 'rgba(0,77,64,0.95)', size: 56 });
    sign.position.set(side * (RIVER_HALF - 1.5), 7.5, z - 5);
    sign.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    sign.rotation.y += side * 0.6; // একটু ঘুরাইয়া যাতে সামনে থিকা পড়া যায়
    this.add(sign, objs);
    // চায়ের দোকান
    const stall = box(3, 2.4, 3, 0xffb300);
    stall.position.set(side * (RIVER_HALF + 5), 2.2, z + 4);
    this.add(stall, objs);
    const stallRoof = box(3.6, 0.2, 3.6, 0x6d4c41);
    stallRoof.position.set(side * (RIVER_HALF + 5), 3.5, z + 4);
    this.add(stallRoof, objs);
    // ঘাটের মানুষ
    for (let p = 0; p < 4; p++) {
      const m = makePerson([0x43a047, 0xe53935, 0xffffff, 0x1e88e5][p]);
      m.position.set(side * (RIVER_HALF - 2.5 - Math.random() * 2), 1.3, z - 4 + Math.random() * 8);
      this.add(m, objs);
    }
    // রিং — হলুদ (যাত্রী আছে) / সবুজ (গন্তব্য)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.25, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(info.ringX, 0.25, z);
    this.add(ring, objs);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    beam.position.set(info.ringX, 20, z);
    this.add(beam, objs);
    gh.ring = ring;
    gh.beam = beam;
    ring.visible = beam.visible = false;
    this.ghats.set(i, gh);
    this.onGhatBuilt?.(gh);
  }

  setGhatMarker(gh, mode) {
    // mode: null | 'pickup' | 'dest'
    if (!gh) return;
    gh.ring.visible = gh.beam.visible = !!mode;
    const c = mode === 'dest' ? 0x00e676 : 0xffeb3b;
    gh.ring.material.color.setHex(c);
    gh.beam.material.color.setHex(c);
    gh.beam.material.opacity = mode === 'dest' ? 0.3 : 0.16;
  }

  buildBridge(k, z) {
    const objs = [];
    const b = { objs };
    const deck = box(RIVER_HALF * 2 + 60, 1.6, 12, 0xbdbdbd);
    deck.position.set(0, 15, z);
    this.add(deck, objs);
    for (const s of [-1, 1]) {
      const rail = box(RIVER_HALF * 2 + 60, 1, 0.4, 0xeeeeee);
      rail.position.set(0, 16.3, z + s * 5.8);
      this.add(rail, objs);
    }
    // রিকশা-বাস চলে ব্রিজে (স্থির ছবির মতো)
    for (let i = 0; i < 6; i++) {
      const v = box(i % 2 ? 2 : 5, 2, i % 2 ? 1.5 : 2.3, [0xe53935, 0x43a047, 0x1e88e5, 0xfdd835][i % 4]);
      v.position.set(-40 + i * 16 + Math.random() * 6, 16.8, z + (i % 2 ? 2.5 : -2.5));
      this.add(v, objs);
    }
    for (const px of [-18, 0, 18]) {
      const p = cyl(1.6, 1.8, 16, 0x9e9e9e, 12);
      p.position.set(px, 7, z);
      this.add(p, objs);
      this.colliders.push({ x: px, z, r: 2.2, kind: 'pillar', owner: b });
    }
    const sign = textBoard(bridgeName(k), 2.2, { color: '#fff', bg: 'rgba(21,101,192,0.95)', size: 60 });
    sign.position.set(0, 12.6, z + 6.1);
    this.add(sign, objs);
    this.bridges.set(k, b);
  }

  // সময় অনুযায়ী আকাশ: দিন → গোধূলি → রাত → ভোর
  setTimeOfDay(phase) {
    // phase 0..1 → রং মিশাই
    const keys = [
      [0.0, 0xcfd8dc, 1.1, 1.4],
      [0.4, 0xd7dde0, 1.1, 1.4],
      [0.55, 0xf0a868, 0.85, 1.0],
      [0.65, 0x3a3f5c, 0.45, 0.3],
      [0.88, 0x1b2034, 0.35, 0.15],
      [0.96, 0xe7b9a0, 0.8, 0.8],
      [1.0, 0xcfd8dc, 1.1, 1.4],
    ];
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (phase >= keys[i][0] && phase <= keys[i + 1][0]) {
        a = keys[i];
        b = keys[i + 1];
        break;
      }
    }
    const f = (phase - a[0]) / Math.max(0.0001, b[0] - a[0]);
    const col = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), f);
    this.scene.background.copy(col);
    this.scene.fog.color.copy(col);
    this.hemi.intensity = a[2] + (b[2] - a[2]) * f;
    this.sun.intensity = a[3] + (b[3] - a[3]) * f;
    this.sun.color.copy(new THREE.Color(0xfff1d6).lerp(new THREE.Color(0xff9a50), phase > 0.45 && phase < 0.7 ? 0.7 : 0));
    const night = phase > 0.6 && phase < 0.95;
    this.scene.fog.near = night ? 30 : 80;
    this.scene.fog.far = night ? 230 : 420;
    return this.hemi.intensity;
  }
}
