# Trumpet Trainer — client

React 19 + Vite + TypeScript, styled with Chakra UI v3. The look comes from the
**Classical** design system: Cormorant Garamond headings, Lora body text, a single
brass accent, hairline borders, and outlined buttons (never filled).

> The frontend is mid-rehaul. The new design system and shared components are in
> place; pages are being rebuilt on top of them one at a time (done so far: the
> landing page). See [Old vs new](#old-vs-new) for what to use and what to avoid.

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

## Folder map

```
src/
├── theme/                 THE DESIGN SYSTEM. Start here to change how anything looks.
│   ├── palette.ts         Every raw colour value. The only file allowed to contain hex.
│   ├── roles.ts           Names colours by job: fg.muted, accent.solid, intonation.good…
│   ├── tokens.ts          Fonts, spacing, radii, shadows, sizes; registers the roles.
│   ├── textStyles.ts      Type scale: display.*, heading.*, kicker, meta, figure.*
│   ├── globalCss.ts       Page background, heading font, focus ring, text selection.
│   ├── keyframes.ts       Entrance animations: rise-in, pop-in, wipe-in, draw-on, …
│   ├── recipes/           Variant definitions per component (button primary/secondary/…)
│   └── index.ts           Builds the Chakra `system` and re-exports everything.
│
├── components/
│   ├── primitives/        Generic building blocks. Import from "@/components/primitives".
│   │                      Button, IconButton, Card, Tag, Input, NativeSelect, Field,
│   │                      SegmentedControl, RadioGroup, Stepper, Rule, Kicker, Stat,
│   │                      SectionHeading, Bookplate
│   ├── music/             Trumpet-specific UI. Import from "@/components/music".
│   │                      Staff (VexFlow notation with per-note intonation colour and a
│   │                      playback cursor), PitchReadout, ScoreFigure,
│   │                      IntonationLegend, ExerciseMeta
│   ├── layout/            Page frames. Import from "@/components/layout".
│   │                      AppShell (sidebar + content), FocusShell (no sidebar, for the
│   │                      player), Sidebar, PageHeader
│   ├── ui/                Chakra's generated setup (provider, toaster, tooltip). Rarely touched.
│   └── *.tsx, inputs/     OLD components. See "Old vs new" below.
│
├── pages/                 One file per route; routes are declared in App.tsx.
├── lib/                   Pure helpers for the new UI (intonation colours, formatting).
├── utils/                 App logic: music generation, API calls, history, library,
│                          profile, image handling.
├── hooks/                 usePitch (microphone), useMetronome, usePersistedState
├── auth/                  Firebase sign-in: useAuth() for state; auth.ts signs in, links
│                          a guest to Google, and signs out
├── profile/               The signed-in user's profile: useProfile()
├── schema/                Shared TypeScript types (exercises, music, profile)
└── constants/             Old layout constants
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

## Writing styles

- **Use text styles, not ad-hoc font sizes:**
  `<Text textStyle="heading.md">`, `<Heading textStyle="display.md">`, `<Text textStyle="kicker">`.
- **Spacing:** the design system's scale is `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
  (4.6px through 36.8px). Chakra's numeric scale (`p={4}`) still works, but it's what
  the old pages use.
- **Variants come from recipes:** `<Button variant="primary" size="lg">`.
  `<Card.Root size="lg" interactive>`. Don't restyle a component inline to make a
  variant; add the variant to the recipe instead.
- **Icons:** use [Lucide](https://lucide.dev) (`lucide-react`), as the design system
  specifies. The old pages use `react-icons`.
- **Motion:** use the keyframes in `theme/keyframes.ts` with fill-mode `backwards`, and
  put the animation under `_motionSafe` so it's skipped for viewers who prefer reduced
  motion: `_motionSafe={{ animation: "appear 400ms ease-out 200ms backwards" }}`.

## Old vs new

The rehaul replaces the old components gradually. Until a page is rebuilt it keeps
using the old ones, and both kinds live side by side.

| Old (don't use in new code)                                   | New                                      |
| ------------------------------------------------------------- | ---------------------------------------- |
| `DashBoardTemplate`, `Sidebar`, `SidebarTab`, `SidebarFooter` | `layout/AppShell`, `layout/Sidebar`      |
| `SheetMusic`                                                  | `music/Staff`                            |
| `SegmentInput`                                                | `primitives/SegmentedControl`            |
| `StepperInput`                                                | `primitives/Stepper`                     |
| `Dropdown`, `inputs/*Select`                                  | `primitives/NativeSelect` inside `Field` |
| Chakra `Button` / `Card` with stock variants                  | `primitives/Button` / `Card`             |
| `constants/layout.ts`                                         | `AppShell` handles page padding          |

Once a page no longer uses an old component and nothing else imports it, delete it.

## Design source

The mockups and the design system's own docs live in the claude.ai/design project
"Trumpet Trainer Mockups". The mockups offer several variants per screen (e.g. 1a, 1b,
1c for Today); only the chosen ones get built.
