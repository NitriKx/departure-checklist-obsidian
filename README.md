# Departure checklist (Obsidian plugin)

Answers a few questions about your trip and generates a tailored checklist
note before you leave home — for work trips, vacations, or a few days away.

## Usage

1. Run **Generate departure checklist** from the command palette, or select the
   ribbon icon (list with checkmarks).
2. Answer the questions one at a time. Branching questions you answer with
   "No" (pets, children) are skipped or remove sections automatically.
3. Review the summary of sections that will be included, then select
   **Generate checklist**.
4. A new dated note (for example `Checklists/2026-09-27 departure checklist.md`)
   opens with checkbox items grouped by section.

By default the questionnaire covers the trip type, departure and return
dates, transport, children, pets, and destination weather. Based on your
answers, sections are added or removed: work items, vacation items, pet
care, children, car/plane/train specifics, long-absence admin, and home
security.

## Dates, duration, and computed items

The wizard asks for your departure and return dates. From them it derives
a `days` value (computed values are edited in settings). Checklist items
can use it in braces to compute quantities, for example the built-in
clothing section generates:

- `Pack at least {days} pairs of underwear and socks`
- `Pack at least {ceil(days / 2)} t-shirts or shirts`
- `Medication for {days} days`

Expressions support `+ - * /`, parentheses, and the functions `ceil`,
`floor`, `round`, `abs`, `min`, `max`. Date answers count in days from
today, number answers are used as-is, and computed values can build on
each other. If a value cannot be computed (for instance you skip the
dates), the placeholder renders as `?`. Put spaces around `-` and `+` so
they are treated as operators rather than part of a name.

Sections and items can also be limited by number with a "greater than"
condition — the built-in "Before a long absence" section appears only
when the trip is longer than 7 days.

## Settings

- **Checklist folder** — where generated notes are created (default `Checklists`).
- **Remember answers** — pre-fill the questionnaire with your last answers.
- **Questions and answers** — edit, add, or delete the questions asked by
  the wizard. Each question has a label, a type (yes/no, choice list,
  date, or number), editable answers, an optional default, and an optional
  condition that shows it only after a given answer.
- **Computed values** — named numbers derived from your answers
  (default: `days = return - departure`), usable in item text and in
  "greater than" conditions.
- **Checklist sections** — edit, add, or delete the checklist sections.
  Each section has a title, an optional include condition, and a list of
  items; every item can also carry its own condition and contain
  `{expression}` placeholders for computed quantities.
- **Restore built-in content** — discard your customizations.

Customizations are stored with the plugin data
(`.obsidian/plugins/departure-checklist/data.json`), not in your notes.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # typecheck + production build
npm test         # unit tests
npm run lint
```

Install for testing by copying `main.js`, `manifest.json`, and `styles.css`
to `<vault>/.obsidian/plugins/departure-checklist/` — use a dedicated
development vault, not your main vault.

## Releasing

Bump the version with `npm version <major.minor.patch>` (this syncs
`manifest.json` and `versions.json`), then create a GitHub release whose tag
matches the version exactly (no leading `v`), attaching `main.js`,
`manifest.json`, and `styles.css`.
