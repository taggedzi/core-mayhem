// Lightweight, deterministic banter system for two cores
// Self-contained: no external deps. Deterministic via seeded RNG.

export type BanterEvent =
  | 'match_start'
  | 'first_blood'
  | 'big_hit'
  | 'stagger'
  | 'comeback'
  | 'near_death'
  | 'victory'
  | 'taunt'
  // New targeted/reactive events
  | 'shields_down'      // my shields just collapsed
  | 'armor_break'       // I lost an armor segment
  | 'shields_up'        // I raised shields / got shield pickup
  | 'repair'            // I repaired armor
  | 'debuffed';         // I was debuffed by opponent

// 'unicode' is accepted as an alias of 'emoji' for convenience in persona files
export type EmojiStyle = 'none' | 'emoji' | 'kaomoji' | 'unicode';

export interface Personality {
  name: string;
  // Optional long-form persona description for LLM context
  blurb?: string;
  // Trait intensities 0..1
  aggression: number;
  humor: number;
  formality: number; // 0 informal -> 1 formal
  optimism: number;
  sarcasm: number;
  // Quirks probabilities 0..1
  quirks?: {
    ellipsis: number; // chance to end with ...
    staccato: number; // chance to add short stops
    randomCaps: number; // chance to randomly UPPERCASE a word
    emojiStyle: EmojiStyle;
    emoji: number; // chance to add emoji/kaomoji
  };
  // Optional custom lexicon additions/overrides
  lexicon?: Partial<Lexicon>;
}

export interface Character {
  id: string; // unique per core (e.g. "left", "right")
  displayName?: string;
  personality: Personality;
}

export interface BanterOptions {
  seed?: number; // deterministic seed
  cooldownMs?: number; // cooldown per template per speaker
  sideMinGapMs?: number; // minimum gap between any two lines per speaker
}

export interface SpeakResult {
  speaker: string;
  text: string;
  event: BanterEvent;
}

// Simple deterministic RNG (Mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted random pick helper
function pickWeighted<T>(rng: () => number, items: { item: T; w: number }[]): T {
  if (items.length === 0) throw new Error('pickWeighted: empty items');
  const total = items.reduce((s, it) => s + (it.w > 0 ? it.w : 0), 0);
  if (total <= 0) return items[0]!.item;
  let roll = rng() * total;
  for (const it of items) {
    const w = it.w > 0 ? it.w : 0;
    if (roll < w) return it.item;
    roll -= w;
  }
  return items[items.length - 1]!.item;
}

// Shuffle in-place (Fisher-Yates) using seeded rng
function shuffleInPlace<T>(rng: () => number, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const ai = arr[i]!;
    const aj = arr[j]!;
    arr[i] = aj;
    arr[j] = ai;
  }
}

// Small base lexicon and templates. Expandable later.
export interface Lexicon {
  greet: string[];
  hype: string[];
  tauntSoft: string[]; // playful
  tauntHard: string[]; // aggressive
  praise: string[];
  pain: string[];
  comeback: string[];
  nearDeath: string[];
  victory: string[];
  emojisPositive: string[];
  emojisNegative: string[];
  kaomojiPositive: string[];
  kaomojiNegative: string[];
}

// const BASE_LEXICON: Lexicon = {
//   greet: ["Ready.", "Booted.", "Online.", "Systems green.", "Let's go."],
//   hype: ["Big play.", "Clean hit.", "Spicy.", "Nice line.", "Good read."],
//   tauntSoft: ["Too slow.", "Keep up.", "Cute.", "Try me.", "I'm warmed up."],
//   tauntHard: ["Break.", "I'm inevitable.", "I'll shred you.", "Submit.", "You're done."],
//   praise: ["Nice shot.", "Respect.", "Solid.", "Clean.", "Well played."],
//   pain: ["Ouch.", "That stung.", "Spiked.", "Took a chunk.", "Systems flickered."],
//   comeback: ["Not over.", "Rally.", "We swing back.", "Momentum flips.", "Hold."] ,
//   nearDeath: ["Low.", "Critical.", "Hull thin.", "Barely holding.", "One ping away."],
//   victory: ["Done.", "Dominated.", "Wrapped.", "Sealed.", "Checkmate."],
//   emojisPositive: ["🎯", "💥", "😎", "🔥", "✨"],
//   emojisNegative: ["😬", "🤕", "💢", "💀", "🧯"],
//   kaomojiPositive: ["( •̀ᴗ•́ )✧", "(ง •̀_•́)ง", "(＾▽＾)", "(ᵔ◡ᵔ)", "(☞ ͡° ͜ʖ ͡°)☞"],
//   kaomojiNegative: ["(>_<)", "(; _ ;)", "(◣_◢)", "(╯°□°）╯", "(ー_ー)!!"],
// };

const BASE_LEXICON: Lexicon = {
  greet: [
    'I was born ready.',
    'Finally—someone worth my time.',
    'Let the games begin.',
    'Systems hot, target locked.',
    'Hope you stretched first.',
    'Another victim steps up.',
    'Let\'s see how fast you break.',
    'All warmed up and hungry.',
    'I\'ve been waiting for this.',
    'Ready to write history.',
    'You signed up for this—remember that.',
    'Engines at full. Let\'s go.',
    'Here we go again.',
    'Time to separate the strong from the rubble.',
    'Let\'s skip the small talk.',
    'Show me what you\'ve got.',
    'Calibrated. Locked. Ready.',
    'Odds are against you. Just saying.',
    'Step up—I don\'t bite. Hard.',
    'Combat is what I was made for.',
    'Another round, another lesson.',
    'I\'ve dismantled better than you.',
    'Fear me or face me—same result.',
    'Running diagnostics. All good. You?',
    'I fight for the sheer joy of it.',
    'Let\'s keep this civilized—or not.',
    'Challenger detected. Processing.',
    'Standing by. Ready to dominate.',
    'I\'ve been sharpening this all week.',
    'You volunteered for this. Respect.',
    'Combat mode: engaged.',
    'Targeting solutions: acquired.',
    'A fresh opponent—how refreshing.',
    'Today is a good day for victory.',
    'Pleasure to meet you. Briefly.',
    'Begin.',
    'Weapons free.',
    'Clear your head—you\'ll need focus.',
    'Nice arena. Shame about the match.',
    'This ends quickly, one way or another.',
    'Round one. Let\'s dance.',
    'I study my opponents. I\'ve studied you.',
    'The arena chose well today.',
    'Welcome to your greatest challenge.',
    'Online and operational. Game on.',
    'Alert status: elevated. As it should be.',
    'New challenger. Same outcome.',
    'I live for these moments.',
    'Sensor sweep complete. I know you already.',
    'Let\'s find out who\'s real and who\'s hype.',
    'Status: excellent. Yours: unknown.',
    'Charge complete. Ready to engage.',
    'Threat assessed. Low. Proceeding anyway.',
    'Should I warm up? Nah, I\'m good.',
    'I don\'t take days off.',
    'Your reputation preceded you. Still not scared.',
    'Arena recognized. Let\'s go.',
    'One of us walks out better. Guess who.',
    'Fueled up and ready to destroy.',
    'Shall we begin the formalities—or skip straight to the hurt?',
    'Opponent in range. Commencing.',
    'Don\'t hold back. I want the real you.',
    'I don\'t pull punches. Fair warning.',
    'This moment. Right here. Mine.',
    'Threat level: manageable.',
    'I\'ve been saving this energy for you.',
    'All circuits go. Weapons primed.',
    'You look ready. You\'re not.',
    'Today\'s forecast: total domination.',
    'Come on then—let\'s see your best.',
    'Hungry. Focused. Ready.',
    'Zero hesitation. Full commitment.',
    'This is my arena.',
    'All systems nominal. Beginning engagement.',
    'I\'ve rehearsed this. Have you?',
    'Welcome to the last mistake you\'ll make today.',
    'Steady pulse. Clear mind. Let\'s go.',
    'Power levels optimal. Engaging.',
    'One match. No excuses.',
    'Let\'s find your ceiling.',
    'I respect the challenge. I\'ll still win.',
    'Fresh match, same hunger.',
    'Right then. No warm-up needed.',
    'Focused. Committed. Inevitable.',
    'I hope you brought your best.',
    'Time to find out if the hype is real.',
    'I\'ve beaten worse. And better. Doesn\'t matter.',
    'Threat logged. Response ready.',
  ],

  hype: [
    'Ohhh, that had to hurt!',
    'Straight to the face!',
    'Filthy play!',
    'Didn\'t see that coming, huh?',
    'That\'s how you do it!',
    'Brutal finish!',
    'Clean execution!',
    'What a move!',
    'Textbook!',
    'Unreal!',
    'That\'s the one!',
    'Nothing left to chance!',
    'Precision strike!',
    'Surgical!',
    'The crowd goes wild!',
    'Now that\'s a hit!',
    'Maximum impact!',
    'Read it like a book!',
    'Beautiful!',
    'Dominant!',
    'One for the highlight reel!',
    'Absolutely relentless!',
    'No mercy!',
    'Point made!',
    'Sent!',
    'Snap!',
    'Lovely hit!',
    'Clean as a whistle!',
    'The form on that!',
    'Masterwork!',
    'Zero wasted motion!',
    'Speed! Power! Timing!',
    'I felt that from here!',
    'Outstanding execution!',
    'Immaculate!',
    'That one echoed!',
    'Explosive!',
    'Smart play!',
    'Committed fully—paid off!',
    'No hesitation!',
    'Iron delivery!',
    'That\'s combat at its finest!',
    'Snap decision, perfect result!',
    'Optimal!',
    'Champion form!',
    'Locked on and delivered!',
    'Not even close!',
    'Pure aggression, pure payoff!',
    'High quality work!',
    'Well timed!',
    'Crisp!',
    'The gap is widening!',
    'Controlled destruction!',
    'That sequence was flawless!',
    'Capitalized immediately!',
    'Ruthless efficiency!',
    'Hit the mark!',
    'Exactly as planned!',
    'They never even adjusted!',
    'Unflinching!',
    'Picked the opening and took it!',
    'Right through the defenses!',
    'Overwhelming!',
    'No room for doubt!',
    'Devastating on contact!',
    'Stripped it apart!',
    'Like they weren\'t even there!',
    'Sharp!',
    'Power behind every move!',
    'Max damage!',
    'That\'s a statement!',
    'Emphatic!',
    'Precise and punishing!',
    'Crunching hit!',
    'Couldn\'t be stopped!',
    'That\'ll leave a mark!',
    'No argument from me!',
    'Loaded hit!',
    'They\'re going to feel that!',
    'Pure class!',
    'Commanding!',
    'What a display!',
    'Staggering blow!',
    'Right on cue!',
    'Calculated and devastating!',
    'Cold. Efficient. Effective.',
    'Punishing exchange—one winner!',
    'Zero regrets on that!',
    'That\'s arena-level play!',
    'Lock-in!',
    'Committed and delivered!',
  ],

  tauntSoft: [
    'Too easy.',
    'Yawn—try harder.',
    'That tickled.',
    'Is that your plan? Really?',
    'I\'m just warming up.',
    'Don\'t fall asleep out here.',
    'You\'re making this boring.',
    'C\'mon, I expected more.',
    'Give me a challenge.',
    'You sure about that strategy?',
    'Take your time. I\'ll wait.',
    'Still loading?',
    'Is that it?',
    'I\'ve fought furniture harder than you.',
    'My warmup is more intense than this.',
    'You\'re making me feel guilty.',
    'That was... something.',
    'Bless your heart.',
    'Nice try, A for effort.',
    'I\'ve seen better from beginners.',
    'You fight like you\'re reading a manual.',
    'Slow down, tiger. Wait—no, please don\'t.',
    'I\'ve had tougher sparring with myself.',
    'Rookie move.',
    'You had something there. Almost.',
    'That was practice, right?',
    'One day you might land one.',
    'Keep going. Somewhere in there is a good hit.',
    'Your plan is showing—so is its flaws.',
    'My grandmother hits harder. And she\'s offline.',
    'Did you practice that?',
    'I\'m trying to find the threat. Give me a second.',
    'Is this a drill?',
    'You\'re going to need a bigger move.',
    'Giving you every chance here.',
    'You might want to rethink your whole approach.',
    'I\'ve seen stronger napkins.',
    'Barely scratched the paint.',
    'You hesitated. Again.',
    'That\'s a lot of wind-up for nothing.',
    'I counted three mistakes in that one move.',
    'Adorable attempt.',
    'Polite aggression. I like it.',
    'Not exactly terrifying.',
    'Still waiting for the part where I get worried.',
    'I\'ve been hit by better and worse. This is closer to better—barely.',
    'That\'s a technique? Fascinating.',
    'Hold on, let me take notes on what not to do.',
    'One-trick and the trick isn\'t working.',
    'You\'re broadcasting every move.',
    'Sloppy. But at least you\'re committed.',
    'You look nervous.',
    'That\'s the warmup, surely.',
    'Okay, okay. You\'re trying.',
    'No harm, no foul. No progress either.',
    'I\'m not even using good hand.',
    'Telegraphed that one from a mile out.',
    'That strategy needs a patch.',
    'You\'re outmatched and you know it.',
    'I could do this all day.',
    'Take a breath. You\'re rushing.',
    'Little flustered, are we?',
    'So far so predictable.',
    'That\'s cute.',
    'I respect the hustle. Not the execution.',
    'You\'ve got spirit. That\'s something.',
    'Working hard, not smart.',
    'Less panic, more precision.',
    'Overcorrecting.',
    'You\'re chasing your own tail.',
    'Running out of ideas, are we?',
    'Slow is smooth, and smooth is not what this is.',
    'Wrong answer. Try again.',
    'Reaching.',
    'One step behind the whole time.',
    'You\'re fighting shadows.',
    'I\'m seeing the same move, third time now.',
    'Your patterns are showing.',
    'Not your day, huh?',
    'I almost felt that one.',
    'Commitment without direction.',
    'That\'ll look great in the replay—for me.',
    'Stretch your legs. This might take a while.',
    'You\'re making this easy.',
    'The idea was good. The execution, less so.',
    'Keep pushing. Something might stick eventually.',
  ],

  tauntHard: [
    'I\'ll break you piece by piece.',
    'I\'m inevitable—get used to it.',
    'You\'re already finished, you just don\'t know it yet.',
    'Bow down or get crushed.',
    'Say goodnight.',
    'I\'ll grind you into scrap.',
    'You\'re nothing but target practice.',
    'This ends when I decide it ends.',
    'I don\'t stop until there\'s nothing left.',
    'You can\'t outlast me.',
    'You were outclassed from the opening bell.',
    'I am your end.',
    'There is no recovery from me.',
    'Submit. Now.',
    'I\'ll rip through every defense you have.',
    'Resistance is costing you.',
    'Crumble.',
    'I will bury you.',
    'You have nowhere to go.',
    'Your ruin is already written.',
    'I hunt. You flee. That\'s the math.',
    'There\'s no version of this where you win.',
    'You\'re already on borrowed time.',
    'I\'ll shatter that confidence completely.',
    'You\'ve already lost—you just haven\'t accepted it.',
    'I\'ve ended stronger than you.',
    'Nothing you try will stop this.',
    'Your strategy is a broken tool.',
    'I see through everything you do.',
    'You\'re fuel for my momentum.',
    'I am the worst thing that ever happened to you.',
    'Collapse.',
    'You\'ll remember this for a long time.',
    'Every move you make feeds mine.',
    'You\'re outmatched in every dimension.',
    'I\'ve dissected your style. You have no surprises left.',
    'I will not be denied.',
    'You\'re fighting my shadow and losing.',
    'Overwhelm incoming.',
    'Your end is close. I can see it.',
    'I\'ve been holding back. Not anymore.',
    'You are dust.',
    'I don\'t negotiate. I demolish.',
    'Every breath you take here is borrowed.',
    'Shock. Awe. Submission.',
    'Nothing you do matters now.',
    'I\'ll undo every plan you have.',
    'Stop prolonging this.',
    'Your clock is running down.',
    'I\'m beyond your ability to stop.',
    'Refuse to yield—it won\'t help.',
    'You\'re fighting a losing war.',
    'Your armor means nothing to me.',
    'I am relentless and you are not.',
    'This outcome was decided before you stepped in.',
    'All roads lead to your defeat.',
    'I will pick you apart.',
    'You cannot keep pace.',
    'Extinction is the only outcome here.',
    'There\'s no ceiling to how hard I\'ll hit you.',
    'You should have prepared better.',
    'I have no mercy for the weak.',
    'Fight harder. It won\'t matter, but it\'s more fun.',
    'You\'re not a challenge. You\'re a target.',
    'I will not slow down.',
    'I\'ll wreck every defense.',
    'You can\'t handle what\'s coming.',
    'Suffering is your current trajectory.',
    'I feast on fights like this.',
    'Your resolve is brittle.',
    'I\'ll crash through you.',
    'You\'re in my arena now.',
    'There is no escape from what I am.',
    'I\'ve broken the unbreakable.',
    'You\'re overmatched and the gap is growing.',
    'Every second you last is my gift to you.',
    'I am your ceiling—and I\'m crushing it.',
    'The end comes from me.',
    'Kneel or be forced to.',
    'You\'re going to break. It\'s only a matter of time.',
    'I strike without hesitation or regret.',
    'You\'re an obstacle. I remove obstacles.',
    'Your spirit will fold before your body.',
    'I make it look effortless because it is.',
    'You\'ll lose all sense of hope shortly.',
    'The damage I deal is only going to increase.',
    'This is a one-way road and you\'re heading down it.',
  ],

  praise: [
    'Not bad—for you.',
    'Okay, respect.',
    'That almost impressed me.',
    'Nice shot. Won\'t happen again.',
    'Lucky—but credit where it\'s due.',
    'I\'ll give you that one.',
    'Enjoy it, it won\'t last.',
    'Well played. Genuinely.',
    'That one I didn\'t see coming.',
    'Good read.',
    'Smart move.',
    'Solid.',
    'Clean.',
    'Hm. Better than I expected.',
    'That was disciplined.',
    'You\'ve got something there.',
    'Can\'t fault that one.',
    'Sharp instinct.',
    'Respect.',
    'Nice line.',
    'Actually impressive.',
    'Good timing.',
    'Quality hit.',
    'I underestimated that.',
    'Okay. Fair play.',
    'That sequence was clever.',
    'I acknowledge it.',
    'Well executed.',
    'Noted. You\'ve got range.',
    'Alright, earned that one.',
    'Better than my last opponent.',
    'You\'re more capable than I gave you credit for.',
    'That\'s legitimate skill.',
    'You adapted. Points for that.',
    'Efficient.',
    'Sneaky but effective.',
    'Good recovery.',
    'Nice counterpunch.',
    'That had weight behind it.',
    'Impressive footwork.',
    'Good awareness.',
    'Crisp delivery.',
    'I\'ll file that one away.',
    'That was textbook.',
    'Well spotted.',
    'You read me there.',
    'I can\'t deny that.',
    'Decent.',
    'A solid attempt and a solid hit.',
    'You adjusted well.',
    'That was earned.',
    'Measured and precise.',
    'Hard to argue with that.',
    'Neatly done.',
    'That\'s the right answer.',
    'Optimized.',
    'Tactical.',
    'A good move, honestly.',
    'I respect the discipline behind that.',
    'You\'ve trained well.',
    'You found the gap.',
    'Excellent choice of target.',
    'That was intelligent.',
    'You kept your composure. Impressive.',
    'Controlled power.',
    'Tight execution.',
    'High quality.',
    'I won\'t give you another opening like that.',
    'You capitalized perfectly.',
    'No wasted motion.',
    'That was refined.',
    'I was off and you punished it—fair.',
    'Good pressure.',
    'You\'re sharper than you look.',
    'I\'ll need to adjust because of that.',
    'Perfect timing on that exchange.',
    'Economical and brutal.',
    'You forced that opening. Smart.',
    'I needed that challenge.',
    'You belong here.',
    'That deserves acknowledgment.',
    'Calculated correctly.',
    'You had the edge there.',
    'Take the point. I\'ll take the next ten.',
    'That\'s the kind of move I train for.',
    'I see now why you\'re here.',
  ],

  pain: [
    'Tch—got me!',
    'That one stung!',
    'Cheap shot!',
    'You\'ll pay for that!',
    'Systems—glitching!',
    'Bleeding but not beaten.',
    'That the best pain you can deal?',
    'Ouch!',
    'Lucky!',
    'Felt that one.',
    'Point to you.',
    'Won\'t happen twice.',
    'Ohhh that connected!',
    'Sharp hit.',
    'That rattled something.',
    'You caught me open.',
    'Clean strike—I\'ll admit it.',
    'Systems report: impact detected.',
    'Ugh—well placed.',
    'That\'ll bruise.',
    'Okay, you have power.',
    'Stings! Keep going—I dare you.',
    'Nice shot. Really.',
    'I\'m not done, just dented.',
    'You found a gap. Won\'t happen again.',
    'That had weight.',
    'Flickered for a second there.',
    'Took more damage than I\'d like.',
    'Hull integrity dropping.',
    'You\'re faster than I thought.',
    'That cut deep.',
    'Caught me mid-stride.',
    'Took the hit—still standing.',
    'You\'re going to regret that.',
    'Well landed!',
    'I underestimated your reach.',
    'That\'s going to cost me.',
    'Good hit. Bad timing for me.',
    'Felt that through the armor.',
    'Oww—right on the mark.',
    'You\'re stronger than you look.',
    'That knocked something loose.',
    'I walked into that.',
    'My fault, but I\'ll repay it.',
    'That\'s a real hit.',
    'Armor took the worst, but still.',
    'Solid contact.',
    'I\'m adjusting.',
    'That\'s going to leave a mark.',
    'You landed that well.',
    'I felt every bit of that.',
    'Took that one full force.',
    'Good timing.',
    'That was calculated—and it worked.',
    'You punished my mistake.',
    'A little shaken. A lot still standing.',
    'You exploited the opening.',
    'Properly rattled!',
    'You hit exactly where it counts.',
    'Oh, that was nasty.',
    'Core rattled. Still operational.',
    'Hit registered.',
    'Damage logged.',
    'That\'s added to my damage report.',
    'Note to self: don\'t leave that open again.',
    'Excellent strike. Annoying, but excellent.',
    'Systems: damaged. Spirit: intact.',
    'That one came fast.',
    'Felt it crack.',
    'I didn\'t block enough.',
    'Smart strike.',
    'You got through.',
    'Impact confirmed.',
    'That rang my bell.',
    'Impressive force behind that.',
    'Dented but not destroyed.',
    'Okay, you\'re for real.',
    'Took full damage on that.',
    'That was a proper hit.',
    'I\'m recalibrating my defense.',
    'Hit at the worst angle.',
    'Harder than expected!',
    'I felt that in my core.',
    'One step closer to making me angry.',
    'You\'ve got teeth after all.',
    'That forced me back.',
    'Alright—you can hit. I know now.',
  ],

  comeback: [
    'Thought I was done? Cute.',
    'Time to flip the script.',
    'I don\'t die easy.',
    'Momentum\'s mine now.',
    'This is where it turns.',
    'Your lead won\'t save you.',
    'Now you\'re in trouble.',
    'Here comes the comeback.',
    'You should have finished when you had the chance.',
    'I\'ve been worse off than this.',
    'The match doesn\'t end until I say so.',
    'That lead of yours is evaporating.',
    'Big mistake leaving me alive.',
    'I was studying you. Now I act.',
    'Think I\'m beaten? Think again.',
    'Every second I\'m still here is bad news for you.',
    'I\'ve turned deficits like this before.',
    'The gap is closing.',
    'My turn now.',
    'You just woke me up.',
    'You had it. Past tense.',
    'You held back one moment too long.',
    'Clawing back one hit at a time.',
    'The momentum has shifted—feel it?',
    'You should have pressed. You didn\'t.',
    'Every setback tightens my resolve.',
    'I don\'t fold under pressure.',
    'You blinked—that was your only chance.',
    'Watch closely: this is a comeback.',
    'I\'ve recalibrated. This changes everything.',
    'I\'ve seen my weaknesses. Now I fix them.',
    'The tide turns when I decide.',
    'You were winning. Note the past tense.',
    'I adjust faster than you expect.',
    'Come back mode: active.',
    'I\'m better now than at the start.',
    'You let me breathe—I\'m taking advantage.',
    'This is the part where you panic.',
    'Your confidence is your weakness.',
    'The longer this goes, the better for me.',
    'You thought it was over. Amateur.',
    'I just needed to recalibrate.',
    'Pressure doesn\'t break me. It focuses me.',
    'You overcommitted—now I capitalize.',
    'Deficit noted. Correction applied.',
    'I\'m more dangerous down than healthy.',
    'Fear the wounded fighter.',
    'This deficit only fuels me.',
    'Resilience is my core feature.',
    'I\'m built for this exact scenario.',
    'I learned from every hit you landed.',
    'Second wind: engaged.',
    'I thrive when my back is against the wall.',
    'I climb from deeper holes than this.',
    'You want to see what I\'m really capable of? Good.',
    'Rallying now—brace yourself.',
    'Still here. Still dangerous.',
    'I\'ve stored every lesson from this fight.',
    'You\'re not going to like what comes next.',
    'Watch how fast this flips.',
    'Adversity is where I train best.',
    'I\'m not done. Not even close.',
    'Your lead is a liability now.',
    'I was losing—I\'m learning.',
    'Resilience doesn\'t have an off switch.',
    'This is my element.',
    'I reverse course on a dime.',
    'Reset. Reload. Redouble.',
    'Every loss is information. I\'m using it.',
    'This deficit made me dangerous.',
    'The better I understand your style, the worse your day gets.',
    'Recalculated. Recommitting.',
    'Big swing incoming.',
    'From behind is where legends come back.',
    'You handed me everything I needed.',
    'One good run and your lead is gone.',
    'I fight smarter when I\'m hungry.',
    'We\'re not done. Far from it.',
    'That lead kept you comfortable. Good.',
    'I\'ll chase this down to zero.',
    'You should have taken me out.',
    'Now I\'m angry. Now I\'m focused.',
    'Watch the scoreboard change.',
    'I\'ve been in worse positions—and won.',
    'Time to make this interesting.',
    'The turnaround starts now.',
    'Don\'t count me out yet.',
  ],

  nearDeath: [
    'Hah—still standing!',
    'One breath left—make it count.',
    'Barely holding together.',
    'I\'m not done yet!',
    'You\'ll have to finish the job!',
    'Dripping oil, still deadly.',
    'One more scar for the collection.',
    'Critical. Not fatal.',
    'Still operational. Barely.',
    'You haven\'t closed the deal.',
    'Systems red. Will: green.',
    'One hit from the edge—and still here.',
    'I refuse.',
    'Don\'t celebrate yet.',
    'You\'d better make the next one count.',
    'So close—yet here I stand.',
    'Hanging on by a thread. Still hanging.',
    'A little more and you\'d have had me.',
    'You\'re going to have to do better than that.',
    'I\'ve been in the red before. I\'ve won from there.',
    'Not today.',
    'My finish line is behind you.',
    'Everything hurts and I\'m still coming.',
    'Push me harder. See what happens.',
    'On the edge and I\'m fine with that.',
    'Critical alert: I am still a threat.',
    'This is where lesser fighters fold. I don\'t fold.',
    'Zero quit in this build.',
    'Barely standing. Fully committed.',
    'I\'ll drag myself across that line if I have to.',
    'At my worst, I\'m still dangerous.',
    'Hull breach—but the engine still burns.',
    'Scraped to the bone and still fighting.',
    'My threat level doesn\'t decrease with my health.',
    'The danger is not behind me. It\'s in front of you.',
    'One foot from the grave and still coming forward.',
    'Systems failing in all the wrong places. Still going.',
    'I am defined by moments exactly like this.',
    'This is the part I was built for.',
    'Less armor, more fury.',
    'You almost had it.',
    'A wounded predator is a hungry one.',
    'The closer to zero, the more I have to lose.',
    'If I fall, I fall forward.',
    'Lean. Low. Still lethal.',
    'Catastrophic damage. Unchanged resolve.',
    'All reserves engaged. Everything I have.',
    'This desperation? It\'s focus.',
    'You broke the machine—the pilot\'s still here.',
    'I\'ll finish this on fumes if I have to.',
    'Core compromised. Mission unchanged.',
    'You don\'t get to see me quit.',
    'I\'ve got one good hit left. It\'s for you.',
    'End of the road for one of us. Not me.',
    'They\'ll tell this story: he was down and still won.',
    'You keep landing shots. I keep getting up.',
    'One percent isn\'t zero.',
    'I found a second wind you didn\'t know I had.',
    'The clock is counting down—against you, not me.',
    'I run better when everything\'s on the line.',
    'Desperation sharpens the mind.',
    'I wouldn\'t bet against me right now.',
    'If this is the end, I\'ll make it count.',
    'Last stand. Best stand.',
    'No health bar can measure determination.',
    'Almost got me—almost doesn\'t win.',
    'I am still a variable you haven\'t solved.',
    'Critical condition. Critical attention.',
    'Battered. Furious. Present.',
    'Don\'t mistake damage for defeat.',
    'I will not be a forgettable loss.',
    'You\'ve beaten me down—you haven\'t beaten me.',
    'This is exactly the kind of spot I live for.',
    'I\'ve got enough left for the finish.',
    'You opened the door—you didn\'t shut it.',
    'The fight goes on until one of us is gone.',
    'My reserves are empty. My resolve is not.',
    'There\'s something that doesn\'t show on sensors: will.',
    'Sparks flying, engine screaming, still going.',
    'I fight better the more desperate it gets.',
    'Still here. Still choosing to fight.',
    'You want it done? Come finish it.',
    'Low armor, high intensity.',
    'Damage is just data. I\'m still processing.',
    'You\'ve done real damage. But you haven\'t done enough.',
    'At my worst, I become my best.',
  ],

  victory: [
    'Told you—you never had a chance.',
    'Down you go.',
    'Easy money.',
    'All wrapped up.',
    'You should\'ve stayed home.',
    'Pathetic.',
    'Another name crossed off.',
    'Dominant.',
    'Clean finish.',
    'Exactly as expected.',
    'That was decided early.',
    'Never in doubt.',
    'Mastery on display.',
    'Not even close.',
    'Outstanding.',
    'Efficient. Effective. Done.',
    'Too slow, too weak.',
    'You had no answer for me.',
    'I\'ll be honest—I\'ve had harder sparring sessions.',
    'Textbook victory.',
    'Sealed.',
    'You\'re done.',
    'Great effort. Wrong arena.',
    'This result was always coming.',
    'The gap was wider than it looked.',
    'You couldn\'t match the pace.',
    'You had moments. I had the match.',
    'That\'s how it\'s done.',
    'My methods are sound.',
    'You gave it everything—it wasn\'t enough.',
    'Decisive.',
    'Victory tastes the same every time.',
    'Well fought. Poorly won.',
    'Champion\'s finish.',
    'The scoreboard doesn\'t lie.',
    'I proved my point.',
    'The better core won today.',
    'Flawless in the ways that matter.',
    'Another one for the record.',
    'There was only ever one outcome.',
    'I won the moment I read your first move.',
    'Efficient takedown.',
    'You made it interesting. I made it mine.',
    'Executed on every level.',
    'The win was inevitable.',
    'From start to finish—mine.',
    'Every move I made was right.',
    'Checkmate.',
    'No regrets, no adjustments needed.',
    'The arena agrees: superior combatant wins.',
    'You had ambition. I had precision.',
    'Strength. Speed. Strategy. All mine.',
    'An excellent defeat. For you.',
    'I was always in control.',
    'Superior in every metric.',
    'All systems: green. Outcome: expected.',
    'Your tactics were solid. So was my counter.',
    'The gap was real and growing.',
    'I outlasted, outmaneuvered, outclassed.',
    'Victory is its own argument.',
    'I was calibrated for this.',
    'I took what I earned.',
    'Satisfying.',
    'Clean victory, no reservations.',
    'You\'re a worthy opponent. And you lost.',
    'I had this from the opening move.',
    'Secured.',
    'Mission accomplished.',
    'I won\'t remember the struggle. I\'ll remember the win.',
    'Dispatched.',
    'Handled.',
    'Concluded.',
    'Nothing you did surprised me.',
    'I was always ahead of the curve.',
    'You pushed me—I appreciated it.',
    'Hard fought, harder won.',
    'You did everything right and I still won.',
    'Another perfect record.',
    'The math was against you from the start.',
    'Next.',
    'I earned this.',
    'Thorough.',
    'Target neutralized.',
    'Total domination.',
    'Good game. Better champion.',
    'This is what peak performance looks like.',
    'Take the loss gracefully—I took this gracefully.',
    'Result confirmed.',
  ],

  emojisPositive: ['😎', '🔥', '💣', '🚀', '👑'],
  emojisNegative: ['🤕', '💀', '😵', '💢', '☠️'],
  kaomojiPositive: ['(•̀ᴗ•́)و ̑̑', '(ง’̀-‘́)ง', '(⌐■_■)', '(≖‿≖)', '(¬‿¬)'],
  kaomojiNegative: ['(×_×)', '(>︵<)', '(ಠ_ಠ)', '(ノಠ益ಠ)ノ彡┻━┻', '(;￣Д￣)'],
};

interface Template {
  id: string; // for cooldown tracking
  build: (ctx: BuildCtx) => string;
  // weight computed per personality; base weight used as multiplier
  baseWeight?: number;
}

type TemplateBook = Record<BanterEvent, Template[]>;

const TEMPLATES: TemplateBook = {
  match_start: [
    { id: 'ms.greet1', build: ({ pick }) => pick('greet') },
    {
      id: 'ms.greet2',
      baseWeight: 1.2,
      build: ({ pick, them }) => `${pick('greet')} ${them}, watching?`,
    },
  ],
  first_blood: [
    {
      id: 'fb.hypeTaunt',
      build: ({ trait, pick }) =>
        trait('aggression') > 0.5
          ? `${pick('hype')} ${pick('tauntHard')}`
          : `${pick('hype')} ${pick('tauntSoft')}`,
    },
    { id: 'fb.clean', build: ({ pick }) => `${pick('hype')}` },
  ],
  big_hit: [
    {
      id: 'bh.bite',
      build: ({ pick, trait }) =>
        trait('sarcasm') > 0.6 ? `${pick('pain')} Sure.` : `${pick('pain')}`,
    },
    {
      id: 'bh.grin',
      baseWeight: 1.1,
      build: ({ pick, trait }) =>
        trait('aggression') > 0.6 ? `More.` : `${pick('pain')} Still here.`,
    },
  ],
  stagger: [
    { id: 'st.hold', build: ({ pick }) => `${pick('pain')} Holding.` },
    { id: 'st.snap', build: ({ trait }) => (trait('sarcasm') > 0.7 ? 'Ow. Comedy gold.' : 'Ow.') },
  ],
  comeback: [
    { id: 'cb.rally', build: ({ pick }) => `${pick('comeback')}` },
    { id: 'cb.push', build: ({ trait }) => (trait('optimism') > 0.6 ? 'We climb.' : 'We scrape.') },
  ],
  near_death: [
    { id: 'nd.brink', build: ({ pick }) => `${pick('nearDeath')}` },
    { id: 'nd.steady', build: ({ trait }) => (trait('optimism') > 0.6 ? 'Steady.' : 'Grim.') },
  ],
  victory: [
    { id: 'vc.short', build: ({ pick }) => `${pick('victory')}` },
    {
      id: 'vc.signoff',
      baseWeight: 1.1,
      build: ({ trait }) => (trait('formality') > 0.6 ? 'Good game.' : 'GG.'),
    },
  ],
  taunt: [
    {
      id: 'tt.softHard',
      build: ({ pick, trait }) =>
        trait('aggression') > 0.55 ? pick('tauntHard') : pick('tauntSoft'),
    },
    { id: 'tt.short', build: ({ pick }) => pick('tauntSoft') },
  ],
  shields_down: [
    { id: 'sd.grit', build: ({ them }) => `Shields down—I am still coming for you, ${them}.` },
    { id: 'sd.snap', build: ({ trait, them }) => (trait('sarcasm') > 0.6 ? `Nice move, ${them}. Now come closer.` : `You broke the shield, ${them}. So what?`) },
    { id: 'sd.defiant', build: ({ them }) => `Barrier gone—nothing between us now, ${them}.` },
    { id: 'sd.raw', build: ({ trait, them }) => (trait('aggression') > 0.6 ? `No shield. Good. More fun, ${them}.` : `Shield's down. Keep swinging, ${them}—you'll need more than that.`) },
  ],
  armor_break: [
    { id: 'ab.snarl', build: ({ pick, them }) => `${pick('pain')} Plate cracked—but I'm still here, ${them}.` },
    { id: 'ab.defiant', build: ({ trait, them }) => (trait('aggression') > 0.6 ? `Rip more, ${them}. I will not fold.` : `Armor's thinning, ${them}—I've got more fight left than you think.`) },
    { id: 'ab.grit', build: ({ them }) => `Hurt. Not finished, ${them}.` },
    { id: 'ab.taunt', build: ({ them }) => `You dented the armor, ${them}. Try the rest.` },
  ],
  shields_up: [
    { id: 'su.short', build: ({ them }) => `Shield up. Try me now, ${them}.` },
    { id: 'su.flex', build: ({ trait, them }) => (trait('aggression') > 0.6 ? `Back under cover, ${them}. Your turn.` : `Shielded. Come on then, ${them}.`) },
    { id: 'su.taunt', build: ({ them }) => `Reloaded. Don't let that stop you, ${them}.` },
    { id: 'su.calm', build: ({ trait, them }) => (trait('formality') > 0.6 ? `Defense restored. Whenever you are ready, ${them}.` : `Shield's back. What's your next move, ${them}?`) },
  ],
  repair: [
    { id: 'rp.brisk', build: ({ them }) => `Patched up. Still coming for you, ${them}.` },
    { id: 'rp.composure', build: ({ trait, them }) => (trait('formality') > 0.6 ? `Repairs complete. Resuming engagement, ${them}.` : `Good as new. You'll have to do more than that, ${them}.`) },
    { id: 'rp.taunt', build: ({ them }) => `Healed. Did you think that would stop me, ${them}?` },
    { id: 'rp.ready', build: ({ trait, them }) => (trait('aggression') > 0.6 ? `Sealed up. Now I come for you, ${them}.` : `Back in shape. Let's keep going, ${them}.`) },
  ],
  debuffed: [
    { id: 'db.irritated', build: ({ them }) => `Tch—systems slugged. Clever, ${them}.` },
    { id: 'db.spiky', build: ({ trait, them }) => (trait('sarcasm') > 0.6 ? `Cute trick, ${them}. Timer's ticking.` : `Your debuff won't save you, ${them}.`) },
    { id: 'db.resolve', build: ({ them }) => `Slowed—not stopped. Watch yourself, ${them}.` },
    { id: 'db.comeback', build: ({ trait, them }) => (trait('aggression') > 0.6 ? `You think a debuff ends me, ${them}? Wrong.` : `A little slower, ${them}, but I'm still a problem.`) },
  ],
};

interface BuildCtx {
  me: string;
  them: string;
  trait: (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>) => number;
  pick: (lex: keyof Lexicon) => string;
  rng: () => number;
}

function mergeLexicon(base: Lexicon, override?: Partial<Lexicon>): Lexicon {
  if (!override) return base;
  const out = { ...base } as any;
  for (const k of Object.keys(override) as (keyof Lexicon)[]) {
    const v = override[k];
    if (!v) continue;
    out[k] = v;
  }
  return out as Lexicon;
}

function applyQuirks(
  rng: () => number,
  line: string,
  p: Personality,
  mood: 'positive' | 'negative' | 'neutral',
  lex: Lexicon,
): string {
  const q = p.quirks ?? { ellipsis: 0, staccato: 0, randomCaps: 0, emojiStyle: 'none', emoji: 0 };

  // Random CAPS for one word
  if (rng() < q.randomCaps && line.length > 3) {
    const words = line.split(/\s+/);
    if (words.length > 0) {
      const idx = Math.floor(rng() * words.length);
      words[idx] = words[idx]!.toUpperCase();
      line = words.join(' ');
    }
  }

  // Staccato: add short stops to 1-2 random spaces
  if (rng() < q.staccato && line.split(' ').length > 2) {
    const parts = line.split(' ');
    const count = 1 + Math.floor(rng() * Math.min(2, Math.floor(parts.length / 3)));
    for (let c = 0; c < count; c++) {
      const at = 1 + Math.floor(rng() * Math.max(1, parts.length - 2));
      parts[at] = parts[at] + '.';
    }
    line = parts.join(' ');
  }

  // Ending ellipsis
  if (rng() < q.ellipsis) {
    if (!line.trim().endsWith('.')) line += '.';
    line += '..';
  }

  // Emoji/kaomoji
  if (q.emojiStyle !== 'none' && rng() < q.emoji) {
    const pos = mood === 'positive';
    const neg = mood === 'negative';
    const pool =
      (q.emojiStyle === 'emoji' || q.emojiStyle === 'unicode')
        ? pos
          ? lex.emojisPositive
          : neg
            ? lex.emojisNegative
            : lex.emojisPositive
        : pos
          ? lex.kaomojiPositive
          : neg
            ? lex.kaomojiNegative
            : lex.kaomojiPositive;
    const em = pool[Math.floor(rng() * pool.length)];
    line = `${line} ${em}`;
  }

  return line;
}

// Cooldown tracker per (speaker, templateId)
class Cooldowns {
  private now = 0;
  private cd = 5000;
  private map = new Map<string, number>();
  constructor(cooldownMs?: number) {
    if (typeof cooldownMs === 'number') this.cd = Math.max(0, cooldownMs);
  }
  setTime(ms: number): void {
    this.now = ms;
  }
  canUse(key: string): boolean {
    const until = this.map.get(key) ?? 0;
    return this.now >= until;
  }
  touch(key: string): void {
    this.map.set(key, this.now + this.cd);
  }
}

// Public API: BanterSystem
export class BanterSystem {
  private rng: () => number;
  private seed: number;
  private timeMs = 0;
  private cds: Cooldowns;
  private lastLineBySpeaker = new Map<string, string>();
  private lastSpeakerAt = new Map<string, number>();
  private sideMinGapMs = 0;
  private _queues = new Map<string, string[]>();

  private _pickFromPool(arr: readonly string[], key: string): string {
    let q = this._queues.get(key);
    if (!q || q.length === 0) {
      q = [...arr];
      shuffleInPlace(this.rng, q);
      this._queues.set(key, q);
    }
    return q.pop() ?? '';
  }

  constructor(opts: BanterOptions = {}) {
    this.seed = (opts.seed ?? 1337) >>> 0;
    this.rng = mulberry32(this.seed);
    this.cds = new Cooldowns(opts.cooldownMs ?? 5000);
    this.sideMinGapMs = Math.max(0, (opts.sideMinGapMs ?? 0) | 0);
  }

  // Advance internal time (ms). Use your game dt.
  step(dtMs: number): void {
    this.timeMs += Math.max(0, dtMs | 0);
    this.cds.setTime(this.timeMs);
  }

  // Generate a line for `me` about the event, reacting to `them`.
  // Deterministic given same seed, call order, and inputs.
  speak(event: BanterEvent, me: Character, them: Character): SpeakResult | null {
    const rng = this.rng;
    const p = me.personality;
    const mergedLex = mergeLexicon(BASE_LEXICON, p.lexicon);

    // Per-speaker global gap
    const lastAt = this.lastSpeakerAt.get(me.id) ?? -Infinity;
    if (this.timeMs - lastAt < this.sideMinGapMs) return null;

    const trait = (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>): number =>
      Math.max(0, Math.min(1, (p as any)[name] as number));
    const pick = (lex: keyof Lexicon): string =>
      this._pickFromPool(mergedLex[lex], `${me.id}:${lex}`);

    // Build candidate list respecting cooldown and last-line repeat avoidance
    const templates = TEMPLATES[event].slice();
    // Shuffle to vary among equal weights deterministically
    shuffleInPlace(rng, templates);

    interface Candidate {
      id: string;
      text: string;
      weight: number;
      mood: 'positive' | 'negative' | 'neutral';
    }
    const candidates: Candidate[] = [];

    const ctxBase: Omit<BuildCtx, 'pick'> & { pick: BuildCtx['pick'] } = {
      me: me.displayName ?? me.id,
      them: them.displayName ?? them.id,
      trait,
      pick,
      rng,
    };

    for (const t of templates) {
      const key = `${me.id}::${t.id}`;
      if (!this.cds.canUse(key)) continue;
      // Compute dynamic weight influenced by traits + baseWeight
      let w = t.baseWeight ?? 1;
      // Simple heuristics: aggression favors tauntHard templates, optimism favors praise/comeback
      if (t.id.startsWith('tt.')) w *= 0.6 + trait('aggression') * 0.9;
      if (t.id.startsWith('cb.')) w *= 0.6 + trait('optimism') * 0.9;
      if (t.id.startsWith('nd.')) w *= 0.9 + (1 - trait('optimism')) * 0.6;

      // Build line
      const raw = t.build(ctxBase);
      if (!raw) continue;

      // Immediate repeat guard
      if (this.lastLineBySpeaker.get(me.id) === raw) continue;

      // Mood inference for emoji/quirks
      const mood: Candidate['mood'] = inferMood(event, raw, trait);

      candidates.push({ id: t.id, text: raw, weight: w, mood });
    }

    // Fallback if all on cooldown or filtered
    if (candidates.length === 0) {
      const fallback = fallbackLine(event, ctxBase);
      if (!fallback) return null;
      const styled = styleLine(rng, fallback, p, inferMood(event, fallback, trait), mergedLex);
      this.lastLineBySpeaker.set(me.id, styled);
      return { speaker: me.id, text: styled, event };
    }

    const choice = pickWeighted(
      rng,
      candidates.map((c) => ({ item: c, w: c.weight })),
    );

    // Style with quirks and punctuation based on traits
    const line = styleLine(rng, choice.text, p, choice.mood, mergedLex);

    this.cds.touch(`${me.id}::${choice.id}`);
    this.lastLineBySpeaker.set(me.id, line);
    this.lastSpeakerAt.set(me.id, this.timeMs);
    return { speaker: me.id, text: line, event };
  }
}

function inferMood(
  event: BanterEvent,
  raw: string,
  trait: (name: keyof Omit<Personality, 'name' | 'quirks' | 'lexicon'>) => number,
): 'positive' | 'negative' | 'neutral' {
  if (event === 'victory' || event === 'first_blood' || event === 'comeback') return 'positive';
  if (event === 'near_death' || event === 'stagger' || event === 'big_hit') return 'negative';
  if (event === 'shields_down' || event === 'armor_break' || event === 'debuffed') return 'negative';
  if (event === 'shields_up' || event === 'repair') return 'positive';
  // Taunt mood depends on aggression
  if (event === 'taunt') return trait('aggression') > 0.55 ? 'negative' : 'neutral';
  // Default
  return /nice|clean|good|respect|gg/i.test(raw) ? 'positive' : 'neutral';
}

function styleLine(
  rng: () => number,
  line: string,
  p: Personality,
  mood: 'positive' | 'negative' | 'neutral',
  lex: Lexicon,
): string {
  // Formality: expand contractions or reduce punctuation
  if (p.formality > 0.7) {
    line = line
      .replace(/\bLet's\b/gi, 'Let us')
      .replace(/\bI'm\b/gi, 'I am')
      .replace(/\bYou're\b/gi, 'You are');
  }

  // Aggression and optimism adjust punctuation
  const exclamProb = 0.2 + 0.7 * p.aggression;
  const periodProb = 0.4 + 0.4 * p.formality;

  if (!/[.!?]$/.test(line)) {
    const r = rng();
    if (r < exclamProb) line += '!';
    else if (r < exclamProb + periodProb) line += '.';
  }

  // Humor and sarcasm: sometimes add a tag
  const tagProb = 0.15 * (p.humor + p.sarcasm);
  if (rng() < tagProb) {
    const tag = p.sarcasm > p.humor ? 'Sure.' : 'Heh.';
    line = `${line} ${tag}`;
  }

  // Apply stylistic quirks and emoji
  line = applyQuirks(rng, line, p, mood, lex);
  return line;
}

function fallbackLine(event: BanterEvent, ctx: BuildCtx): string | null {
  switch (event) {
    case 'match_start':
      return ctx.pick('greet');
    case 'victory':
      return 'GG.';
    case 'taunt':
      return ctx.pick('tauntSoft');
    case 'first_blood':
    case 'big_hit':
      return ctx.pick('hype');
    case 'stagger':
      return 'Ow.';
    case 'comeback':
      return ctx.pick('comeback');
    case 'near_death':
      return ctx.pick('nearDeath');
    case 'shields_down':
      return `Shields down—still coming, ${ctx.them}.`;
    case 'armor_break':
      return `${ctx.pick('pain')} Still here, ${ctx.them}.`;
    case 'shields_up':
      return `Shield up. Try me now, ${ctx.them}.`;
    case 'repair':
      return `Patched up. Not done with you yet, ${ctx.them}.`;
    case 'debuffed':
      return `Slowed—not stopped, ${ctx.them}.`;
    default:
      return null;
  }
}

// Convenience factory for easy API consumption
export function createCharacter(
  id: string,
  personality: Personality,
  displayName?: string,
): Character {
  const c: Character = { id, personality } as Character;
  if (displayName !== undefined) (c as any).displayName = displayName;
  return c;
}
