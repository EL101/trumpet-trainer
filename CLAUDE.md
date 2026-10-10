# Trumpet Trainer

Monorepo: `client/` is React 19 + Vite + Chakra UI v3; `server/` is Express + Prisma
(Postgres) + Firebase Admin. Each has its own `package.json`, so install and run their
scripts with `--prefix client` / `--prefix server`, or from inside the folder.

- Run everything: `npm run dev` at the root (after `npm run db:up` for Postgres)
- Client checks: `npm run build` (typecheck + build), `npm run lint`, `npm test -- --run`, `npm run format:check`

## Frontend

[client/README.md](client/README.md) is the map of the frontend: the folder layout,
the colour roles, where new code goes, and which old components are being replaced.
Read it before working in `client/`.

**Keep that README current.** If you add, move or remove folders in `client/src`, add
a shared component, theme layer or colour role, or retire an old component, update the
README in the same change.

### Where code goes

- `theme/` holds the design system. `palette.ts` contains every colour value, `roles.ts`
  names them by job, and `recipes/` defines component variants.
- `components/primitives/` holds generic building blocks with no app knowledge.
  `components/music/` holds anything that knows about notes, pitch or exercises.
  `components/layout/` holds page frames.
- `pages/` has one file per route. Wrap a new page in `AppShell`, or in `FocusShell`
  for the player.
- `lib/` holds pure helpers for the new UI, with a `.test.ts` next to each one.
  `utils/` and `hooks/` hold app logic and data fetching.
- A component used by only one page can stay in that page's file. Move it to
  `components/` once a second page needs it.
- Import through each folder's `index.ts`: `@/components/primitives`,
  `@/components/music`, `@/components/layout`, `@/theme`.

### Styling rules

- **No colour values in components.** Use semantic tokens (`color="fg.muted"`,
  `borderColor="border"`, `bg="accent.subtle"`). ESLint fails on hex anywhere outside
  `theme/palette.ts`. To add a colour, put the value in `palette.ts`, give it a role in
  `roles.ts`, then use the role. Avoid Chakra's stock palette (`gray.500`, `red.500`) in
  new code.
- Code that draws outside CSS (VexFlow, SVG built by hand, canvas) can't use token
  names. Import `roles` from `@/theme` for plain values, and use `centsColor()` from
  `@/lib/intonation` for pitch colours.
- Use `textStyle` (`display.*`, `heading.*`, `kicker`, `meta`, `figure.*`) instead of
  ad-hoc font sizes. Use the design spacing scale (`xs`–`2xl`) for new layouts.
- A new look for a component is a recipe variant in `theme/recipes/`, not inline style
  overrides at the call site.
- Recipes aren't registered in the Chakra system. Components consume them directly:
  `chakra("button", buttonRecipe)` for single-part components, or
  `createSlotRecipeContext({ recipe })` for multi-part ones (see `primitives/Card.tsx`).
  Follow the same pattern for new ones.
- Follow the design system's direction: outlined buttons (never solid accent fills),
  hairline borders, small shadows, and serif type throughout (Cormorant Garamond
  headings, Lora body). Icons come from `lucide-react`, not `react-icons`.
- **Never add unlayered global CSS** (e.g. a `*` reset in `index.css`). Chakra puts its
  styles in cascade layers, so any unlayered rule overrides every component. Global
  styles belong in `theme/globalCss.ts`.

### Components

- New pages must not use the old components listed in the README's "Old vs new" table
  (`DashBoardTemplate`, `SheetMusic`, `SegmentInput`, Chakra's stock `Button`/`Card`
  variants, …). Use the replacements.
- Component files export only components (React fast refresh requires it). Put helper
  functions and constants in `lib/` or in a sibling `.ts` file (e.g. `navItems.ts`).
- Accessibility: `IconButton` requires `aria-label`. Choice controls are built on
  native radios. Link labels to native inputs with `Field`'s render prop:
  `<Field label="Key">{(id) => <NativeSelect id={id} />}</Field>`. Use `Link` or
  `NavLink` for navigation, not an `onClick` that calls `navigate`.
- Before building a component, check the dev-only `/design` gallery
  (`pages/DesignPreview.tsx`) for one that already exists. Add new shared components to
  that gallery.

### Design source

Screens come from the "Trumpet Trainer Mockups" project in claude.ai/design. Several
variants are mocked per screen (1a, 1b, …). Build only the variants the user has
chosen, and don't change routes or the sidebar navigation unless asked.

### Before finishing frontend work

Run `npm run build`, `npm run lint`, `npm test -- --run` and `npm run format:check` in
`client/`. Look at visual changes in the browser, using `/design` for shared components.
