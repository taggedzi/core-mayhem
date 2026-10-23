# Announcer replacement checklist

## Scope

The former configuration imported 50 entries referring to **49 unique audio
files**. All 49 exist in the 107-file local archive. The other **58 recordings
were not referenced** by the former announcer configuration and do not need
replacements to restore its previous coverage.

This audit uses the configuration before removal at commit `702a223^`,
compared with the current event detectors and archived filenames. It does not
transcribe or reuse the archived audio. Suggested lines below are a new script;
numbered variants should have distinct deliveries or wording.

All 49 replacements have now been generated with eSpeak NG and are enabled.
The original scripts are in `scripts/announcer-lines.json`; generated WAVs
and duration metadata live in `src/audio/announcer/`. Regenerate with
`npm run audio:announcer` (eSpeak NG is required only for regeneration).
The tables below preserve the audit and document the current spoken script.

## Files to generate

| Suggested replacement file         | Suggested spoken line           | Event pools               |
| ---------------------------------- | ------------------------------- | ------------------------- |
| `battle_of_the_century.wav`        | Welcome to Core Mayhem!         | `pre_game`                |
| `who_will_win.wav`                 | Which core will survive?        | `pre_game`                |
| `get_ready_for_the_next_fight.wav` | A new core battle begins!       | `pre_game`                |
| `may_the_best_fighter_win.wav`     | Let the strongest core prevail! | `pre_game`                |
| `ready_1.wav`                      | Ready?                          | `ready`                   |
| `ready_2.wav`                      | Cores ready!                    | `ready`                   |
| `get_ready.wav`                    | Prepare for combat!             | `ready`                   |
| `show_time.wav`                    | Systems online!                 | `ready`                   |
| `fight_1.wav`                      | Fight!                          | `go`                      |
| `fight_2.wav`                      | Begin combat!                   | `go`                      |
| `fight_3.wav`                      | Weapons free!                   | `go`                      |
| `go_1.wav`                         | Go!                             | `go`                      |
| `go_2.wav`                         | Launch!                         | `go`                      |
| `go_3.wav`                         | Let the battle begin!           | `go`                      |
| `lets_rock.wav`                    | Power up and let loose!         | `go`                      |
| `firstblood_1.wav`                 | First core hit!                 | `firstblood`              |
| `firstblood_2.wav`                 | The first breach!               | `firstblood`              |
| `danger_1.wav`                     | Critical core damage!           | `danger`                  |
| `danger_2.wav`                     | Core integrity failing!         | `danger`                  |
| `danger_3.wav`                     | One more hit could end it!      | `danger`                  |
| `this_is_the_end_1.wav`            | Holding on by a thread!         | `danger`                  |
| `this_is_the_end_2.wav`            | The core is near collapse!      | `danger`                  |
| `theyre_on_fire.wav`               | An unstoppable assault!         | `high_damage`, `comeback` |
| `over_the_top.wav`                 | Overwhelming firepower!         | `high_damage`, `extreme`  |
| `amazing.wav`                      | Incredible impact!              | `high_damage`, `comeback` |
| `wow.wav`                          | What a hit!                     | `high_damage`, `comeback` |
| `sick.wav`                         | That was devastating!           | `high_damage`             |
| `excellent_1.wav`                  | A precision strike!             | `high_damage`             |
| `excellent_2.wav`                  | Outstanding attack!             | `high_damage`             |
| `not_bad.wav`                      | A solid hit!                    | `high_damage`             |
| `ive_never_seen_moves.wav`         | The balance is shifting!        | `momentum`, `comeback`    |
| `this_should_be_good.wav`          | This battle is heating up!      | `momentum`, `comeback`    |
| `battle_is_about_to_explode.wav`   | The arena is erupting!          | `momentum`, `extreme`     |
| `its_all_on_the_line.wav`          | Everything hangs on this!       | `momentum`, `extreme`     |
| `go_for_broke.wav`                 | Back from the brink!            | `comeback`                |
| `you_win_1.wav`                    | Victory secured!                | `match_end_win`           |
| `you_win_2.wav`                    | The surviving core takes it!    | `match_end_win`           |
| `winner_1.wav`                     | We have a winner!               | `match_end_win`           |
| `winner_2.wav`                     | A decisive victory!             | `match_end_win`           |
| `winner_3.wav`                     | The arena has its champion!     | `match_end_win`           |
| `gameover_1.wav`                   | Battle over!                    | `match_end_generic`       |
| `gameover_2.wav`                   | Combat complete!                | `match_end_generic`       |
| `finish.wav`                       | End of battle!                  | `match_end_generic`       |
| `finished.wav`                     | All weapons stand down!         | `match_end_generic`       |
| `match_over.wav`                   | The match has ended!            | `match_end_generic`       |
| `match_complete.wav`               | Round complete!                 | `match_end_generic`       |
| `count_down_from_10.wav`           | Ten seconds remaining!          | `time_countdown_10`       |
| `count_down_from_3.wav`            | Three seconds remaining!        | `time_countdown_3`        |
| `triumph_or_die.wav`               | Maximum firepower!              | `extreme`                 |

## Event mapping

Pools are collections of alternative clips. Each event selects a pool and then
a clip from that pool. Reused clips need to be generated only once.

| Game event            | Pools                     |
| --------------------- | ------------------------- |
| `pre_game`            | `pre_game`                |
| `match_start_ready`   | `ready`                   |
| `match_start_go`      | `go`                      |
| `first_core_damage`   | `firstblood`              |
| `high_damage`         | `high_damage`             |
| `major_swing`         | `momentum`, `high_damage` |
| `extreme_event`       | `extreme`                 |
| `comeback_noticeable` | `comeback`, `momentum`    |
| `comeback_major`      | `comeback`, `momentum`    |
| `comeback_epic`       | `extreme`, `comeback`     |
| `core_in_danger_L`    | `danger`                  |
| `core_in_danger_R`    | `danger`                  |
| `momentum_shift`      | `momentum`                |
| `time_countdown_10`   | `time_countdown_10`       |
| `time_countdown_3`    | `time_countdown_3`        |
| `match_end_win`       | `match_end_win`           |
| `match_end_generic`   | `match_end_generic`       |

## Timing and integration notes

- One suitable clip per pool is a practical first pass (13 pool entries).
  Generating all 49 restores the former selection variety.
- `get_ready.ogg` appeared twice in the old ready pool under different import
  names. One replacement is enough; duplicate entries are unnecessary.
- Countdown suggestions deliberately announce remaining time rather than
  playing a full spoken countdown. The current queue has a five-second global
  gap and priority-based ordering, so a long countdown can become stale or
  overlap the next timer announcement. Timer speech needs queue/timing review
  before restoring full countdown recordings. The old clip contents were not
  transcribed, so their exact spoken sequences are unverified.
- Keep ordinary clips short (roughly 0.5–2 seconds) and use a consistent voice,
  loudness, and dry mix. The game already ducks music and effects for speech.
- Both core-danger events share the same neutral pool. No left/right-specific
  recordings are required by the current implementation.
- Match-end win clips are for any winner; tie/generic match endings use the
  generic pool. No character names or round-number recordings are needed.
- The restored queue uses actual clip durations to prevent overlap, gives
  startup lines FIFO order, expires stale timer announcements, clears the
  queue on match endings and new matches, and cancels in-flight audio loads
  when interrupted. Audio settings disclose the synthesized robotic voice.

## Archived extras not needed for former coverage

These filenames were present locally but absent from the old imports:

- `alright.ogg`
- `a_new_challenger.ogg`
- `a_new_challenger_approaches.ogg`
- `battle_1.ogg`
- `battle_2.ogg`
- `choose_your_character.ogg`
- `continue_1.ogg`
- `continue_2.ogg`
- `count_down_from_3-2.ogg`
- `dude_come_on.ogg`
- `duel.ogg`
- `engage_1.ogg`
- `engage_2.ogg`
- `engarde.ogg`
- `failure_1.ogg`
- `failure_2.ogg`
- `finalmatch.ogg`
- `finalround.ogg`
- `finished2.ogg`
- `game_1.ogg`
- `game_2.ogg`
- `game_3.ogg`
- `get_ready_for_a_new_challenger.ogg`
- `great_1.ogg`
- `great_2.ogg`
- `here_comes_a_clown.ogg`
- `here_comes_a_new_challenger.ogg`
- `perfect_1.ogg`
- `perfect_2.ogg`
- `round4-2.ogg`
- `round4.ogg`
- `round5-2.ogg`
- `round5.ogg`
- `round6-2.ogg`
- `round6.ogg`
- `round7-2.ogg`
- `round7.ogg`
- `round_1_1.ogg`
- `round_1_2.ogg`
- `round_2_1.ogg`
- `round_2_2.ogg`
- `round_3_1.ogg`
- `round_3_2.ogg`
- `round_complete.ogg`
- `round_over.ogg`
- `round_set.ogg`
- `select_your_fighter.ogg`
- `strike.ogg`
- `that_was_close.ogg`
- `times_over.ogg`
- `times_up_1.ogg`
- `times_up_2.ogg`
- `untouchable.ogg`
- `versus_1.ogg`
- `versus_2.ogg`
- `welcome.ogg`
- `youre_incredible.ogg`
- `youre_in_first_place.ogg`
