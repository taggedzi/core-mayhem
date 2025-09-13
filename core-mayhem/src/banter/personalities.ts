import type { Personality } from "./index";

// Example personalities for a "light" and "dark" core

export const LightCore: Personality = {
  name: "LightCore",
  aggression: 0.35,
  humor: 0.7,
  formality: 0.45,
  optimism: 0.8,
  sarcasm: 0.25,
  quirks: {
    ellipsis: 0.15,
    staccato: 0.1,
    randomCaps: 0.05,
    emojiStyle: "emoji",
    emoji: 0.35,
  },
  lexicon: {
    hype: ["Nice read.", "Clean hit.", "We glide.", "That flowed.", "Crisp."] ,
    praise: ["Respect.", "Smooth.", "Well played.", "Nice path."],
  },
};

export const DarkCore: Personality = {
  name: "DarkCore",
  aggression: 0.85,
  humor: 0.25,
  formality: 0.6,
  optimism: 0.2,
  sarcasm: 0.75,
  quirks: {
    ellipsis: 0.1,
    staccato: 0.25,
    randomCaps: 0.15,
    emojiStyle: "kaomoji",
    emoji: 0.25,
  },
  lexicon: {
    tauntHard: ["Fracture.", "Collapse.", "Submit.", "You break.", "Your end."],
    pain: ["Bite registered.", "Scored.", "Damage taken.", "That landed.", "Noted."],
  },
};

export default { LightCore, DarkCore };

