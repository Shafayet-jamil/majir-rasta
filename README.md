# মাঝির রাস্তা 🚣 (Majhir Rasta)

A 3D browser game set on the Buriganga at Sadarghat, in Old Dhaka. You are a majhi (boatman). Carry passengers between ghats, dodge the big launches, haggle over fares, and stay ahead of the nou-police. The game is in Bangla, and the passengers talk in Dhakaiya kutti.

It runs in the browser on PC and on phones. There are no image or sound files: every model is built in code and every sound is made with the Web Audio API.

## How to play

| Action | PC | Phone |
|---|---|---|
| Row / brake | `W` `S` or `↑` `↓` | ▲ ▼ |
| Steer | `A` `D` or `←` `→` | ◀ ▶ |
| Boost (uses stamina) | `Space` / `Shift` | ⚡ |
| Horn | `H` | 📯 |
| Haggle | `1` accept / `2` counter-offer | tap the button |
| Pause / mute | `P` / `M` | ⏸ / 🔊 |

- **Yellow light**: a passenger is waiting at that ghat. Go into the ring to start the haggle.
- **Green light**: your passenger's destination. Arrive in time for the full fare plus a tip.
- **Touching a launch ends the game.** Passing close to one is risky too: its wake pushes you sideways.
- Hitting other boats, bridge pillars or pontoons adds to the "নদীর ক্ষতি" (river damage) bill. Do it too often and the nou-police start chasing you. Boost to get away.
- Food: ☕ chaa (stamina + repair), 🥯 bakarkhani (shield), 🥛 lassi (speed), 🍛 biryani (double fares).
- Picking up floating trash earns ৳20 each. The Buriganga needs care.
- When the game ends, your run is printed on the front page of the satirical "দৈনিক বুড়িগঙ্গা বার্তা".

## What's in this version

- Endless river starting at Sadarghat: the launch terminal and its pontoon, docked launches, Ahsan Manzil, Babubazar Bridge (and further bridges), with Old Dhaka on the right bank and Keraniganj on the left
- 15 named ghats (Wiseghat, Badamtoli, Sowarighat, Jinjira, Aganagar …)
- 7 kinds of passenger: groom, fish seller, aunty with a pressure cooker, selfie vlogger, Jagannath student, Chawkbazar trader, neta bhai. Each has their own lines, fare, time limit and quirk.
- Fare haggling: push for more and they may walk off
- Launches with horns and wakes, other boats, water hyacinth, trash, food powerups
- Nou-police chase with wanted stars
- Day → sunset (with the azan) → night (lantern only) → dawn
- Shakrain kites in the sky
- Best score saved in the browser

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints, usually http://localhost:5173. Add `?debug` to the URL to get `window.__game` in the console for testing.

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repository.
2. Vercel detects Vite automatically (`vercel.json` is included). Build command: `npm run build`. Output directory: `dist`.
3. Click Deploy. Every push to the production branch redeploys the game.

## Code layout

```
index.html        screens: menu, HUD, haggle popup, touch buttons, newspaper
src/main.js       game loop, physics, passengers, launches, police, HUD
src/world.js      river, banks, Old Dhaka buildings, Sadarghat, Ahsan Manzil, bridge, ghats, day/night
src/models.js     low-poly models: nouka, launch, police boat, people, hyacinth, food, kites
src/text.js       all Bangla text and passenger dialogue (edit this to add new lines)
src/audio.js      synthesized horn, siren, coins, splashes, river ambience
src/input.js      keyboard and touch controls
```

## Ideas for next versions

- Shakrain festival mode: cut kites for bonus taka
- Eid rush level: crowded ghats and many more launches
- Monsoon storm and winter fog weather
- Race mode against other majhis to Babubazar Bridge
- Real voice clips: hawkers ("বরিশাল! চাঁদপুর!"), passengers, the azan
- Boat upgrades: dingi → engine nouka → speedboat
- Story chapters: an old majhi teaching a young one, in Dhakaiya Bangla
- Online leaderboard
