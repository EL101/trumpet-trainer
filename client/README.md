# Trumpet Trainer — client

React 19 + Vite + TypeScript, styled with Chakra UI v3. The look comes from the
**Classical** design system: Cormorant Garamond headings, Lora body text, a single
brass accent, hairline borders, and outlined buttons (never filled).

> The frontend is mid-rehaul. The new design system, shared components and app shell
> (sidebar) are in place; page content is being rebuilt on top of them one screen at a
> time (done so far: the landing page, Generate, the practice player, the library and
> Tools). See [Old vs new](#old-vs-new) for what to use and what to avoid.
>
> Today and Progress aren't built yet, so they're commented out of the sidebar and
> `App.tsx`, and their routes go to Generate, which is also where signing in lands.

## Running it

From the repo root, `npm run dev` starts the client and the server together. To run
just the client:

```sh
cd client
npm install
cp .env.example .env   # fill in the Firebase keys, plus VITE_API_URL (the server's URL)
npm run dev            # http://localhost:5173
```

| Command          | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `npm run dev`    | Dev server                                         |
| `npm run build`  | Typecheck, then production build                   |
| `npm run lint`   | ESLint (includes the "no hard-coded colours" rule) |
| `npm test`       | Vitest                                             |
| `npm run format` | Prettier                                           |

In dev, open **`/design`** to see every shared component rendered with real data.
It's the quickest way to find out what already exists.

## How the pieces fit

Each layer only uses the layers below it:

```
pages/                    screens, one per route
   │
components/layout/        the page frame: sidebar, headers, focus mode
components/music/         staff, pitch readout, scores, intonation
   │
components/primitives/    buttons, cards, inputs, tags, … (no app logic)
   │
theme/                    colours, fonts, spacing, component variants
```

## The colour rule

**Never write a colour value in a component.** Use a role name instead:

```tsx
<Text color="fg.muted">…</Text>          // ✅
<Text color="#605d5d">…</Text>           // ❌ lint error
<Text color="gray.600">…</Text>          // ⚠️ old Chakra palette; avoid in new code
```

`npm run lint` fails on any hex value outside `theme/palette.ts`.

The roles you'll use most:

| Role                                        | Use for                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `bg`, `bg.panel`, `bg.subtle`               | Page background, raised surfaces, light fills         |
| `fg`, `fg.muted`, `fg.subtle`               | Body text, secondary text, tertiary labels            |
| `fg.error`                                  | Error messages                                        |
| `border`, `border.emphasized`               | Hairlines and dividers, hovered borders               |
| `accent.solid`                              | The brass accent for strokes, icons and large text    |
| `accent.fg`                                 | Accent-coloured text at small sizes (better contrast) |
| `accent.subtle`, `accent.muted`             | Tinted fills, soft accent borders                     |
| `intonation.good` / `fair` / `warn` / `bad` | Score and pitch colours, green through red            |

For colours that depend on cents (note colouring, pitch readouts), call
`centsColor(cents)` from `@/lib/intonation`. It blends smoothly from green to red.

**Changing or adding a colour:** put the value in `palette.ts`, give it a role in
`roles.ts`, then use the role name. Chakra makes every role available as a style
prop automatically.

## Where does new code go?

| You're adding…                                       | Put it in                                       |
| ---------------------------------------------------- | ----------------------------------------------- |
| A new screen                                         | `pages/`, wrapped in `AppShell` or `FocusShell` |
| A generic control or display (no trumpet knowledge)  | `components/primitives/`                        |
| Something that knows about notes, pitch or exercises | `components/music/`                             |
| A new variant of a button, card, tag…                | that component's recipe in `theme/recipes/`     |
| A new font size or text treatment                    | `theme/textStyles.ts`                           |
| A pure function used by the new UI                   | `lib/` (with a `.test.ts` next to it)           |
| Data fetching or app logic                           | `utils/` or a hook in `hooks/`                  |

A component built for a single page can live inside that page file. Move it into
`components/` once a second page needs it.

The signed-out landing page (`pages/LandingPage.tsx`) is the one screen without a
shell: it has no sidebar and nothing to go back to.

## The practice player

`pages/Practice.tsx` (route `/practice/<exerciseId>`, mockup 1e) plays one exercise: a
bar of count-in (which can be turned off), then the notes on a trumpet with a moving
cursor, a metronome and a tuner in a collapsible drawer. Clicking a note (or dragging
along the staff, note by note), or the previous and next bar buttons beside Play, moves
the cursor. Open it with `<PracticeButton exercise={…} originLabel="Generate" />` from
any page; the label is what the player's back links call that page. The button stays
disabled until history has numbered the exercise, because the player loads exercises
from history:

- **Opened from the button,** the exercise travels in the router state too, so the
  player shows it without a request.
- **In a new tab, after a reload or from a bookmark,** it loads the exercise with
  `GET /api/history/:exerciseId`, then `GET /api/library/:exerciseId` if history has let
  it go (pruned past the newest 100, or cleared). An id neither has goes back to the
  page that opened the player (Generate if the address doesn't name one) with an
  "Exercise not found" notice. Deleted history leaves no trace, so the notice can't tell
  a cleared exercise from a wrong link, and says it could be either. A load that fails
  (offline, a server error) stays on the player with a Try again button.
- **The back links** are plain links to the page that opened the player. The address
  names that page (`?from=/generate`), so they work in a new tab too. They hand the
  exercise back as `practiced` in the router state; read it with `readPracticed()` from
  `@/lib/practice` to put it back where it was. Generate doesn't need to: it keeps the
  exercise on its plate in session storage (per tab and per player), so the plate is
  still there after the player, a refresh or the browser's Back button.

Its label defaults to "Practice with feedback"; pass `label` to change it (the library's
panel says just "Practice").

### Listen, Play and the score card

The player has two modes (kept per browser, Listen to start with). **Listen** plays the
exercise on the trumpet. **Play** is the player's own run: the trumpet stays quiet (only
the count-in and the metronome, if it's on, sound), and the microphone listens. When the
run ends it's scored and the score card opens. The tempo is saved with the score, so in
Play the tempo control is locked (`TempoControl`'s `locked`) from Play until the take
ends or restarts, paused included. A run is scored whole, so Play always starts from the
top: clicking a note or the previous and next bar buttons doesn't move the music, it
shows a brief notice (`notify`'s `duration: BRIEF_NOTICE_MS`, with an `id` so repeats
don't stack) saying to switch to Listen. If the page is hidden mid-take (another tab, a
locked phone) the take pauses, since the microphone is read on animation frames, which
stop there.

- **Listening:** `hooks/useRunRecorder.ts` reads the microphone on the playback's own
  audio clock and places every frame in the music with `Playback.positionHeardAt()`,
  allowing for the speakers' and the microphone's delay. Pausing a take moves the cursor
  back to the start of the bar paused in (`pauseAt()`'s `toBar`), and Resume records it
  afresh from there. Pausing in Listen leaves the cursor where it stopped.
- **Scoring:** `scoreRun()` in `lib/scoring.ts` (pure, with tests) scores four parts
  from 0 to 100: right notes, rhythm, intonation, and steadiness & tone, weighted
  40/30/20/10 (`SCORE_PARTS`) into the overall score. Each part comes with feedback
  lines (`{ bar, beat, text, … }`) worded for the player: sharp, flat, wavered, rushed,
  never cents. It also gives per-note cents and every note played, judged, for the
  staff. A repeated note (the same pitch straight after, not tied or slurred) held over
  from the one before, with no attack of its own, scores nothing for rhythm and says so.
  A held note's release is found over dropouts of up to 0.2 s that it picks up from
  again before its end; after its end, sound that starts again is the next note.
- **Transcribing:** `transcribe()` in `lib/transcribe.ts` splits what was heard into the
  notes played (pitch, start, end), and `toGhost()` writes each as a note value from how
  long it lasted at the tempo, snapped to a sixteenth (held past a whole note, to the
  nearest beat). A note followed by the next within 0.2 s (a tongue gap, or the new
  pitch settling) is held up to it instead (`heldTo()`), so rounding its length doesn't
  leave a rest that wasn't played. `judgePlayed()` finds the written note under each one's middle: it's
  right if it's that note, wrong if not (or a rest is written there). A held note
  carries on through a little wavering or being out of tune, and through the microphone
  losing it for up to 0.2 s, unless a written note starts in that silence (then it's a
  tongued repeat). A tongue stop between fast notes can be shorter than a frame (about
  43 ms), so no frame is silent: `dipAt()` in `lib/hearing.ts` finds it as a dip in level
  instead, and a dip where a written note starts is a repeat too, both in `transcribe()`
  and as a note's attack in `scoreRun()`. A different note has to last 0.07 s to start a new one, and a note
  0.08 s to be kept, or at a fast tempo 0.6 of the shortest note written if that's
  shorter (`forTempo()`), so fast sixteenths aren't lost, but never under 0.03 s, so the
  metronome's click is still a blip. It goes by the shortest note written, not a
  sixteenth, so music without fast notes keeps the longer lengths: a split attack (a
  note speaking on the next partial for a moment) is as long as a fast sixteenth.
  Pitches heard below the trumpet's range are subharmonics, taken back up to the note
  due (`heardPitch()` in `lib/hearing.ts`).
- **On the staff, as it plays:** in Play, what's played goes on a staff of its own: a
  cue-size staff under each line of music (`Staff`'s `played`), drawn empty before a run
  so nothing moves when notes come in. The written music stays plain ink. Every 150 ms
  the player puts what's been heard so far on it: each note where and as long as it
  sounded, spelt for the key by `spellInKey()` (an accidental takes in the notes played
  earlier in its bar). Like the written music, it's drawn by VexFlow: each note is a
  `StaveNote` pinned under the moment it was played (its own `TickContext`, not the
  formatter's spacing), drawn at full size in a group scaled to cue size. Eighths and
  sixteenths that follow on within a beat are beamed as the written notes are
  (`beamRuns()`). A right note takes its
  written note's intonation colour once that's judged, a wrong one is red, and the one
  still sounding is faint, as it's judged by the written note under its middle, which
  moves on as it's held (`toMark()`). One held across a barline, or for a length no one
  note value fits, is drawn as notes tied together (`ghostPieces()`), across a line
  break too. Silence is written as faint rests (`silences()`): before the first note,
  between notes, and after the last, up to where silence is known (`playedTo`: a
  finished run's end, or for a take, 0.2 s before the newest frame, so a tongue gap
  never shows as a rest, and none after a note still sounding). A whole bar of silence is one whole-bar rest; otherwise each
  rest is the longest that starts on a multiple of its own length in the bar. While a
  take records, the staff shows only its live marks; the scored run's replace them when
  it ends. The score card's wrong-note excerpts use a played staff too. Played notes are
  drawn on their own, like the cursor, so they don't redraw the staff. The lines are
  still spaced, and the drawing sized, to leave room for them (`playedReach()` in
  `Staff`), so one far off the staff doesn't run into the next line; the staff is
  redrawn only when the room they need changes. Each played staff sits nearer its own
  line than the next, and lines leave room for ties' arcs as for slurs. Each update
  works only on what's still open (`lib/liveScore.ts`), so it costs the same late in a
  long run as early on. Transcription starts again from the start of the latest note
  played that's definitely over (`restartPoint()`); the notes before it are kept. A
  written note's results are worked out on every update until its whole stretch is heard
  (to `heardUntil()`: its end, half a beat, and the delays the newest frame lags by),
  then locked in. A take starting or resuming at `from` throws away what was kept from
  there on (`rewindLive()`). The recorder keeps its frames in order, so nothing is
  sorted. The score when the run ends is still worked out over every frame.
- **The score card** is `music/ScoreCard` (mockup B): the overall score and weights in a
  side column, then a row per part. A wrong note's line shows its bar with the note
  played drawn over it, held for as long as it was. Closing it ("See it on the staff")
  leaves the run marked on the staff. Try again (or Restart) takes the marks off and
  goes back to the top.
- **Saved scores:** each scored run is saved with `POST /api/scores`
  (`utils/scores.ts`), each score and each part's feedback in its own column.
  `GET /api/scores/latest/:id` gives the newest that still has its feedback.
  `LastFeedbackButton` (beside Practice on Generate and in the library's panel) and the
  player's "Last feedback" open it. Scores are never deleted, for the user's progress:
  each keeps what its exercise was (type, key, time signature, range, difficulty), and
  the hourly prune only clears the feedback, of runs past an exercise's newest 20 and of
  exercises in neither history nor the library. Those of an exercise gone are only
  marked at first (`feedback_orphaned_at`) and cleared by a later prune, at least 30
  minutes on, if it's still gone; one that's back is unmarked. Clearing history on
  Generate keeps the exercise on the plate in the same request (`DELETE /api/history`
  with `keep`, `clearHistory()`'s `keep`), saved as the new No. 1, so it's never out of
  both tables. A user can save at most 10 runs a minute and 300 a day (`SCORE_LIMITS` in
  `server/src/queries/scores.ts`, counted in the database under a lock on the user's
  row). Past either, the save is turned down with a 429 naming the limit, and the player
  says "Score not saved: too many runs" (`scoreLimitOf()`), still showing the run's
  card. A save that fails, for that or any reason, is said in a notice and on the run's
  card (`ScoreCard`'s `unsaved`, worded by `unsavedNotice()`), where it stays.
  `useLatestScore` keeps what it loaded with the user it was for, so another account's
  feedback isn't shown after a switch.
- **Pausing** turns the microphone off; Resume opens it again and the take carries on.
  Abandoning a take while the browser still asks for the microphone (switching to
  Listen, Restart, leaving) calls the request off (`useRunRecorder`'s `close`): if it's
  granted later the microphone is let go at once, and the take doesn't start.

## The library

`pages/Library.tsx` (route `/library`, mockups 1i and 6a) shows every saved exercise as
a card with its opening bar, filtered by type and searchable. It loads
`LIBRARY_PAGE_SIZE` (24) at a time from `GET /api/library/page`, which does the
filtering and search on the server, so a big library neither downloads nor draws every
score at once. Placeholder cards stand where the next chunk goes, and it loads as they
come within half a screen of view; its cards then come in one after another. Pages
follow on from the last entry loaded rather than an offset, so removing cards doesn't
make the next chunk skip any. (`GET /api/library` still sends the whole library, for
Generate's saved marks.) Clicking a card unfolds a
panel across the grid under that card's row, with the whole exercise, its details and
Practice. The grid is `auto-fill`, so the page reads the number of columns back from the
browser to know where a row ends (`rowEnd()` in `lib/library.ts`). Its rows are spaced
with margins rather than a row gap, so the gap under a panel opens with it. The player's
back links (and the browser's Back button) return with the practised exercise's panel
open again, loading chunks until it's among them. The filter and search are kept per tab. Exercises get into the library
from Generate's "Save to library". The panel's "Remove from library" asks first, and
looks for the exercise in the history Generate lists (`listHistory()`, its newest 100)
to say whether it can be saved again from there. Anywhere else, including a row past
the newest 100 that the hourly prune hasn't deleted yet, or a lookup that failed, it
says it **can't** be. Choosing a card moves focus to its panel's heading, and each card's
`aria-label` (`cardLabel()`) gives its key, length and date, so two cards with the same
number can be told apart.

The staff is written for B♭ trumpet, so the player sounds every note a whole tone
lower (`CONCERT_OFFSET` in `lib/tuning.ts`). The trumpet samples are in
`public/samples/trumpet/` (FluidR3 GM, MIT; the notice is in that folder).

## Writing styles

- **Use text styles, not ad-hoc font sizes:**
  `<Text textStyle="heading.md">`, `<Heading textStyle="display.md">`, `<Text textStyle="kicker">`.
  Between the sizes: `subheading` (a row's label, a size up from `heading.sm`) and
  `small` (body a size down, for short lines in a list).
- **Spacing:** the design system's scale is `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
  (4.6px through 36.8px). Chakra's numeric scale (`p={4}`) still works, but it's what
  the old pages use.
- **Variants come from recipes:** `<Button variant="primary" size="lg">`.
  `<Card.Root size="lg" interactive>`. Don't restyle a component inline to make a
  variant; add the variant to the recipe instead.
- **Icons:** use [Lucide](https://lucide.dev) (`lucide-react`), as the design system
  specifies. The old pages use `react-icons`.
- **Key and note names:** render them with `<PitchText>` (`"Bb major"` → B♭ major).
  Lora sets ♭ and ♯ on a full em, so PitchText pulls them in against their letter.
  For a plain string (an `aria-label`, say), use `formatPitch()` from `@/lib/format`.
- **Motion:** use the keyframes in `theme/keyframes.ts` with fill-mode `backwards` (the
  exit, `sink-out`, takes `forwards` so the element stays hidden until it's removed), and
  put the animation under `_motionSafe` so it's skipped for viewers who prefer reduced
  motion: `_motionSafe={{ animation: "appear 400ms ease-out 200ms backwards" }}`. Code
  that animates outside CSS (its own SVG, `scrollIntoView`, `element.animate()`, a
  timer) can't use `_motionSafe`; check `prefersReducedMotion()` from `@/lib/motion`
  instead, as `Staff` does for its labels.

## Old vs new

The rehaul replaces the old components gradually. Until a page is rebuilt it keeps
using the old ones, and both kinds live side by side.

| Old (don't use in new code)                  | New                          |
| -------------------------------------------- | ---------------------------- |
| `SheetMusic`                                 | `music/Staff`                |
| Chakra `Button` / `Card` with stock variants | `primitives/Button` / `Card` |

Once a page no longer uses an old component and nothing else imports it, delete it.

## Design source

The mockups and the design system's own docs live in the claude.ai/design project
"Trumpet Trainer Mockups". The mockups offer several variants per screen (e.g. 1a, 1b,
1c for Today); only the chosen ones get built.
