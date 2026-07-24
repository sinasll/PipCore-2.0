# PipCore 2.0 — Trade Journal · Telegram Mini App

A complete rebuild of the PipCore trading journal as a single-page, tab-driven
Telegram Mini App. Brand identity is locked: **black `#000000` + gold `#E6B33C`**
(both theme directions) and the **Press Start 2P** typeface everywhere.

## Deploy (drop-in replacement)

Push the contents of this folder to your hosting root (e.g. the GitHub Pages
repo that serves `https://sinasll.github.io/PipCore/`). Entry point is
`index.html`. No build step, no backend needed.

Old pages (`dashboard.html`, `journal.html`, `calendar.html`, `profile.html`,
`about.html`, `style.css`, etc.) can be deleted — everything is unified now.

## Your data is safe

v2 reads the exact same `localStorage` keys as v1 (`tradeEntries`, `setups`,
`entries`, `timeframes`, `pairs`, `theme`) and migrates them in place
(adds ids, normalizes outcomes). Nothing is lost.

## What's inside

| Tab | What it does |
|---|---|
| Home | Telegram profile (@username → name fallback → guest), live snapshot, TON wallet connect, invite/share (proper `t.me/share/url` deep link via `openTelegramLink`), 6 community tasks |
| Stats | Full analytics: win-rate ring, net pips, profit factor, expectancy, payoff, clean win rate (BE-excluded), max drawdown, recovery factor, consistency, Kelly criterion, std-dev, Sharpe, streaks, best/worst trade & best day, rhythm, equity curve chart, and 8 breakdown lenses (session / pair / setup / entry / timeframe / side / weekday / monthly) with period filter |
| Journal | Fast logger (segmented controls, pips stepper), search + 5 filters, trade sheets with edit / duplicate / share / delete, export CSV · TXT · JSON · PDF |
| Calendar | Real month grid; every day box shows net pips + trade count + day win-rate. Profit/loss styling, today ring, swipe to change month, month/year picker, day detail sheet, month summary, equity pace chart |
| Settings | Theme (Night/Gold), week start (Mon/Sun), haptics switch, full option manager for setups/entries/timeframes/pairs/sessions (add, rename, reorder, delete with usage counts), backup/restore JSON with merge-or-replace, danger zone, about & socials |

## Telegram correctness (v2 fixes)

- `ready()` + `expand()` on boot; header & background colors hard-locked to the
  app's own palette (`setHeaderColor` / `setBackgroundColor`).
- `disableVerticalSwipes()` (7.4+) prevents accidental minimize while scrolling.
- `enableClosingConfirmation()` when supported.
- t.me links routed through `openTelegramLink()`; externals through `openLink()`.
- HapticFeedback with version guards + a user-facing switch (Settings).
- BackButton drives sheets/dialogs (day detail, trade editor, pickers).
- Username resolution: `@username` → full name → guest (never a broken `@`).
- Telegram Analytics + Firebase presence kept from v1 (hardened, non-blocking).
- TON Connect UI wired with the corrected manifest (valid `iconUrl`).

## Tests (optional, needs Node)

```
node tests/logic.test.js   # data layer + statistics math (51 checks)
node tests/dom.test.js     # full boot smoke test (needs jsdom)
```

## Files

```
index.html                  app shell (views, tabbar, SDKs)
css/app.css                 design system
js/icons.js                 inline SVG icon set (no emojis)
js/store.js                 localStorage layer + migration + backup/restore
js/stats.js                 statistics engine (pure functions)
js/charts.js                canvas equity chart
js/telegram.js              WebApp SDK integration
js/ui.js                    toasts, sheets, dialogs, controls
js/views/*.js               Home / Stats / Journal / Calendar / Settings
js/app.js                   boot + theme + router
assets/                     brand logos
tonconnect-manifest.json    TON Connect manifest (iconUrl fixed)
```

© 2026 PipCore. Black / gold — nothing else.
