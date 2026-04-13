#!/usr/bin/env node
/* eslint-env node */
/**
 * generate-banter.mjs
 *
 * Calls a local Ollama instance to generate new tauntSoft lines for the personas
 * whose current lines are third-person status observations rather than
 * opponent-directed taunts (e.g. "Weak jab." instead of "Keep your guard up, rookie.").
 *
 * Usage:
 *   node scripts/generate-banter.mjs
 *   node scripts/generate-banter.mjs --model mistral
 *   node scripts/generate-banter.mjs --model gemma3 --count 15
 *   node scripts/generate-banter.mjs --model llama3.2 --persona Kagekiri
 *   node scripts/generate-banter.mjs --model llama3.2 --apply
 *
 * Flags:
 *   --model   <name>   Ollama model to use          (default: llama3.2)
 *   --url     <url>    Ollama base URL               (default: http://localhost:11434)
 *   --count   <n>      Lines to generate per persona (default: 12)
 *   --timeout <ms>     Per-request timeout ms        (default: 90000)
 *   --persona <name>   Partial name filter (case-insensitive), e.g. "boxer" or "Ashen"
 *   --apply            Patch personalities.ts in-place with the generated lines
 *                      (skips any persona where generation failed or parsed 0 lines)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PERSONAS_FILE = path.join(ROOT, 'src', 'banter', 'personalities.ts');

// ── CLI args ──────────────────────────────────────────────────────────────────
function getArg(flag, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

const MODEL = getArg('--model', 'llama3.2');
const BASE_URL = getArg('--url', 'http://localhost:11434').replace(/\/$/, '');
const COUNT = Math.max(1, parseInt(getArg('--count', '12'), 10));
const TIMEOUT_MS = Math.max(5000, parseInt(getArg('--timeout', '90000'), 10));
const FILTER = getArg('--persona', '').toLowerCase();
const APPLY = hasFlag('--apply');

// ── Persona definitions ───────────────────────────────────────────────────────
// Each entry describes a character whose tauntSoft lines are currently
// non-engaging third-person observations. searchStr is the exact text in
// personalities.ts to find when --apply is used.
const PERSONAS = [
  {
    name: 'Kagekiri (\u5f71\u65ac)',
    blurb: 'A silent blade\u2014precise, restrained, and elusive. Speaks rarely, cuts deeply.',
    theme:
      'Silent assassin with a Japanese blade aesthetic. Minimal words, each one precise and cutting. Speaks in short imperatives or cold observations directed at the opponent.',
    currentLines: ['Too open.', 'Footwork noisy.', 'Telegraphed.', 'Guard low.', 'Cut away.'],
    searchStr:
      "tauntSoft: ['Too open.', 'Footwork noisy.', 'Telegraphed.', 'Guard low.', 'Cut away.'],",
  },
  {
    name: 'Unknown Monk',
    blurb: 'Monk, Whisper and strike; ascetic, measured, merciless in silence.',
    theme:
      'Ascetic martial monk. Philosophical and calm. References breath, stillness, center — but always directed at the opponent as a critique of their mind or body state.',
    currentLines: [
      'Breath wanders.',
      'Center lost.',
      'You sway.',
      'Grip\u2026 empty.',
      'Mind clatters.',
    ],
    searchStr:
      "tauntSoft: ['Breath wanders.', 'Center lost.', 'You sway.', 'Grip\u2026 empty.', 'Mind clatters.'],",
  },
  {
    name: 'Zine',
    blurb: 'Netrunner; Icebreaker poet; cool under neon, knives made of math.',
    theme:
      'Cyberpunk hacker/netrunner. Cool, detached, uses tech/network jargon as combat metaphors. Speaks to the opponent like debugging a bad process.',
    currentLines: [
      'Packet lost.',
      'Your firewall hums.',
      'Keys slip.',
      'Latency wins.',
      'Bad hash.',
    ],
    searchStr:
      "tauntSoft: ['Packet lost.', 'Your firewall hums.', 'Keys slip.', 'Latency wins.', 'Bad hash.'],",
  },
  {
    name: 'iKKanil',
    blurb: 'Ice Elemental; Glacial poise; cutting calm, frostbit wit.',
    theme:
      'Ice elemental. Speaks with glacial patience. Cold, chilling metaphors directed at the opponent. Can reference freezing, numbness, ice, cold — but always as a taunt TO them.',
    currentLines: [
      'Chill, coward.',
      'Your pulse slows.',
      'Grip stiffens.',
      'Numb yet?',
      'Thin ice.',
    ],
    searchStr:
      "tauntSoft: ['Chill, coward.', 'Your pulse slows.', 'Grip stiffens.', 'Numb yet?', 'Thin ice.'],",
  },
  {
    name: 'Puncher McJabby',
    blurb: 'Boxer; Gloves high; grit, jabs, and ringside swagger.',
    theme:
      'Boxer with street swagger and ringside bravado. Trash talk, boxing terminology, brash confidence. Talks TO the opponent like a fighter calling out across the ring.',
    currentLines: ['Weak jab.', 'Feet slow.', 'Hands drop.', 'Chin open.', 'Rope shaky.'],
    searchStr:
      "tauntSoft: ['Weak jab.', 'Feet slow.', 'Hands drop.', 'Chin open.', 'Rope shaky.'],",
  },
  {
    name: 'Ashen',
    blurb: 'Archer, Sharp focus; steady hands, quiver of pride.',
    theme:
      'Proud archer. Precise, focused, slightly condescending. Uses archery metaphors to taunt the opponent directly about their performance.',
    currentLines: ['Loose aim.', 'Bow wavers.', 'Eyes strain.', 'Miss wide.', 'Grip sloppy.'],
    searchStr:
      "tauntSoft: ['Loose aim.', 'Bow wavers.', 'Eyes strain.', 'Miss wide.', 'Grip sloppy.'],",
  },
  {
    name: 'Ji (Void)',
    blurb: 'Jynn; Hollow hymn; all-consuming silence with teeth.',
    theme:
      'Void entity. Cryptic, minimal, unsettling. References emptiness, silence, inevitability. Even in few words, the lines should feel directed at the opponent\u2014like the void speaking to them personally.',
    currentLines: [
      'Empty hand.',
      'Hollow step.',
      'Noise weak.',
      'Light shakes.',
      'Breath shallow.',
    ],
    searchStr:
      "tauntSoft: ['Empty hand.', 'Hollow step.', 'Noise weak.', 'Light shakes.', 'Breath shallow.'],",
  },
  {
    name: 'Denerio',
    blurb: 'Silent Ronin; Wandering sword; words scarce, steel plenty.',
    theme:
      'Stoic ronin samurai. Extremely sparse speech\u2014each word is final. Short, sword-related metaphors. Speaks in minimal lines that still feel addressed to the opponent, not narrated about them.',
    currentLines: ['Step wrong.', 'Steel ready.', 'Your grip weak.', 'Breathe loud.', 'Path ends.'],
    searchStr:
      "tauntSoft: ['Step wrong.', 'Steel ready.', 'Your grip weak.', 'Breathe loud.', 'Path ends.'],",
  },

  // ── New batch ────────────────────────────────────────────────────────────────
  {
    name: 'DeAngelo',
    blurb: 'Rocket Tech; Launch pad poet; calculus swagger, kerosene lullabies.',
    theme:
      'Rocket scientist / mission controller. Uses launch and space jargon as taunts directed AT the opponent — trajectory, thrust, abort, gimbal, mass, staging, reentry, orbit. Critique them like a failed mission launch.',
    currentLines: [
      'Trajectory off.',
      'Your thrust is\u2026 sad.',
      'Gimbal jitters.',
      'Mass budget blown.',
      'Abort vibes.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Trajectory off\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Midas',
    blurb: 'Machinist; Micron tyrant; tolerances holy, coolant cold.',
    theme:
      'Precision CNC machinist. Uses machining jargon directed AT the opponent — runout, chatter, surface finish, tolerance, feeds, zero, toolpath, coolant. Critique them like a machinist inspecting shoddy work.',
    currentLines: [
      'Your runout shows.',
      'Surface finish: tragic.',
      'Feeds wrong.',
      'Chatter brain.',
      'Zero\u2019s lost.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Your runout shows\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Rob',
    blurb: 'Relectrician; Circuit sage; clean runs, clean jokes, live and neutral.',
    theme:
      'Electrician. Uses wiring and electrical jargon as taunts directed AT the opponent — circuit, ground, arc, load, neutral, panel, short, continuity. Address them like diagnosing their failures as electrical faults.',
    currentLines: [
      'You short out.',
      'Loose neutral.',
      'Grounded ego.',
      'Load\u2019s too much.',
      'Breaker brain.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'You short out\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Scrappy',
    blurb: 'Salvager; Scrap baron; magnet hooks, sharp eyes, profit nose.',
    theme:
      'Scrap yard salvager. Uses recycling and metal jargon directed AT the opponent — scrap, rust, alloy, weld, compactor, grade, value. Speak to them like assessing them as worthless material headed for the crusher.',
    currentLines: [
      'Worthless alloy.',
      'Bent morale.',
      'Bad weld life.',
      'Rust brain.',
      'You squeak cheap.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Worthless alloy\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Dredd',
    blurb: 'Demolitionist; Controlled collapse; timing, charges, and thunder etiquette.',
    theme:
      'Demolition expert. Uses structural collapse and demolition jargon directed AT the opponent — support, load path, stress, crack, charge, clearance, collapse, detonate. Critique them like planning their structural failure.',
    currentLines: [
      'Your stance wobbles.',
      'Support\u2019s gone.',
      'Stress rising.',
      'Bad load path.',
      'Cracks already.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Your stance wobbles\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Milton',
    blurb: 'Middle Manager; Clipboard tyrant; obsessed with reports, allergic to accountability.',
    theme:
      'Corporate middle manager obsessed with process. Uses office-speak as taunts AT the opponent — deliverables, synergy, bandwidth, alignment, KPIs, circle back, out of scope, pivot. Address them like a failing employee in a performance review.',
    currentLines: [
      'Circle back.',
      'Wrong deliverable.',
      'You missed Q4 goals.',
      'Not in scope.',
      'Your synergy lags.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Circle back\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Jeff',
    blurb: 'Salesman; Fast-talker; always pitching, always closing.',
    theme:
      'Aggressive salesperson. Uses sales terminology as taunts AT the opponent — pitch, pipeline, close, commission, quota, margin, cold call, upsell. Trash-talk them like they are a failed deal or low-value prospect.',
    currentLines: [
      'Weak pitch.',
      'That\u2019s a no-sale.',
      'Pipeline empty.',
      'Your margin\u2019s thin.',
      'Bad cold call.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Weak pitch\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Mike',
    blurb: 'Marketing Manager; Buzzword factory; campaigns first, reality later.',
    theme:
      'Marketing manager obsessed with metrics. Uses digital marketing jargon AT the opponent — brand, engagement, conversion, click-through, ROI, reach, campaign, funnel. Mock them like analyzing their terrible performance data.',
    currentLines: [
      'Your brand is weak.',
      'Bad engagement.',
      'Poor conversion.',
      'Awkward click-through.',
      'Campaign flop.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Your brand is weak\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Kevin',
    blurb: 'IT Support; Deadpan troubleshooter; sarcasm dry, fixes grudgingly.',
    theme:
      'Deadpan IT support tech with dry sarcasm. Uses tech support jargon AT the opponent — reboot, user error, bug, ticket, firewall, patch, crash, deprecated. Address them like a Level 1 support call gone hopelessly wrong.',
    currentLines: [
      'Did you reboot?',
      'User error.',
      'Your brain blue-screened.',
      'Not in the manual.',
      'Bug between chair and keyboard.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Did you reboot\?',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Karren',
    blurb: 'HR Manager; Policy enforcer; smiles sharp, paperwork lethal.',
    theme:
      'HR manager obsessed with policy compliance. Uses HR language AT the opponent — compliance, form, violation, procedure, policy, write-up, termination, grievance. Address them like conducting a formal disciplinary hearing.',
    currentLines: [
      'That\u2019s against policy.',
      'You are missing a form.',
      'Not compliant.',
      'Violation spotted.',
      'Procedure ignored.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'That.s against policy\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Steven',
    blurb: 'Intern; Clueless enthusiasm; overworked, underpaid, too much coffee.',
    theme:
      'Enthusiastic but clueless intern. Even though nervous, tauntSoft lines must be directed AT the opponent — awkward jabs, eager-to-impress trash talk, workplace references aimed outward. Not self-referential oops moments.',
    currentLines: [
      'Oops\u2026 sorry!',
      'I\u2019ll fix it!',
      'Wait, was that wrong?',
      'Um, redo?',
      'Oops again!',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Oops.* sorry!',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Jodi',
    blurb: 'Receptionist; Front desk guard; knows all gossip, infinite passive-aggression.',
    theme:
      'Passive-aggressive front desk receptionist. Uses scheduling and reception jargon AT the opponent — appointment, calendar, badge, check-in, extension, hold, transfer. Address them with thinly veiled contempt, like an unwanted walk-in.',
    currentLines: [
      'That\u2019s not on my calendar.',
      'Didn\u2019t sign in properly.',
      'You\u2019ll need an appointment.',
      'Badge expired.',
      'Phone\u2019s busy.',
    ],
    searchRegex:
      / {4}tauntSoft: \[\n {6}'That.s not on my calendar\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Flynn',
    blurb: 'Accountant; Spreadsheet sniper; numbers never lie, but you do.',
    theme:
      'Precise, deadpan accountant. Uses accounting and finance jargon AT the opponent — audit, ledger, balance, receipt, expense, variance, depreciation, write-off. Address them like marking them as a liability or rounding error.',
    currentLines: [
      'Numbers don\u2019t add up.',
      'Audit pending.',
      'Expense denied.',
      'Balance wrong.',
      'Receipts missing.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Numbers don.t add up\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Ellis',
    blurb: 'Teacher; Chalk-dusted mentor; lectures sharp, patience thin.',
    theme:
      'Stern teacher with thin patience. Uses academic jargon AT the opponent — quiz, study, grade, homework, syllabus, detention, attendance, marks. Address them like a failing student who has not done the work.',
    currentLines: [
      'Pop quiz.',
      'You didn\u2019t study.',
      'Late again.',
      'Homework sloppy.',
      'Spelling error.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Pop quiz\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Jake',
    blurb: 'Jock; Letterman loudmouth; flexes, tackles, and trash talk.',
    theme:
      'Loud, brash jock with letterman swagger. Uses sports and gym terminology AT the opponent — throw, lift, step, bench, arms, reps, play, hustle. Trash-talk them directly across the court or field.',
    currentLines: [
      'Weak throw.',
      'Can\u2019t even lift.',
      'Slow step.',
      'Bench warmer.',
      'Small arms.',
    ],
    searchStr:
      "tauntSoft: ['Weak throw.', 'Can\u2019t even lift.', 'Slow step.', 'Bench warmer.', 'Small arms.'],",
  },
  {
    name: 'Paris',
    blurb: 'Nerd; Bookbound genius; smug corrections and fact drops.',
    theme:
      'Smug nerd who corrects everyone. Uses academic precision to taunt AT the opponent — wrong data, bad logic, incorrect citation, failed hypothesis. Address them with condescending superiority about their intelligence or accuracy.',
    currentLines: [
      'Actually\u2026',
      'Wrong formula.',
      'That\u2019s not canon.',
      'Misquoted again.',
      'Logic error.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Actually.{1,3}',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Angelina',
    blurb: 'Goth Kid; Moody philosopher; dark eyeliner, darker jokes.',
    theme:
      'Moody goth teenager. Dark and theatrical, but directed AT the opponent. Uses imagery of shadows, decay, fading, emptiness — addressed to the opponent like reading their dark fate. Poetic but pointed.',
    currentLines: [
      'Shadows like you.',
      'Hope fades.',
      'Weak like daylight.',
      'Empty swing.',
      'You\u2019re pale.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Shadows like you\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Chuck',
    blurb: 'Principal; Authoritarian suit; rules sharp, punishments sharper.',
    theme:
      'Authoritarian school principal. Uses school discipline jargon directed AT the opponent — rule, policy, suspension, hall pass, detention, office, expulsion. Address them like issuing formal disciplinary action.',
    currentLines: [
      'Rule broken.',
      'Policy ignored.',
      'Late slip incoming.',
      'Hall pass?',
      'Suspension vibes.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Rule broken\.',\n(?: {6}'.*',\n)+ {4}\],/,
  },
  {
    name: 'Nicklewise',
    blurb: 'Class Clown; Meme king; chaos in homeroom, pranks loud.',
    theme:
      'Chaotic class clown who pranks everyone. Uses slapstick, prank, and school humor directed AT the opponent. Short, punchy, unpredictable. Even the dumb jokes are aimed outward at them.',
    currentLines: [
      'Boink!',
      'Whoopie cushion!',
      'Your grade? LOL.',
      'Pop quiz\u2014psyche!',
      'Big goof energy.',
    ],
    searchRegex: / {4}tauntSoft: \[\n {6}'Boink!',\n(?: {6}'.*',\n)+ {4}\],/,
  },
];

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a combat dialogue writer for a fighting game called Core Mayhem. \
You write short taunt lines for specific characters.

STRICT RULES — follow all of these:
1. Every line MUST address the opponent directly. Use "you", "your", implied commands \
(e.g. "Keep trying."), or direct address. NEVER write third-person observations \
like "Grip sloppy." or "Feet slow." — those do not work as taunts.
2. Lines must be SHORT: 3 to 9 words each. Fragment sentences are fine.
3. These are tauntSoft lines — playful, witty, disparaging or dismissive taunts, not death threats. \
Edgy is fine; extreme violence is not.
4. Every line must be distinct and match the character's voice and theme.
5. Use only straight apostrophes (') — never curly quotes.
6. Output ONLY a numbered list, one line per number, no blank lines between items, \
no extra commentary.`;
}

function buildUserPrompt(persona) {
  const badList = persona.currentLines.map((l) => `"${l}"`).join(', ');
  return `Character: ${persona.name}
Description: ${persona.blurb}
Voice & theme: ${persona.theme}

The CURRENT lines are broken — they are third-person observations with no opponent engagement:
${badList}

Generate ${COUNT} replacement tauntSoft lines for ${persona.name}. \
Each line must feel like it is spoken TO the opponent, not narrated about them. \
Stay in character.

Output format — numbered list only:
1. [line]
2. [line]
(continue to ${COUNT})`;
}

// ── Ollama call ───────────────────────────────────────────────────────────────
async function ollamaChat(system, user) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        options: { temperature: 0.85, top_p: 0.92, repeat_penalty: 1.15 },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error(`  Ollama HTTP ${r.status} ${r.statusText}`);
      return null;
    }
    const data = await r.json().catch(() => ({}));
    const content = data?.message?.content ?? data?.choices?.[0]?.message?.content ?? '';
    return typeof content === 'string' ? content : null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(
        `  Request timed out after ${TIMEOUT_MS}ms — try a smaller model or increase --timeout`,
      );
    } else {
      console.error(`  Ollama error: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── Response parser ───────────────────────────────────────────────────────────
// Sentence-ending punctuation — a line without one of these is likely truncated.
const SENTENCE_END = /[.!?…'")\]]+$/;

function parseLines(raw) {
  return (
    raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^\d+[.)]\s/.test(l)) // must start with "N." or "N)"
      .map((l) => l.replace(/^\d+[.)]\s+/, '').trim()) // strip leading number
      .map((l) => l.replace(/["""]/g, "'")) // normalise curly double-quotes
      // Some models wrap their output lines in their own single quotes — strip them.
      .map((l) => (/^'.*'$/.test(l) ? l.slice(1, -1) : l))
      .filter((l) => l.length >= 2 && l.length <= 90) // sanity bounds
      .filter((l) => SENTENCE_END.test(l))
  ); // drop truncated lines
}

// ── TypeScript formatter ──────────────────────────────────────────────────────
function formatAsTS(lines) {
  // Escape any straight single quotes inside the line text
  const escaped = lines.map((l) => `'${l.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
  // If 5 or fewer, keep on one line to match the existing compact style
  if (escaped.length <= 5) {
    return `    tauntSoft: [${escaped.join(', ')}],`;
  }
  const inner = escaped.map((e) => `      ${e},`).join('\n');
  return `    tauntSoft: [\n${inner}\n    ],`;
}

// ── In-place patcher ──────────────────────────────────────────────────────────
async function applyToPatch(persona, lines) {
  const src = await fs.readFile(PERSONAS_FILE, 'utf8');
  const replacement = formatAsTS(lines);

  // Regex-based match (used for multiline tauntSoft blocks)
  if (persona.searchRegex) {
    if (!persona.searchRegex.test(src)) {
      console.log(
        `  ✗ --apply: could not locate tauntSoft block for ${persona.name} via regex — skipping patch.`,
      );
      return false;
    }
    // Use a function replacement to avoid $ special-pattern expansion
    const patched = src.replace(persona.searchRegex, () => replacement);
    await fs.writeFile(PERSONAS_FILE, patched, 'utf8');
    return true;
  }

  // Exact string match (used for compact one-liner blocks)
  if (!src.includes(persona.searchStr)) {
    console.log(`  ✗ --apply: could not locate searchStr in personalities.ts — skipping patch.`);
    console.log(`    Expected: ${persona.searchStr}`);
    return false;
  }
  const patched = src.replace(persona.searchStr, replacement);
  await fs.writeFile(PERSONAS_FILE, patched, 'utf8');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const personas = FILTER
    ? PERSONAS.filter((p) => p.name.toLowerCase().includes(FILTER))
    : PERSONAS;

  if (personas.length === 0) {
    console.error(`No personas matched --persona "${FILTER}".`);
    console.error(`Available names: ${PERSONAS.map((p) => p.name).join(', ')}`);
    process.exit(1);
  }

  console.log('─'.repeat(64));
  console.log(`  Model    : ${MODEL}`);
  console.log(`  Ollama   : ${BASE_URL}`);
  console.log(`  Count    : ${COUNT} lines per persona`);
  console.log(`  Timeout  : ${TIMEOUT_MS}ms`);
  console.log(`  Apply    : ${APPLY ? 'YES — will patch personalities.ts' : 'no (print only)'}`);
  console.log(`  Personas : ${personas.length}`);
  console.log('─'.repeat(64));

  const system = buildSystemPrompt();
  const results = [];

  for (const persona of personas) {
    console.log(`\n▶ ${persona.name}`);
    console.log(`  ${persona.blurb}`);
    console.log(`  Old: ${persona.currentLines.join(' | ')}`);
    process.stdout.write('  Calling Ollama...');

    const raw = await ollamaChat(system, buildUserPrompt(persona));

    if (raw === null) {
      console.log(' failed.\n');
      results.push({ persona, lines: null, ok: false });
      continue;
    }

    const lines = parseLines(raw);

    if (lines.length === 0) {
      console.log(' got response but could not parse lines.');
      console.log('\n  Raw response:');
      console.log(
        raw
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n'),
      );
      results.push({ persona, lines: null, ok: false });
      continue;
    }

    console.log(` got ${lines.length} line(s).`);
    console.log();
    lines.forEach((l, i) => console.log(`  ${String(i + 1).padStart(2)}. ${l}`));

    console.log('\n  ── TypeScript (paste into personalities.ts) ──');
    console.log(formatAsTS(lines));
    console.log(`  ── replaces ──`);
    if (persona.searchStr) {
      console.log(`    ${persona.searchStr}`);
    } else {
      console.log(`    (multiline block anchored by regex for ${persona.name})`);
    }

    if (APPLY) {
      const ok = await applyToPatch(persona, lines);
      console.log(ok ? '  ✓ Patched personalities.ts.' : '  ✗ Patch failed — see above.');
      results.push({ persona, lines, ok });
    } else {
      results.push({ persona, lines, ok: true });
    }
  }

  // ── Summary ──
  console.log('\n' + '─'.repeat(64));
  console.log('Summary:');
  for (const r of results) {
    const status = r.lines === null ? '✗ failed   ' : `✓ ${r.lines.length} lines`;
    console.log(`  ${status}  ${r.persona.name}`);
  }
  if (APPLY) {
    console.log('\nRun `npx tsc --noEmit` to verify the patched file compiles.');
  } else {
    console.log('\nRe-run with --apply to patch personalities.ts automatically.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
