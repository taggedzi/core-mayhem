// Small demo showing how events trigger different banter lines
// Run in a test harness or call from your game main.

import { BanterSystem, createCharacter } from "./index";
import { LightCore, DarkCore } from "./personalities";

function runDemo() {
  const banter = new BanterSystem({ seed: 20240912, cooldownMs: 2500 });
  const left = createCharacter("left", LightCore, "Light");
  const right = createCharacter("right", DarkCore, "Dark");

  type E = Parameters<BanterSystem["speak"]>[0];
  const timeline: { t: number; e: E; who: "left" | "right" }[] = [
    { t: 0, e: "match_start", who: "left" },
    { t: 100, e: "match_start", who: "right" },
    { t: 1200, e: "first_blood", who: "left" },
    { t: 2000, e: "big_hit", who: "right" },
    { t: 2600, e: "stagger", who: "left" },
    { t: 4200, e: "comeback", who: "left" },
    { t: 5200, e: "near_death", who: "right" },
    { t: 8000, e: "taunt", who: "right" },
    { t: 11000, e: "victory", who: "left" },
  ];

  let lastT = 0;
  for (const p of timeline) {
    const dt = p.t - lastT;
    lastT = p.t;
    banter.step(dt);
    const speaker = p.who === "left" ? left : right;
    const target = p.who === "left" ? right : left;
    const out = banter.speak(p.e, speaker, target);
    if (out) {
      // eslint-disable-next-line no-console
      console.log(`[${p.t.toString().padStart(5, " ")}] ${speaker.displayName}: ${out.text}`);
    }
  }
}

// Only run when executed directly (not when imported)
// This pattern is safe in bundlers; replace if your setup differs.
declare const window: any;
if (typeof window === "undefined") {
  runDemo();
}

