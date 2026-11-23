import * as THREE from 'three';
import { World, RIVER_HALF, CHUNK, ghatInfo, BRIDGE_Z, BRIDGE_EVERY, AHSAN_Z, bridgeName } from './world.js';
import { makePlayerBoat, makeNouka, makeLaunch, makePolice, makeHyacinth, makeTrash, makeFood, textSprite, FONT } from './models.js';
import * as T from './text.js';
import * as A from './audio.js';
import { keys, initInput, consume, clearOnce } from './input.js';

const { bn, bnMoney, pick } = T;
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round10 = (v) => Math.max(10, Math.round(v / 10) * 10);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- রেন্ডারার ----------
const canvas = $('game');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 700);
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 78 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const LANES = [-20, 0, 20];
const BEST_KEY = 'majhir-rasta-best';
const PASSENGER_WEIGHTS = { groom: 1, fish: 1.3, aunty: 1.2, tourist: 1, student: 1.2, trader: 1, neta: 0.45 };

let scene, world, boat, lantern;
let state = 'menu'; // menu | play | pause | over
let G = null;
let camH = 0;

function weightedPassenger() {
  const total = T.PASSENGERS.reduce((s, p) => s + PASSENGER_WEIGHTS[p.id], 0);
  let r = Math.random() * total;
  for (const p of T.PASSENGERS) {
    r -= PASSENGER_WEIGHTS[p.id];
    if (r <= 0) return p;
  }
  return T.PASSENGERS[0];
}

function readBest() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) || { money: 0, dist: 0 };
  } catch {
    return { money: 0, dist: 0 };
  }
}
function writeBest(b) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b));
  } catch {
    /* প্রাইভেট মোডে না থাকলেও চলবো */
  }
}

// ---------- নতুন খেলা ----------
function disposeScene(s) {
  if (!s) return;
  s.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isSprite && o.material) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}

function newGame() {
  disposeScene(scene);
  scene = new THREE.Scene();
  world = new World(scene);
  world.onGhatBuilt = onGhatBuilt;
  G = {
    x: -8, z: 10, h: 0, speed: 0, ext: new THREE.Vector2(),
    hull: 100, stamina: 100, money: 0, damage: 0, heat: 0, lastHit: -99, lastStatic: -99,
    t: 0, timeScale: 1, minZ: 10, delivered: 0, trash: 0,
    passenger: null, haggle: null,
    buffs: { shield: 0, lassi: 0, biryani: 0 },
    launches: [], noukas: [], hyacinths: [], trashes: [], foods: [], police: null,
    spawned: new Set(), launchTimer: 4, nextRide: 9, shake: 0,
    phaseFlags: {}, toldAhsan: false, nextBridge: 0, backWarn: 0, inWeed: false, weedToast: 0,
    over: false, overT: 0, cause: null,
  };
  boat = makePlayerBoat();
  scene.add(boat);
  lantern = new THREE.PointLight(0xffb74d, 0, 45, 1);
  lantern.position.set(0, 3, -3);
  boat.add(lantern);
  // সদরঘাটে বাঁধা লঞ্চ
  [35, 5, -25].forEach((z) => {
    const l = makeLaunch(pick(T.LAUNCH_NAMES));
    l.position.set(19.5, 0, z);
    scene.add(l);
    world.colliders.push({ x: 19.5, z, hx: 3.5, hz: 15, kind: 'docked' });
  });
  world.update(G.z, 0);
  camH = 0;
  placeBoat(0);
  camera.position.set(G.x + 30, 18, G.z + 30);
  camera.lookAt(G.x, 0, G.z - 10);
}

function onGhatBuilt(gh) {
  if (!G) return;
  if (gh.index === 0 || Math.random() < 0.72) {
    gh.waiting = gh.index === 0 ? T.PASSENGERS[4] : weightedPassenger();
    const s = textSprite(gh.waiting.icon, 2.4, { size: 80 });
    s.position.set(gh.side * (RIVER_HALF - 4), 4.2, gh.z);
    world.add(s, gh.objs);
    gh.waitSprite = s;
  }
  refreshMarker(gh);
}

function refreshMarker(gh) {
  let mode = null;
  if (G.passenger && G.passenger.dest === gh.index) mode = 'dest';
  else if (!G.passenger && gh.waiting) mode = 'pickup';
  world.setGhatMarker(gh, mode);
}
const refreshMarkers = () => world.ghats.forEach(refreshMarker);

// ---------- UI সাহায্যকারী ----------
let toastTimer = 0;
function toast(msg, dur = 1.8) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = dur;
}
let bubbleTimer = 0;
function bubble(icon, name, text, dur = 3.4) {
  $('bubble-icon').textContent = icon;
  $('bubble-name').textContent = name;
  $('bubble-text').textContent = text;
  const el = $('bubble');
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  bubbleTimer = dur;
}
function passengerSay(kind) {
  const p = G.passenger;
  if (p) bubble(p.type.icon, p.type.name, pick(p.type[kind]));
  else if (kind === 'hit') bubble('🚣', 'আপনি (মাঝি)', pick(T.MAJHI_HIT), 2.2);
}

// ---------- জিনিসপাতি স্পন ----------
function spawnChunkStuff(k) {
  const z0 = -k * CHUNK;
  const d = difficulty();
  const zIn = () => rand(z0 - CHUNK, z0);
  const xIn = (m = 24) => rand(-m, m);
  let n = (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.2 * d ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const mesh = makeNouka();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const o = { mesh, x: xIn(), z: zIn(), vz: dir * rand(1, 3), vx: 0, spin: 0, r: 1.7, cd: 0, phase: Math.random() * 6 };
    mesh.rotation.y = dir > 0 ? Math.PI : 0;
    scene.add(mesh);
    G.noukas.push(o);
  }
  if (Math.random() < 0.3 + 0.08 * d) {
    const r = rand(2.5, 5);
    const mesh = makeHyacinth(r);
    const o = { mesh, x: xIn(22), z: zIn(), r, warned: false };
    scene.add(mesh);
    G.hyacinths.push(o);
  }
  n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const mesh = makeTrash();
    const o = { mesh, x: xIn(26), z: zIn(), phase: Math.random() * 6 };
    scene.add(mesh);
    G.trashes.push(o);
  }
  if (Math.random() < 0.32) {
    const r = Math.random();
    const type = r < 0.38 ? 'chaa' : r < 0.6 ? 'bakarkhani' : r < 0.84 ? 'lassi' : 'biryani';
    const mesh = makeFood(type, T.FOODS[type].icon);
    const o = { mesh, type, x: xIn(22), z: zIn(), phase: Math.random() * 6 };
    scene.add(mesh);
    G.foods.push(o);
  }
}

function spawnLaunch() {
  const fromBehind = G.minZ < -200 && Math.random() < 0.22;
  const vz = fromBehind ? -Math.max(14, G.speed + 5) : clamp(rand(5, 9) + difficulty() * 1.2, 5, 15);
  const z = fromBehind ? G.z + 150 : G.z - 400;
  const free = LANES.filter((lane) =>
    G.launches.every((l) => Math.abs(l.lane - lane) > 1 || (Math.sign(l.vz) === Math.sign(vz) && Math.abs(l.z - z) > 90))
  );
  if (!free.length) return;
  const lane = pick(free);
  const mesh = makeLaunch(pick(T.LAUNCH_NAMES));
  mesh.rotation.y = vz > 0 ? Math.PI : 0;
  const o = { mesh, lane, x: lane + rand(-0.8, 0.8), z, vz, halfW: mesh.userData.halfW, halfL: mesh.userData.halfL, horned: fromBehind };
  scene.add(mesh);
  G.launches.push(o);
  if (fromBehind) {
    A.horn(0.4, 1.4);
    toast(pick(T.TOASTS.launchBehind));
  }
}

function difficulty() {
  return 1 + Math.max(0, 10 - G.minZ) / 900;
}
function distance() {
  return Math.max(0, Math.round(10 - G.minZ));
}

// ---------- দরাদরি ----------
function startHaggle(gh) {
  const type = gh.waiting;
  gh.waiting = null;
  if (gh.waitSprite) gh.waitSprite.visible = false;
  refreshMarker(gh);
  const hops = 2 + Math.floor(Math.random() * 3);
  const dest = gh.index + hops;
  const offer = type.neta ? 0 : round10(type.fare * (hops / 3) * rand(0.85, 1.15));
  const counter = type.neta ? 150 : round10(offer * 1.5);
  G.haggle = { type, dest, offer, counter, t: 5, max: 5 };
  G.timeScale = 0.2;
  $('hg-icon').textContent = type.icon;
  $('hg-name').textContent = type.name + ' → ' + ghatInfo(dest).name;
  $('hg-text').textContent = pick(type.pickup);
  $('hg-offer').textContent = type.neta ? '০ (ফ্রি! হা হা)' : bnMoney(offer);
  $('hg-accept-t').textContent = type.neta ? 'জ্বি ভাই, উঠেন' : 'চলেন, উঠেন!';
  $('hg-counter-t').textContent = type.neta ? '৳১৫০ না দিলে নামেন!' : `${bnMoney(counter)} না দিলে যামু না!`;
  $('haggle').classList.remove('hidden');
  A.whistle();
}

function resolveHaggle(choice) {
  const h = G.haggle;
  if (!h) return;
  G.haggle = null;
  G.timeScale = 1;
  $('haggle').classList.add('hidden');
  let fare = h.offer;
  if (choice === 'counter') {
    if (Math.random() < h.type.haggle) {
      fare = h.counter;
      bubble(h.type.icon, h.type.name, h.type.neta ? 'আইচ্ছা নে, তুইও মনে রাখিস!' : pick(['আইচ্ছা যা, তাই দিমু! চালা!', 'ডাকাইত মাঝি! আইচ্ছা চলো।', 'হুঁহ্! ঠিক আছে, জলদি চালাও।']));
      A.coin();
    } else {
      bubble(h.type.icon, h.type.name, h.type.neta ? 'তোর নৌকা বন্ধ কইরা দিমু! দেখিস!' : pick(['যা ব্যাটা, অন্য নৌকায় যামু!', 'এত ভাড়া? সাঁতরাইয়া যামু তাও ভালা!', 'মগের মুল্লুক পাইছো নাকি?']));
      toast(pick(T.TOASTS.walkaway));
      if (h.type.neta) addHeat(1.2);
      refreshMarkers();
      return;
    }
  }
  const destInfo = ghatInfo(h.dest);
  const dist = Math.abs(destInfo.z - G.z) + 25;
  const total = (dist / 8.5 + 10) * h.type.time;
  G.passenger = { type: h.type, dest: h.dest, destInfo, fare, timeLeft: total, timeTotal: total, late: false };
  boat.userData.passenger.visible = true;
  G.nextRide = rand(6, 10);
  refreshMarkers();
  if (choice !== 'counter') bubble(h.type.icon, h.type.name, pick(h.type.ride));
}

function deliver() {
  const p = G.passenger;
  const onTime = p.timeLeft > 0;
  let pay = p.fare * (onTime ? 1 : 0.5);
  let tip = onTime && p.timeLeft / p.timeTotal > 0.35 && p.fare > 0 ? round10(p.fare * 0.25) : 0;
  const mult = G.buffs.biryani > 0 ? 2 : 1;
  pay = Math.round(pay * mult);
  tip *= mult;
  G.money += pay + tip;
  G.delivered++;
  bubble(p.type.icon, p.type.name, pick(onTime ? p.type.deliver : p.type.late));
  toast(`+${bnMoney(pay)}${tip ? ` (বখশিশ ${bnMoney(tip)})` : ''}${mult > 1 ? ' 🍛×২' : ''}`);
  A.coin();
  G.passenger = null;
  boat.userData.passenger.visible = false;
  refreshMarkers();
}

function dropPassenger(line) {
  const p = G.passenger;
  bubble(p.type.icon, p.type.name, line);
  G.passenger = null;
  boat.userData.passenger.visible = false;
  A.splash();
  refreshMarkers();
}

// ---------- ক্ষতি ও পুলিশ ----------
function addHeat(v) {
  G.heat = clamp(G.heat + v, 0, 5);
  G.lastHit = G.t;
}

function takeHit({ taka = 0, hull = 0, heat = 0, toastMsg = null, strength = 1 }) {
  G.damage += taka;
  if (G.buffs.shield <= 0) G.hull -= hull;
  addHeat(heat);
  G.shake = Math.max(G.shake, 0.25 * strength);
  A.bump(strength);
  if (G.passenger && G.passenger.type.fragile) G.passenger.fare = Math.round(G.passenger.fare * (1 - G.passenger.type.fragile));
  passengerSay('hit');
  if (toastMsg) toast(toastMsg);
  if (G.hull <= 0) gameOver('wreck');
}

function gameOver(cause) {
  if (G.over) return;
  G.over = true;
  G.cause = cause;
  G.overT = 0;
  state = 'over';
  A.siren(false);
  A.crash();
  $('haggle').classList.add('hidden');
  $('touch').classList.add('hidden');
  G.haggle = null;
  G.timeScale = 1;
}

function showNewspaper() {
  const c = T.GAMEOVER[G.cause];
  $('hud').classList.add('hidden');
  $('bubble').classList.add('hidden');
  $('dir-arrow').classList.add('hidden');
  let date;
  try {
    date = new Date().toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    date = bn(new Date().toLocaleDateString());
  }
  $('np-date').textContent = date;
  $('np-headline').textContent = c.headline;
  $('np-sub').textContent = c.sub;
  $('np-photo').textContent = { launch: '🚣💥🚢', police: '🚣🚨👮', wreck: '🪵💦🪵' }[G.cause];
  $('np-money').textContent = bnMoney(G.money);
  $('np-damage').textContent = bnMoney(G.damage);
  $('np-pass').textContent = bn(G.delivered) + ' জন';
  $('np-trash').textContent = bn(G.trash) + 'টা';
  $('np-dist').textContent = bn(distance()) + ' মিটার';
  const d = G.damage;
  $('np-equiv').textContent =
    d < 50
      ? 'কিছুই না! আপনি নদীর কোনো ক্ষতি করেন নাই। পত্রিকা পুরা অবাক!'
      : [
          `${bn(Math.floor(d / 8))}টা বাকরখানি`,
          `${bn(Math.floor(d / 350))} প্লেট কাচ্চি বিরিয়ানি`,
          `${bn(Math.floor(d / 10))} কাপ চা`,
          d >= 60000 ? `${bn(Math.floor(d / 60000))}টা নতুন নৌকা` : `${bn(Math.floor(d / 120))} গ্লাস লাচ্ছি`,
        ].join(' • ');
  $('np-line').textContent = pick(T.NEWS_LINES);
  const best = readBest();
  const record = G.money > best.money;
  if (record) writeBest({ money: G.money, dist: Math.max(best.dist, distance()) });
  else if (distance() > best.dist) writeBest({ ...best, dist: distance() });
  $('np-best').textContent = record ? '🏆 নতুন রেকর্ড! সদরঘাটে আপনার নামে মিষ্টি বিলানো হইতেছে!' : `সেরা আয়: ${bnMoney(best.money)}`;
  $('gameover').classList.remove('hidden');
}

// ---------- আপডেট ----------
function update(dt) {
  if (G.haggle) {
    G.haggle.t -= dt;
    $('hg-time').style.width = (100 * Math.max(0, G.haggle.t)) / G.haggle.max + '%';
    if (consume('opt1')) resolveHaggle('accept');
    else if (consume('opt2')) resolveHaggle('counter');
    else if (G.haggle.t <= 0) resolveHaggle('accept');
  } else {
    consume('opt1');
    consume('opt2');
  }
  const sdt = dt * G.timeScale;
  G.t += sdt;
  updatePlayer(sdt);
  if (G.over) return;
  updateSpawns(sdt);
  updateThings(sdt);
  updateGhats(sdt);
  updatePolice(sdt);
  updateTimeOfDay();
  world.update(G.z, G.t);
  placeBoat(sdt);
  updateCamera(dt);
  updateHUD(dt);
}

function updatePlayer(dt) {
  const B = G.buffs;
  for (const k in B) B[k] = Math.max(0, B[k] - dt);
  let maxSp = B.lassi > 0 ? 17 : 12;
  if (G.passenger) maxSp *= G.passenger.type.weight;
  // কচুরিপানা
  G.inWeed = G.hyacinths.some((h) => Math.hypot(h.x - G.x, h.z - G.z) < h.r + 0.6);
  if (G.inWeed) {
    maxSp *= 0.38;
    if (G.t > G.weedToast) {
      toast(pick(T.TOASTS.hyacinth));
      G.weedToast = G.t + 4;
    }
  }
  const boosting = keys.boost && G.stamina > 1 && G.speed > -0.5;
  if (boosting) {
    maxSp += 8;
    G.stamina -= 24 * dt;
  } else {
    G.stamina = Math.min(100, G.stamina + 7 * dt);
  }
  if (keys.up || boosting) G.speed += (boosting ? 22 : 10) * dt;
  else if (keys.down) G.speed -= 14 * dt;
  else G.speed -= Math.sign(G.speed) * Math.min(Math.abs(G.speed), 3 * dt);
  if (G.speed > maxSp) G.speed = Math.max(maxSp, G.speed - 16 * dt);
  G.speed = Math.max(-4, G.speed);

  const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const rate = 1.9 * Math.min(1, 0.4 + Math.abs(G.speed) / 8);
  G.h += turn * rate * dt * (G.speed < -0.5 ? -1 : 1);
  if (G.passenger?.type.rocky) G.h += Math.sin(G.t * 2.1) * 0.3 * dt;
  G.h = wrapAngle(G.h);
  G.turn = turn;

  const fx = -Math.sin(G.h);
  const fz = -Math.cos(G.h);
  G.x += (fx * G.speed + G.ext.x) * dt;
  G.z += (fz * G.speed + G.ext.y + 0.4) * dt; // ০.৪ = স্রোত
  G.ext.multiplyScalar(Math.exp(-2.5 * dt));

  // পাড়
  const lim = RIVER_HALF - 1.8;
  if (Math.abs(G.x) > lim) {
    const s = Math.sign(G.x);
    G.x = s * lim;
    if (Math.sign(fx) === s && Math.abs(fx * G.speed) > 0.5) {
      G.h = wrapAngle(-G.h);
      if (Math.abs(fx * G.speed) > 5 && G.t - G.lastStatic > 0.8) {
        G.lastStatic = G.t;
        takeHit({ taka: 300, hull: 3, heat: 0.1, toastMsg: pick(T.TOASTS.bank), strength: 0.6 });
      }
      G.speed *= 0.6;
    }
    G.ext.x = 0;
  }
  // পিছে বেশি যাওয়া নিষেধ
  G.minZ = Math.min(G.minZ, G.z);
  if (G.z > G.minZ + 110) {
    G.z = G.minZ + 110;
    G.speed = 0;
    if (G.t > G.backWarn) {
      toast('পিছে যাওনের টাইম নাই মাঝি, সামনে চলেন!');
      G.backWarn = G.t + 3;
    }
  }

  // স্থির বাধা: পিলার, পন্টুন, বাঁধা লঞ্চ
  for (const c of world.colliders) {
    const hit = c.r ? circleHit(c.x, c.z, c.r + 1.6) : boxHit(c.x, c.z, c.hx, c.hz, 1.6);
    if (!hit) continue;
    G.x += hit.nx * hit.depth;
    G.z += hit.nz * hit.depth;
    const vIn = -(fx * G.speed * hit.nx + fz * G.speed * hit.nz);
    if (vIn > 0) {
      G.ext.x += hit.nx * vIn * 0.6;
      G.ext.y += hit.nz * vIn * 0.6;
      G.speed *= 0.3;
    }
    if (vIn > 3 && G.t - G.lastStatic > 0.7) {
      G.lastStatic = G.t;
      const pillar = c.kind === 'pillar';
      takeHit({
        taka: pillar ? 5000 : c.kind === 'docked' ? 2500 : 1200,
        hull: 5 + vIn * 0.9,
        heat: pillar ? 0.8 : 0.4,
        toastMsg: pillar ? pick(T.TOASTS.public) : null,
        strength: 1,
      });
    }
  }

  // মাঝিরে বাতাস দেই — হর্ন
  if (consume('horn')) A.whistle();
}

function circleHit(cx, cz, r) {
  const dx = G.x - cx;
  const dz = G.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r || d === 0) return null;
  return { nx: dx / d, nz: dz / d, depth: r - d };
}
function boxHit(cx, cz, hx, hz, r) {
  const qx = clamp(G.x, cx - hx, cx + hx);
  const qz = clamp(G.z, cz - hz, cz + hz);
  const dx = G.x - qx;
  const dz = G.z - qz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return null;
  if (d === 0) {
    // ভিতরে ঢুইকা গেছে — নিকটতম দিকে বাইর করি
    const px = hx - Math.abs(G.x - cx);
    const pz = hz - Math.abs(G.z - cz);
    if (px < pz) return { nx: Math.sign(G.x - cx) || 1, nz: 0, depth: px + r };
    return { nx: 0, nz: Math.sign(G.z - cz) || 1, depth: pz + r };
  }
  return { nx: dx / d, nz: dz / d, depth: r - d };
}

function updateSpawns(dt) {
  const kNow = Math.floor(-G.z / CHUNK);
  for (let k = Math.max(1, kNow + 1); k <= kNow + 7; k++) {
    if (!G.spawned.has(k)) {
      G.spawned.add(k);
      spawnChunkStuff(k);
    }
  }
  G.launchTimer -= dt;
  const maxL = Math.min(2 + Math.floor(distance() / 450), 7);
  if (G.launchTimer <= 0) {
    if (G.launches.length < maxL) spawnLaunch();
    G.launchTimer = rand(3, 7) / Math.sqrt(difficulty());
  }
}

function removeFrom(list, o) {
  scene.remove(o.mesh);
  o.mesh.traverse((c) => {
    if (c.isSprite) {
      c.material.map?.dispose();
      c.material.dispose();
    }
  });
  list.splice(list.indexOf(o), 1);
}

const tooFar = (z) => z > G.z + 170 || z < G.z - 560;

function updateThings(dt) {
  const t = G.t;
  // লঞ্চ
  for (const l of [...G.launches]) {
    l.z += l.vz * dt;
    l.mesh.position.set(l.x, Math.sin(t * 1.3 + l.z * 0.05) * 0.1, l.z);
    l.mesh.rotation.z = Math.sin(t * 0.9 + l.lane) * 0.015;
    if (tooFar(l.z)) {
      removeFrom(G.launches, l);
      continue;
    }
    const dx = G.x - l.x;
    const dz = G.z - l.z;
    // হর্ন
    if (!l.horned && l.vz > 0 && dz > 0 && dz < 130 && Math.abs(dx) < l.halfW + 5) {
      l.horned = true;
      A.horn(0.35, 1.1);
      toast(pick(T.TOASTS.launchAhead));
    }
    // ধাক্কা
    const ox = Math.max(Math.abs(dx) - l.halfW, 0);
    const oz = Math.max(Math.abs(dz) - l.halfL, 0);
    if (ox * ox + oz * oz < 1.6 * 1.6) {
      if (G.buffs.shield > 0) {
        G.buffs.shield = 0;
        G.ext.x = Math.sign(dx || 1) * 26;
        G.speed = -2;
        G.damage += 8000;
        G.shake = 0.6;
        A.bump(1.5);
        A.horn(0.4, 0.8);
        toast('বাকরখানির জোরে বাঁইচা গেলেন! 🥯🛡️');
      } else {
        gameOver('launch');
        return;
      }
    } else if (Math.abs(dz) < l.halfL + 4 && Math.abs(dx) < l.halfW + 7) {
      // ঢেউ
      const f = 1 - (Math.abs(dx) - l.halfW) / 7;
      G.ext.x += Math.sign(dx || 1) * Math.abs(l.vz) * 1.6 * f * dt;
      G.shake = Math.max(G.shake, 0.08 * f);
    }
  }
  // অন্য নৌকা
  for (const n of [...G.noukas]) {
    n.cd -= dt;
    n.z += (n.vz + 0.4) * dt;
    n.x += n.vx * dt;
    n.vx *= Math.exp(-1.5 * dt);
    n.x = clamp(n.x, -RIVER_HALF + 2, RIVER_HALF - 2);
    // লঞ্চ আইলে সাইড দেয়
    for (const l of G.launches) {
      if (Math.abs(n.z - l.z) < l.halfL + 6 && Math.abs(n.x - l.x) < l.halfW + 2.5) n.vx += Math.sign(n.x - l.x || 1) * 18 * dt;
    }
    n.spin *= Math.exp(-1.2 * dt);
    n.mesh.rotation.y += n.spin * dt;
    n.mesh.position.set(n.x, Math.sin(t * 2 + n.phase) * 0.08, n.z);
    n.mesh.rotation.z = Math.sin(t * 1.7 + n.phase) * 0.05;
    if (tooFar(n.z)) {
      removeFrom(G.noukas, n);
      continue;
    }
    const dx = G.x - n.x;
    const dz = G.z - n.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.3 && d > 0) {
      const nx = dx / d;
      const nz = dz / d;
      G.x += nx * (3.3 - d) * 0.6;
      G.z += nz * (3.3 - d) * 0.6;
      n.x -= nx * (3.3 - d) * 0.4;
      n.z -= nz * (3.3 - d) * 0.4;
      if (n.cd <= 0 && Math.abs(G.speed) > 2) {
        n.cd = 1;
        n.vx -= nx * (4 + Math.abs(G.speed) * 0.6);
        n.spin = rand(-3, 3);
        G.ext.x += nx * Math.abs(G.speed) * 0.5;
        G.ext.y += nz * Math.abs(G.speed) * 0.5;
        const sp = Math.abs(G.speed);
        G.speed *= 0.35;
        takeHit({ taka: round10(rand(700, 1600) + sp * 80), hull: 4 + sp * 0.6, heat: 0.45, strength: 0.8 });
        if (Math.random() < 0.5 && !G.passenger) bubble('😡', 'অন্য মাঝি', pick(['ওই মিয়া! নৌকা কি তোমার বাপের?', 'চোখ কপালে তুইলা চালাও নাকি?', 'আবে হালায় খাড়া, দেখাইতাছি!']));
      }
    }
  }
  // কচুরিপানা
  for (const h of [...G.hyacinths]) {
    h.z += 0.4 * dt;
    h.mesh.position.set(h.x, 0, h.z);
    h.mesh.rotation.y += 0.05 * dt;
    if (tooFar(h.z)) removeFrom(G.hyacinths, h);
  }
  // ময়লা
  for (const tr of [...G.trashes]) {
    tr.z += 0.4 * dt;
    tr.mesh.position.set(tr.x, 0.1 + Math.sin(t * 2 + tr.phase) * 0.08, tr.z);
    tr.mesh.rotation.y += dt * 0.5;
    if (tooFar(tr.z)) {
      removeFrom(G.trashes, tr);
      continue;
    }
    if (Math.hypot(tr.x - G.x, tr.z - G.z) < 2.5) {
      G.trash++;
      G.money += 20;
      A.coin();
      toast(pick(T.TOASTS.trash), 1);
      removeFrom(G.trashes, tr);
    }
  }
  // খাবার
  for (const f of [...G.foods]) {
    f.mesh.position.set(f.x, 0.2 + Math.sin(t * 2.5 + f.phase) * 0.15, f.z);
    f.mesh.rotation.y += dt;
    if (tooFar(f.z)) {
      removeFrom(G.foods, f);
      continue;
    }
    if (Math.hypot(f.x - G.x, f.z - G.z) < 2.8) {
      const B = G.buffs;
      if (f.type === 'chaa') {
        G.stamina = 100;
        G.hull = Math.min(100, G.hull + 12);
      } else if (f.type === 'bakarkhani') B.shield = 9;
      else if (f.type === 'lassi') B.lassi = 7;
      else if (f.type === 'biryani') B.biryani = 15;
      A.powerup();
      toast(T.FOODS[f.type].msg);
      removeFrom(G.foods, f);
    }
  }
}

function updateGhats(dt) {
  const p = G.passenger;
  if (p) {
    p.timeLeft -= dt;
    if (p.timeLeft <= 0 && !p.late) {
      p.late = true;
      passengerSay('late');
    }
    if (p.timeLeft < -35) return dropPassenger('আর পারুম না, সাঁতরাইয়াই যামু! 🏊');
    if (p.destInfo.z > G.minZ + 100) return dropPassenger('ঘাট পার হইয়া গেলা মিয়া! এইখানেই নামাইয়া দাও!');
    G.nextRide -= dt;
    if (G.nextRide <= 0) {
      passengerSay('ride');
      G.nextRide = rand(9, 15);
    }
  }
  if (G.haggle) return;
  for (const gh of world.ghats.values()) {
    if (Math.hypot(gh.ringX - G.x, gh.z - G.z) > 3.6) continue;
    if (G.passenger && G.passenger.dest === gh.index) deliver();
    else if (!G.passenger && gh.waiting) startHaggle(gh);
  }
}

function updatePolice(dt) {
  if (G.t - G.lastHit > 6) G.heat = Math.max(0, G.heat - 0.12 * dt);
  let pol = G.police;
  if (!pol && G.heat >= 2) {
    const mesh = makePolice();
    pol = G.police = { mesh, x: clamp(G.x, -20, 20), z: G.z + 90, h: 0, speed: 10, giveUp: false };
    scene.add(mesh);
    toast(pick(T.TOASTS.police), 2.5);
    A.siren(true);
  }
  if (!pol) return;
  const dx = G.x - pol.x;
  const dz = G.z - pol.z;
  const d = Math.hypot(dx, dz);
  if (!pol.giveUp && G.heat < 1.4) {
    pol.giveUp = true;
    toast(pick(T.TOASTS.policeGone));
    A.siren(false);
  }
  if (pol.giveUp) {
    pol.speed = Math.max(0, pol.speed - 6 * dt);
  } else {
    const want = Math.atan2(-dx, -dz);
    const diff = wrapAngle(want - pol.h);
    pol.h = wrapAngle(pol.h + clamp(diff, -2.6 * dt, 2.6 * dt));
    const target = Math.min(13.5 + G.heat * 0.9, 20);
    pol.speed += clamp(target - pol.speed, -10 * dt, 8 * dt);
  }
  pol.x = clamp(pol.x - Math.sin(pol.h) * pol.speed * dt, -RIVER_HALF + 2, RIVER_HALF - 2);
  pol.z += -Math.cos(pol.h) * pol.speed * dt;
  // পিলারে আটকায়
  for (const c of world.colliders) {
    if (!c.r) continue;
    const ex = pol.x - c.x;
    const ez = pol.z - c.z;
    const ed = Math.hypot(ex, ez);
    if (ed < c.r + 1.8 && ed > 0) {
      pol.x = c.x + (ex / ed) * (c.r + 1.8);
      pol.z = c.z + (ez / ed) * (c.r + 1.8);
      pol.speed *= 0.5;
    }
  }
  pol.mesh.position.set(pol.x, Math.sin(G.t * 3) * 0.1, pol.z);
  pol.mesh.rotation.y = pol.h;
  const blink = Math.floor(G.t * 6) % 2;
  pol.mesh.userData.lights[0].material.emissiveIntensity = blink ? 1.5 : 0.1;
  pol.mesh.userData.lights[1].material.emissiveIntensity = blink ? 0.1 : 1.5;
  A.sirenVolume(clamp(1 - d / 160, 0, 1));
  if (!pol.giveUp && d < 3.6) {
    if (G.buffs.shield > 0) {
      G.buffs.shield = 0;
      pol.z = G.z + 40;
      pol.speed = 0;
      toast('বাকরখানির ঢালে পুলিশ পিছলাইয়া গেলো! 🥯');
      A.bump(1);
    } else {
      gameOver('police');
      return;
    }
  }
  if ((pol.giveUp && d > 120) || pol.z > G.z + 220) {
    scene.remove(pol.mesh);
    G.police = null;
    A.siren(false);
  }
}

const DAY = 200;
function updateTimeOfDay() {
  const phase = (G.t % DAY) / DAY;
  world.setTimeOfDay(phase);
  const night = phase > 0.58 && phase < 0.95;
  lantern.intensity = night ? 9 : phase > 0.5 && phase < 0.58 ? (phase - 0.5) * 100 : 0;
  const cyc = Math.floor(G.t / DAY);
  const flag = (name, at) => {
    const key = name + cyc;
    if (phase > at && !G.phaseFlags[key]) {
      G.phaseFlags[key] = true;
      toast(pick(T.TOASTS[name]), 3);
    }
  };
  flag('sunset', 0.5);
  flag('night', 0.64);
  flag('dawn', 0.95);

  // জায়গার নাম
  if (!G.toldAhsan && G.z < AHSAN_Z + 90) {
    G.toldAhsan = true;
    toast('ডাইনে দেখেন — আহসান মঞ্জিল! 🏰', 2.5);
  }
  const bz = BRIDGE_Z - G.nextBridge * BRIDGE_EVERY;
  if (G.z < bz + 80) {
    toast(`সামনে ${bridgeName(G.nextBridge)}! পিলার সাবধান 🌉`, 2.5);
    G.nextBridge++;
  }
}

function placeBoat(dt) {
  boat.position.set(G.x, Math.sin(G.t * 2.2) * 0.08, G.z);
  boat.rotation.y = G.h;
  const roll = (G.turn || 0) * 0.1 * Math.min(1, Math.abs(G.speed) / 8);
  boat.rotation.z = roll + Math.sin(G.t * 1.8) * 0.03 + (G.passenger?.type.rocky ? Math.sin(G.t * 4) * 0.08 : 0);
  boat.rotation.x = Math.sin(G.t * 1.3) * 0.02;
  const oar = boat.userData.oar;
  oar.rotation.x = 0.5 + Math.sin(G.t * (G.speed > 0.5 ? 7 : 2)) * (G.speed > 0.5 ? 0.35 : 0.08);
  const sh = boat.userData.shield;
  sh.visible = G.buffs.shield > 0 && (G.buffs.shield > 2 || Math.floor(G.t * 8) % 2 === 0);
}

function updateCamera(dt) {
  camH += wrapAngle(G.h - camH) * (1 - Math.exp(-3 * dt));
  const portrait = window.innerWidth < window.innerHeight;
  const D = portrait ? 17 : 14;
  const H = portrait ? 10 : 7.5;
  const target = new THREE.Vector3(G.x + Math.sin(camH) * D, H, G.z + Math.cos(camH) * D);
  camera.position.lerp(target, 1 - Math.exp(-5 * dt));
  G.shake = Math.max(0, G.shake - dt);
  if (G.shake > 0) {
    camera.position.x += rand(-1, 1) * G.shake;
    camera.position.y += rand(-1, 1) * G.shake;
  }
  camera.lookAt(G.x - Math.sin(camH) * 10, 1.5, G.z - Math.cos(camH) * 10);
}

// HUD — বদলাইলেই কেবল DOM লিখি
const hudCache = {};
function setText(id, v) {
  if (hudCache[id] !== v) {
    hudCache[id] = v;
    $(id).textContent = v;
  }
}
function setStyle(id, prop, v) {
  const k = id + prop;
  if (hudCache[k] !== v) {
    hudCache[k] = v;
    $(id).style[prop] = v;
  }
}

function updateHUD(dt) {
  setText('h-money', bnMoney(G.money));
  setText('h-damage', bnMoney(G.damage));
  setStyle('h-hull', 'width', Math.max(0, G.hull).toFixed(0) + '%');
  setStyle('h-hull', 'background', G.hull < 30 ? '#e53935' : '');
  setStyle('h-stamina', 'width', G.stamina.toFixed(0) + '%');
  const stars = Math.floor(G.heat);
  setText('h-stars', stars ? '🚨' + '⭐'.repeat(stars) : '');
  setText('h-dist', bn(distance()) + ' মি');
  const B = G.buffs;
  const buffs = [];
  if (B.shield > 0) buffs.push(`🛡️${bn(Math.ceil(B.shield))}`);
  if (B.lassi > 0) buffs.push(`⚡${bn(Math.ceil(B.lassi))}`);
  if (B.biryani > 0) buffs.push(`💰×২ ${bn(Math.ceil(B.biryani))}`);
  const bh = buffs.map((b) => `<span>${b}</span>`).join('');
  if (hudCache.buffs !== bh) {
    hudCache.buffs = bh;
    $('h-buffs').innerHTML = bh;
  }
  const p = G.passenger;
  const panel = $('passenger-panel');
  const arrow = $('dir-arrow');
  let target = null;
  if (p) {
    panel.classList.remove('hidden');
    setText('pp-icon', p.type.icon);
    const dist = Math.max(0, Math.round(Math.hypot(p.destInfo.ringX - G.x, p.destInfo.z - G.z)));
    setText('pp-dest', `${p.destInfo.name} · ${bn(dist)} মি`);
    setText('pp-fare', p.fare ? bnMoney(p.fare) : 'ফ্রি 😎');
    setStyle('pp-timer', 'width', clamp((100 * p.timeLeft) / p.timeTotal, 0, 100).toFixed(1) + '%');
    setStyle('pp-timer', 'background', p.timeLeft < 0 ? '#e53935' : p.timeLeft / p.timeTotal < 0.3 ? '#ffb300' : '#69f0ae');
    target = { x: p.destInfo.ringX, z: p.destInfo.z, color: '#69f0ae' };
  } else {
    panel.classList.add('hidden');
    let best = null;
    for (const gh of world.ghats.values()) {
      if (!gh.waiting || gh.z > G.z + 20) continue;
      if (!best || gh.z > best.z) best = gh;
    }
    if (best) target = { x: best.ringX, z: best.z, color: '#ffeb3b' };
  }
  if (target && !G.haggle) {
    arrow.classList.remove('hidden');
    const dx = target.x - G.x;
    const dz = target.z - G.z;
    const fx = -Math.sin(G.h);
    const fz = -Math.cos(G.h);
    const rx = Math.cos(G.h);
    const rz = -Math.sin(G.h);
    const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    setStyle('dir-arrow', 'transform', `translateX(-50%) rotate(${(ang * 180) / Math.PI - 90}deg)`);
    setStyle('dir-arrow', 'color', target.color);
  } else arrow.classList.add('hidden');

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  if (bubbleTimer > 0) {
    bubbleTimer -= dt;
    if (bubbleTimer <= 0) $('bubble').classList.add('hidden');
  }
}

// ---------- পর্দা নিয়ন্ত্রণ ----------
function startGame() {
  A.initAudio();
  if (G.played) newGame();
  G.played = true;
  G.t = 0;
  state = 'play';
  clearOnce();
  ['start', 'gameover', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('toast').classList.remove('show');
  Object.keys(hudCache).forEach((k) => delete hudCache[k]);
  setTimeout(() => state === 'play' && toast('হলুদ আলোর ঘাটে যান, যাত্রী তুলেন! 🚣', 3), 400);
}

function setPaused(p) {
  if (p && state === 'play') {
    state = 'pause';
    $('pause').classList.remove('hidden');
    A.siren(false);
  } else if (!p && state === 'pause') {
    state = 'play';
    $('pause').classList.add('hidden');
    if (G.police && !G.police.giveUp) A.siren(true);
  }
}

function quitToMenu() {
  newGame();
  state = 'menu';
  A.siren(false);
  ['pause', 'gameover', 'haggle'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  showMenu();
}

function showMenu() {
  const best = readBest();
  $('best').textContent = best.money ? `🏆 সেরা আয়: ${bnMoney(best.money)} · সেরা দূরত্ব: ${bn(best.dist)} মি` : '';
  $('tip').textContent = pick(T.START_TIPS);
  $('start').classList.remove('hidden');
}

function updateMute() {
  $('btn-mute').textContent = A.isMuted() ? '🔇' : '🔊';
}

$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', () => setPaused(false));
$('btn-quit').addEventListener('click', quitToMenu);
$('btn-pause').addEventListener('click', () => setPaused(true));
$('btn-mute').addEventListener('click', () => {
  A.setMuted(!A.isMuted());
  updateMute();
});
$('hg-accept').addEventListener('click', () => resolveHaggle('accept'));
$('hg-counter').addEventListener('click', () => resolveHaggle('counter'));
$('btn-share').addEventListener('click', async () => {
  const text = `মাঝির রাস্তায় আমি ${bnMoney(G.money)} কামাইছি, বুড়িগঙ্গার ক্ষতি করছি ${bnMoney(G.damage)}! তুমি পারবা? 🚣`;
  try {
    if (navigator.share) await navigator.share({ title: 'মাঝির রাস্তা', text, url: location.href });
    else {
      await navigator.clipboard.writeText(text + ' ' + location.href);
      $('btn-share').textContent = 'কপি হইছে! ✅';
    }
  } catch {
    /* ইউজার বাতিল করছে */
  }
});

function globalKeys() {
  if (consume('mute')) {
    A.setMuted(!A.isMuted());
    updateMute();
  }
  if (consume('pause') || consume('blur')) {
    if (state === 'play') setPaused(true);
    else if (state === 'pause') setPaused(false);
  }
  if (consume('enter')) {
    if (state === 'menu' || (state === 'over' && G.overT > 1.6)) startGame();
    else if (state === 'pause') setPaused(false);
  }
}

// মেনুতে ক্যামেরা আস্তে ঘুরে
let menuT = 0;
function menuIdle(dt) {
  menuT += dt;
  G.t = menuT;
  world.update(G.z, menuT);
  world.setTimeOfDay(0.2);
  placeBoat(dt);
  const a = menuT * 0.15;
  camera.position.set(G.x + Math.sin(a) * 26, 12 + Math.sin(menuT * 0.3) * 2, G.z + Math.cos(a) * 26);
  camera.lookAt(G.x, 1, G.z);
}

function updateOver(dt, realDt) {
  G.overT += realDt;
  boat.position.y -= dt * 0.9;
  boat.rotation.z += dt * 0.5;
  boat.rotation.x -= dt * 0.25;
  G.shake = Math.max(0, G.shake - dt);
  camera.lookAt(boat.position);
  for (const l of G.launches) {
    l.z += l.vz * dt;
    l.mesh.position.z = l.z;
  }
  if (G.overT > 1.6 && $('gameover').classList.contains('hidden')) showNewspaper();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt);
  last = now;
  globalKeys();
  if (state === 'play') update(dt);
  else if (state === 'menu') menuIdle(dt);
  else if (state === 'over') updateOver(dt, Math.min(realDt, 0.5));
  renderer.render(scene, camera);
}

// ফন্ট লোড হওয়ার পর শুরু (ক্যানভাসে বাংলা লেখার জন্য)
async function boot() {
  initInput();
  updateMute();
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 20px ${FONT}`)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* ফন্ট না আসলেও চলবো */
  }
  newGame();
  showMenu();
  requestAnimationFrame(frame);
  // টেস্টের জন্য: ?debug দিলে খেলার অবস্থা দেখা যায়
  if (new URLSearchParams(location.search).has('debug')) window.__game = { get G() { return G; }, world: () => world, gameOver };
}
boot();
