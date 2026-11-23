// সব ৩ডি মডেল কোড দিয়া বানানো (লো-পলি)
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

export function box(w, h, d, color, opts) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : mat(color, opts));
}
export function cyl(rt, rb, h, color, seg = 10, opts) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'object' ? color : mat(color, opts));
}
function at(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

export const FONT = '"Hind Siliguri", "Noto Sans Bengali", sans-serif';

// বাংলা লেখা দিয়া স্প্রাইট/বোর্ড
export function textCanvas(text, { size = 64, color = '#fff', bg = 'rgba(0,0,0,0)', pad = 16, stroke = null, weight = 700 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px ${FONT}`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  const h = Math.ceil(size * 1.5) + pad;
  c.width = w;
  c.height = h;
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = bg;
  if (bg !== 'rgba(0,0,0,0)') {
    const r = 14;
    g.beginPath();
    g.roundRect ? g.roundRect(0, 0, w, h, r) : g.rect(0, 0, w, h);
    g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineWidth = size / 7;
    g.strokeStyle = stroke;
    g.strokeText(text, w / 2, h / 2 + size * 0.05);
  }
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + size * 0.05);
  return c;
}

export function textSprite(text, height = 2, opts = {}) {
  const c = textCanvas(text, opts);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: opts.fog ?? true }));
  s.scale.set((height * c.width) / c.height, height, 1);
  return s;
}

export function textBoard(text, height = 2, opts = {}) {
  const c = textCanvas(text, opts);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((height * c.width) / c.height, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  return m;
}

// নৌকার খোল — উপর থিকা দেখলে পাতার মতো
function hullGeometry(len, wid, depth) {
  const s = new THREE.Shape();
  const L = len / 2;
  const W = wid / 2;
  s.moveTo(0, -L);
  s.quadraticCurveTo(W * 1.25, -L * 0.35, W, 0);
  s.quadraticCurveTo(W * 1.2, L * 0.45, 0, L);
  s.quadraticCurveTo(-W * 1.2, L * 0.45, -W, 0);
  s.quadraticCurveTo(-W * 1.25, -L * 0.35, 0, -L);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // এখন উচ্চতা -y দিকে
  g.translate(0, depth, 0);
  return g;
}

export function makePerson(shirt = 0x2e7d32, opts = {}) {
  const g = new THREE.Group();
  const body = at(cyl(0.28, 0.34, 0.9, shirt, 8), 0, 0.45, 0);
  const lower = at(cyl(0.34, 0.36, 0.5, opts.lungi ?? 0x1e3a8a, 8), 0, -0.05, 0);
  const head = at(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat(0x8d5a3b)), 0, 1.12, 0);
  g.add(body, lower, head);
  if (opts.cap) g.add(at(cyl(0.22, 0.24, 0.14, opts.cap, 10), 0, 1.32, 0));
  if (opts.gamchha) g.add(at(cyl(0.3, 0.3, 0.1, 0xc62828, 10), 0, 0.85, 0));
  return g;
}

// খেলোয়াড়ের নৌকা — রং করা কাঠের নাও
export function makePlayerBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(hullGeometry(6, 1.9, 0.9), mat(0x6d4022));
  hull.position.y = -0.45;
  g.add(hull);
  const rim = new THREE.Mesh(hullGeometry(6.15, 2.0, 0.18), mat(0xd32f2f));
  rim.position.y = 0.38;
  g.add(rim);
  const stripe = new THREE.Mesh(hullGeometry(6.2, 2.02, 0.08), mat(0xfbc02d));
  stripe.position.y = 0.24;
  g.add(stripe);
  // ছই (বাঁশের ছাউনি)
  const chhoi = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 2.0, 12, 1, true, Math.PI / 2, Math.PI),
    mat(0xc8a165, { side: THREE.DoubleSide })
  );
  chhoi.rotation.x = Math.PI / 2;
  chhoi.position.set(0, 0.45, 0.2);
  g.add(chhoi);
  // মাঝি
  const majhi = makePerson(0xf5f5f5, { lungi: 0x1565c0, gamchha: true });
  majhi.position.set(0, 0.55, 2.2);
  g.add(majhi);
  const oar = box(0.12, 0.12, 3.2, 0x8d6e63);
  oar.position.set(0.7, 0.6, 2.6);
  oar.rotation.set(0.5, 0.3, 0);
  g.add(oar);
  g.userData.oar = oar;
  // যাত্রী (বসা)
  const pass = makePerson(0x7b1fa2, { lungi: 0x37474f });
  pass.scale.setScalar(0.85);
  pass.position.set(0, 0.35, 0.2);
  pass.visible = false;
  g.add(pass);
  g.userData.passenger = pass;
  // হারিকেন
  const lamp = at(cyl(0.12, 0.12, 0.3, 0xffcc66, 8, { emissive: 0xffaa33, emissiveIntensity: 1 }), 0, 0.6, -2.3);
  g.add(lamp);
  // ঢাল (বাকরখানি শিল্ড)
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shield.scale.set(0.8, 0.5, 1.1);
  shield.visible = false;
  g.add(shield);
  g.userData.shield = shield;
  return g;
}

// অন্য মাঝির নৌকা
const NOUKA_COLORS = [0x00897b, 0x1e88e5, 0x8e24aa, 0xf4511e, 0x43a047, 0xfdd835];
export function makeNouka() {
  const g = new THREE.Group();
  const c = NOUKA_COLORS[Math.floor(Math.random() * NOUKA_COLORS.length)];
  const hull = new THREE.Mesh(hullGeometry(5.5, 1.8, 0.8), mat(0x5d3a1a));
  hull.position.y = -0.4;
  g.add(hull);
  const rim = new THREE.Mesh(hullGeometry(5.6, 1.86, 0.16), mat(c));
  rim.position.y = 0.32;
  g.add(rim);
  if (Math.random() < 0.6) {
    const chhoi = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.8, 10, 1, true, Math.PI / 2, Math.PI),
      mat(0x9e7b4f, { side: THREE.DoubleSide })
    );
    chhoi.rotation.x = Math.PI / 2;
    chhoi.position.set(0, 0.4, 0);
    g.add(chhoi);
  }
  const m = makePerson(NOUKA_COLORS[Math.floor(Math.random() * NOUKA_COLORS.length)], { lungi: 0x283593 });
  m.position.set(0, 0.5, 2);
  g.add(m);
  for (let i = 0; i < Math.floor(Math.random() * 3); i++) {
    const p = makePerson(NOUKA_COLORS[Math.floor(Math.random() * 6)]);
    p.scale.setScalar(0.8);
    p.position.set((Math.random() - 0.5) * 0.6, 0.3, -1.6 + i * 0.9);
    g.add(p);
  }
  return g;
}

// লঞ্চ — রঙিন তিনতলা
const LAUNCH_STRIPES = [
  [0xd32f2f, 0x1565c0], [0x2e7d32, 0xfbc02d], [0x6a1b9a, 0xef6c00], [0x00838f, 0xc62828], [0x1565c0, 0xfdd835],
];
export function makeLaunch(name) {
  const g = new THREE.Group();
  const [c1, c2] = LAUNCH_STRIPES[Math.floor(Math.random() * LAUNCH_STRIPES.length)];
  const L = 26;
  const W = 7;
  g.add(at(box(W, 1.6, L, 0x7f1d1d), 0, -0.2, 0));
  g.add(at(box(W + 0.05, 1.2, L, 0xf5f5f5), 0, 1.2, 0));
  const bow = box(W * 0.71, 2.8, W * 0.71, 0xf5f5f5);
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.5, -L / 2);
  g.add(bow);
  g.add(at(box(W + 0.1, 0.35, L, c1), 0, 1.9, 0));
  // ডেক ১
  g.add(at(box(W - 0.4, 2, L - 4, 0xfafafa), 0, 3, 0.5));
  g.add(at(box(W - 0.35, 0.6, L - 4, 0x263238), 0, 3.2, 0.5));
  g.add(at(box(W - 0.3, 0.3, L - 4, c2), 0, 4.05, 0.5));
  // ডেক ২
  g.add(at(box(W - 1, 1.8, L - 9, 0xfafafa), 0, 5.1, 1.5));
  g.add(at(box(W - 0.95, 0.5, L - 9, 0x37474f), 0, 5.3, 1.5));
  g.add(at(box(W - 0.9, 0.25, L - 9, c1), 0, 6.05, 1.5));
  // সারেং ঘর
  g.add(at(box(W - 2.5, 1.4, 3, 0xfafafa), 0, 6.9, -3.5));
  g.add(at(box(W - 2.4, 0.5, 3.05, 0x1a237e), 0, 7.1, -3.5));
  // চোঙা
  g.add(at(cyl(0.45, 0.5, 2.2, c2, 10), 0, 7.6, 3));
  g.add(at(cyl(0.47, 0.47, 0.4, 0x212121, 10), 0, 8.8, 3));
  // পতাকা
  g.add(at(box(0.05, 1.6, 0.05, 0x9e9e9e), 0, 8.6, -4.5));
  g.add(at(box(0.02, 0.5, 0.8, 0x006a4e), 0, 9.1, -4.1));
  g.add(at(cyl(0.16, 0.16, 0.03, 0xf42a41, 10), 0.03, 9.1, -4.0).rotateZ(Math.PI / 2));
  // নাম
  const nb1 = textBoard(name, 1.3, { color: '#b71c1c', size: 56 });
  nb1.position.set(W / 2 + 0.06, 1.2, -4);
  nb1.rotation.y = Math.PI / 2;
  const nb2 = nb1.clone();
  nb2.position.x = -W / 2 - 0.06;
  nb2.rotation.y = -Math.PI / 2;
  g.add(nb1, nb2);
  // ডেকে মানুষ
  for (let i = 0; i < 8; i++) {
    const p = makePerson(NOUKA_COLORS[i % 6]);
    p.scale.setScalar(0.9);
    p.position.set((Math.random() - 0.5) * (W - 2), 4.35, -8 + Math.random() * 16);
    g.add(p);
  }
  g.userData.halfW = W / 2;
  g.userData.halfL = L / 2 + 2.2;
  return g;
}

// নৌ-পুলিশের স্পিডবোট
export function makePolice() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(hullGeometry(6.5, 2.3, 0.9), mat(0xeceff1));
  hull.position.y = -0.4;
  g.add(hull);
  const band = new THREE.Mesh(hullGeometry(6.6, 2.36, 0.2), mat(0x0d47a1));
  band.position.y = 0.2;
  g.add(band);
  g.add(at(box(1.6, 0.9, 1.6, 0x0d47a1), 0, 0.9, 0.6));
  const red = at(box(0.5, 0.25, 0.3, 0xff1744, { emissive: 0xff1744, emissiveIntensity: 1 }), -0.35, 1.5, 0.6);
  const blue = at(box(0.5, 0.25, 0.3, 0x2979ff, { emissive: 0x2979ff, emissiveIntensity: 1 }), 0.35, 1.5, 0.6);
  g.add(red, blue);
  g.userData.lights = [red, blue];
  const p1 = makePerson(0x1a237e, { lungi: 0x1a237e, cap: 0x1a237e });
  p1.position.set(0, 0.4, 1.9);
  g.add(p1);
  const sign = textSprite('নৌ-পুলিশ', 1.1, { color: '#fff', bg: 'rgba(13,71,161,0.9)', size: 48 });
  sign.position.set(0, 2.6, 0.6);
  g.add(sign);
  return g;
}

export function makeHyacinth(r) {
  const g = new THREE.Group();
  const n = Math.round(r * 5);
  const leaf = new THREE.SphereGeometry(0.7, 7, 5);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    const m = new THREE.Mesh(leaf, mat(i % 3 ? 0x2e7d32 : 0x558b2f));
    m.scale.set(1, 0.35, 1);
    m.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
    g.add(m);
    if (i % 4 === 0) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), mat(0xb39ddb));
      f.position.set(m.position.x, 0.45, m.position.z);
      g.add(f);
    }
  }
  return g;
}

const TRASH_COLORS = [0x29b6f6, 0xef5350, 0xffee58, 0xffffff, 0xab47bc];
export function makeTrash() {
  const t = Math.random();
  const c = TRASH_COLORS[Math.floor(Math.random() * TRASH_COLORS.length)];
  let m;
  if (t < 0.5) {
    m = cyl(0.18, 0.18, 0.8, c, 8, { transparent: true, opacity: 0.85 });
    m.rotation.z = Math.PI / 2;
  } else {
    m = box(0.7, 0.08, 0.5, c);
  }
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function makeFood(type, icon) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.25, 8, 16), mat(0xff6d00));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 6, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide })
  );
  glow.position.y = 3;
  g.add(glow);
  const s = textSprite(icon, 2, { size: 80 });
  s.position.y = 2;
  g.add(s);
  g.userData.sprite = s;
  return g;
}

// ঘুড়ি (সাকরাইনের আমেজ)
export function makeKite() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 1.2);
  s.lineTo(0.8, 0);
  s.lineTo(0, -1.2);
  s.lineTo(-0.8, 0);
  s.lineTo(0, 1.2);
  const cols = [0xe53935, 0xfdd835, 0x1e88e5, 0x8e24aa, 0x43a047, 0xff7043];
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat(cols[Math.floor(Math.random() * cols.length)], { side: THREE.DoubleSide }));
  g.add(m);
  const tail = box(0.05, 1.6, 0.05, 0xffffff);
  tail.position.y = -2;
  g.add(tail);
  return g;
}
