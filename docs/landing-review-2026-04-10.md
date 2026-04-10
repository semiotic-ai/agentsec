# AgentSec Landing Page Review — 2026-04-10

## Context

Post-#6..#18 merge review of the AgentSec landing page at `apps/landing/`
(Next.js 15 + Tailwind 3). The page composes five components in order:
`Header`, `Hero`, `HowItWorks`, `CLIUsage`, `CTA`. The Hero and CTA both
delegate their primary action to a shared `CopyCommandButton` component
(extracted in `refactor(landing): extract CopyCommandButton component`,
commit `a833810`). The dev server was run at `http://localhost:3000` and
the page was inspected through the Chrome DevTools Protocol. Full-page
screenshots were captured at **375×812 (iPhone X)**, **768×1024 (iPad)**,
and **1280×800 (laptop)**, plus focused shots of the hero viewport, the
keyboard-focused primary CTA, the header nav focus state, the HowItWorks
section, the CLIUsage section, and the CTA section. The review invokes
`design:design-critique` and `design:accessibility-review`.

All text-on-background color pairs used by the page PASS WCAG 2.1 AA for
normal text (the lowest measured ratio is `#8b949e` on `#0d1117` = **6.15:1**).
The issues below are structural, semantic, or responsive — not contrast.

## Critical (P0) — Must fix before launch

### 1. The entire hero is invisible in SSR output (A11y / SEO / no-JS)
`apps/landing/components/Hero.tsx:22-25` renders the hero's inner `<div>` with
`opacity-0` as the initial SSR class, then flips to `opacity-100` in a client
`useEffect`. Verified by fetching `/` directly against the rebased code — the
string `opacity-0` is present once in the server response, on the hero root
div. Consequence:

- Users with JavaScript disabled see a blank hero (headline, subtitle, CTA,
  secondary links, stats all invisible).
- Search engine crawlers that don't fully render JS may index a nearly empty
  hero.
- First Contentful Paint is visually delayed until hydration.
- Screen readers may announce the page before the content becomes visible,
  depending on timing.

This is not a motion-preference issue — `opacity-0` is not a `prefers-reduced-motion`
optimization; it's an unconditional fade-in. The fix is to render visible on
the server and only apply a brief fade as an enhancement (or remove the fade
entirely).

### 2. Header has no mobile navigation at all
`apps/landing/components/Header.tsx:32` sets the nav links container to
`hidden md:flex` with no hamburger/menu button. On the mobile 375×812 viewport,
CDP confirms that `header a, header button` returns **zero visible elements**
after hydration — mobile users cannot reach `#how-it-works`, `#cli`, or
`GitHub` from the header. The only in-page navigation on mobile is scrolling.
Fails **WCAG 2.4.5 Multiple Ways** (advisory at AA for this kind of anchor nav,
but the brand/GitHub link is a real destination users lose). Also a usability
issue more than a pure WCAG failure — a disclosure button with the same three
links would unblock this.

### 3. HowItWorks card boundaries fail WCAG 1.4.11 (non-text contrast)
The three "Scan / Report / Enforce" cards in
`apps/landing/components/HowItWorks.tsx:45` rely on a single
`border-brand-border` (`#30363d`) to differentiate card surface from page
surface. Measured contrasts:
- card bg `#161b22` vs page bg `#0d1117` = **1.09:1**
- border `#30363d` vs page bg `#0d1117` = **1.55:1**

Both are below the 3:1 threshold required by WCAG 1.4.11 for essential UI
boundaries. Low-vision users see the three cards as a single block of text.
The same border-only treatment is used by the HowItWorks bottom callout
(`HowItWorks.tsx:66`), the CLIUsage terminal container
(`CLIUsage.tsx:49`), the three flag cards (`CLIUsage.tsx:60`), and the Hero
decorative terminal (`Hero.tsx:67`), so the finding applies repeatedly
across the page.

## Important (P1) — Should fix soon

### 4. `prefers-reduced-motion` is not honored
CDP was re-navigated with `Emulation.setEmulatedMedia prefers-reduced-motion=reduce`
and `document.getAnimations().length` remained at **4**. The four animations
are the two hero gradient orbs and the two CTA-section gradient orbs (each
uses Tailwind's `animate-pulse`, a 2s infinite iteration — verified in the
inspection JSON). `apps/landing/components/Hero.tsx:19-20` and
`apps/landing/components/CTA.tsx:9-10` emit `animate-pulse` unconditionally.
No `@media (prefers-reduced-motion: reduce)` rule exists in
`apps/landing/app/globals.css` or the Tailwind config. The Hero's
`transition-all duration-1000` opacity fade (`Hero.tsx:24`) and all
`.card-hover`, `.btn-primary`, and `.scroll-animate` transitions in
`globals.css` are likewise unconditional. Fails **WCAG 2.3.3 Animation from
Interactions (AAA)** and best-practice guidance for 2.2.2.

### 5. All link focus styles fall back to the browser default
Keyboard-tabbing with CDP through the rebased code confirms both
`CopyCommandButton` instances (Hero + CTA) render the brand teal
`focus:ring-2 focus:ring-brand-teal focus:ring-offset-2` ring as expected
(`CopyCommandButton.tsx:56`). However, every link on the page — the three
header links (`Header.tsx:33-50`), the two Hero secondary links
(`Hero.tsx:46-62`), and the three CTA section links (`CTA.tsx:25-46`) —
falls through to the browser default `outline: rgb(0,95,204) auto 1px`.
On the `#0d1117` background this is visible but inconsistent with the
brand and visually thin (1px auto). A global link focus style with the
same teal ring as the button would make the tab path legible as a single
consistent affordance.

### 6. No `<main>` landmark, no skip link, no `<footer>`
CDP `querySelectorAll('main').length === 0` and `querySelectorAll('footer').length === 0`.
`apps/landing/app/page.tsx:7-17` renders the five sections as siblings of
`<Header>` with no `<main>` wrapper. Screen reader users cannot "jump to
main content" via landmark navigation (fails **WCAG 1.3.1 Info and
Relationships** for landmark structure). There is also no skip-to-content
link and no `<footer>` element — the page ends at the CTA section with no
copyright, legal, or repository metadata, which is unusual for a product
landing page and removes a structural landmark screen readers expect.

### 7. Mobile touch targets below 44×44 on secondary/CTA links
At 375×812, CDP measures:
- `Hero` "View on GitHub →" link: **116×20** (`Hero.tsx:46-53`)
- `Hero` "OWASP AST10 →" link: **112×20** (`Hero.tsx:55-62`)
- `CTA` "GitHub" link: **335×20** (`CTA.tsx:25-32`)
- `CTA` "OWASP AST10 Report" link: **335×20** (`CTA.tsx:33-40`)
- `CTA` "Contact" link: **335×20** (`CTA.tsx:41-46`)

All are 20px tall — below the WCAG 2.5.5 recommendation of 44×44 CSS pixels.
The CTA links are full-width inside their flex container, so the visual
target is wide, but the vertical hit area is still 20px. Add vertical
padding (e.g. `py-3`) or switch to the Tailwind `min-h-[44px] inline-flex
items-center` pattern.

### 8. Header nav label / section heading mismatch ("CLI" vs "CLI Examples")
`Header.tsx:39` links to `#cli` with the visible text "CLI", but the section
heading at `CLIUsage.tsx:42` is "CLI Examples". Minor but a user who tabs the
nav then looks for "CLI" as a heading in the page will miss it. Either rename
the nav link to "CLI Examples" or rename the heading to "CLI" — they should
match per WCAG 2.4.6 Headings and Labels and 2.5.3 Label in Name (the
accessible name should contain the visible label).

### 9. `aria-live="polite"` is placed on the copy-state span inside the
### button label
`CopyCommandButton.tsx:62-67` places `aria-live="polite"` directly on the
`<span>` that contains the visible "Copy" / "Copied!" text (this pattern is
now shared by both the Hero and CTA copy buttons via the refactored
component). Consequences:
- The initial page load may announce "Copy" as part of the button name
  because the live region already has content.
- When the 2-second `setTimeout` reverts "Copied!" back to "Copy", that
  second mutation is also announced, producing a redundant "Copy" chirp
  after the user-initiated "Copied!".
- Screen readers may concatenate the aria-live text with the button's name,
  producing a jittery accessible-name composition.

Recommended pattern: keep the visible "Copy" pill as a normal child of the
button, and add a separate visually-hidden `<span role="status" aria-live="polite">`
that is empty on mount and populated with "Copied to clipboard" only when
the copy succeeds.

### 10. Mobile H1 wraps to four lines with a forced `<br />`
`Hero.tsx:27-31` uses `text-5xl md:text-7xl` and injects a forced `<br />`
between "skill" and "your". At 375px the first line "Audit every skill" is
still too wide for the 48px font, so it wraps to "Audit every" / "skill" and
then the forced break plus further wrapping produces **four** lines total:
`Audit every` / `skill` / `your AI agents` / `run.`. The lone word "skill"
and the lone word "run." look like orphans. At 768px the line breaks work,
and at 1280px they are ideal. The fix is to size the headline down further
on sm screens (`text-4xl sm:text-5xl md:text-7xl`) and/or drop the forced
`<br />` and let the headline flow naturally at the smaller size.

## Nice-to-have (P2) — Polish

### 11. Primary copy CTA vs. decorative terminal competes for attention
In the hero, the primary copy-to-clipboard button
(`Hero.tsx:39-42`, rendered by `CopyCommandButton` size `lg`) is **above**
the decorative terminal demo (`Hero.tsx:65-101`). On desktop the button is
visually smaller than the decorative terminal below it, and the terminal
uses more vivid colors (CRITICAL red, HIGH yellow, green PASS), so the eye
is drawn to the terminal as the focal element of the section, not to the
CTA. Options: make the CTA bigger (larger font + more padding + a persistent
glow, not only a hover glow), or reverse the order so the CTA sits directly
beneath the headline and the decorative terminal acts as an ambient backdrop.

### 12. Hero subtitle is long
`Hero.tsx:34-37`: "One command scans every skill your agent has installed.
Security vulnerabilities, supply chain risks, and policy violations —
automatically." 24 words / 172 characters at `text-xl md:text-2xl` reads
heavier than the headline above it on desktop. Consider tightening to one
sentence (≤14 words).

### 13. HowItWorks bottom "No config. No SaaS. Runs in your repo." callout
`HowItWorks.tsx:66-71` wraps a one-line callout in its own bordered card —
the same visual treatment as the three step cards above it. It reads as a
fourth step at a glance. If you want the message, lose the border/card
chrome and render it as a plain centered paragraph under the grid; if you
don't want a fourth visual row, delete it — the message is already made by
the three-step simplicity.

### 14. CLIUsage flag cards repeat information already in the terminal above
`CLIUsage.tsx:6-19` defines three flag callouts (`--verbose`,
`--format json`, `--fail-on high`). The terminal block directly above
(`CLIUsage.tsx:21-35`) already shows `npx agentsec --verbose` in action.
Keeping all three is fine if you want a reference, but the `--verbose`
card is largely redundant with the output shown above. Either rotate which
flag the terminal demonstrates (e.g. show `--format json` output) so the
cards expand the demo, or drop the `--verbose` card.

### 15. "Ready?" is too terse
`CTA.tsx:13`: a one-word `h2` with a trailing question mark. After the
length and detail of the preceding sections, "Ready?" reads as a filler
prompt more than a call to action. Consider "Scan your first agent"
or "Audit your skills in one command" — something that tells the user
what clicking the CTA actually does.

### 16. Hero and CTA copy buttons are now visually identical (duplication)
Since commit `a833810` extracted `CopyCommandButton`, both Hero and CTA
render the same button with the same `border-2 border-brand-teal` treatment
— only the size differs (`size="lg"` vs `size="md"`, see
`Hero.tsx:41` and `CTA.tsx:20`). Functionally this is consistent, but it
means a user scrolling from the hero reaches an identical CTA at the
bottom of the page, which reads as a duplicate rather than a distinct
"bottom of page" affordance. Consider giving the CTA section a different
action verb ("Install", "Scan my first agent") or a visually distinct
treatment (full-width bar, different surface) so it doesn't feel like
the same button twice.

### 17. Inconsistent link colors between Hero and CTA sections
Hero secondary links (`Hero.tsx:50,59`) use `text-brand-muted
hover:text-brand-teal` (gray → teal). CTA section links (`CTA.tsx:29,37,43`)
use `text-brand-blue hover:text-brand-teal` (blue → teal). The two link
styles appear within the same scroll session for the same purpose
("GitHub", "OWASP AST10"). Pick one token for external secondary links
and apply it in both places.

### 18. Stats row in hero (`10 / 119 / 4`) needs more context
`Hero.tsx:104-117`: three large teal numbers with short labels. "10 OWASP
Risk Categories" is clear, "119 Vulnerability Patterns" is clear,
"4 Output Formats" is weaker — the user doesn't yet know what "output
formats" means. Either clarify the label ("4 Report Formats") or promote
a more meaningful third stat.

### 19. `html` element has `scroll-behavior: smooth` globally
`apps/landing/app/globals.css:12`. This is fine for the anchor nav links but
interacts poorly with `prefers-reduced-motion`. Wrap in a media query so
users who opted out of motion get instant scroll.

### 20. Hero `<h1>` concatenates to "Audit every skillyour AI agents run."
When an assistive tech reads the h1 as a single string (e.g., a screen
reader's rotor), the `<br />` is not a space so the announced text is
"Audit every skillyour AI agents run." (observed in the CDP `headings`
dump at `/tmp/landing-report.json`). The markup is at `Hero.tsx:27-31`;
add a trailing space before the `<br />` or replace the `<br />` with
sibling block elements.

## Passing notes

Color contrast is solid across the board — every text pair measured (hero
subtitle, nav, body muted, brand teal accents, terminal demo colors, CTA
button label) passes WCAG AA for normal text, most comfortably above 6:1. The
heading outline (`h1` → 3×`h2` → 3×`h3`) is logical and complete — no skipped
levels. The primary Hero copy button has a proper `aria-label`, a visible
focus ring with ring-offset, and a sensible hover treatment. The ordered
keyboard focus path through the page matches the visual reading order in all
three viewports tested. There are no `<img>` elements missing alt attributes
because there are **no** `<img>` elements — the page uses emoji and
text-rendered terminal blocks only. The terminal `<pre>` in CLIUsage uses a
monospaced font and `whitespace-pre overflow-x-auto` which keeps the ASCII
columns aligned at narrow viewports without collapsing.

## Methodology

Skills invoked: `design:design-critique` and `design:accessibility-review`.

Viewport sizes tested: 375×812 (mobile), 768×1024 (tablet), 1280×800
(desktop), plus a 375×812 above-the-fold hero capture and a 1280×800 focused
hero viewport capture.

Tools used:
- `bun run dev` (Next.js 15.5.14 dev server) at `http://localhost:3000`
- Headless Chrome 147.0.7727.56 driven over the Chrome DevTools Protocol
  via a small Node CDP client (`Runtime.evaluate`, `Emulation.setDeviceMetricsOverride`,
  `Emulation.setEmulatedMedia prefers-reduced-motion=reduce`,
  `Page.captureScreenshot captureBeyondViewport=true`,
  `Input.dispatchKeyEvent` for keyboard-tabbing through focusable elements)
- WCAG contrast math computed locally against every `--brand-*` color pair
  against every background token used on the page
- SSR output inspected by fetching `/` directly and grepping for
  `opacity-0` and other pre-hydration state

Screenshot paths (ephemeral, not checked into the repo):
- `/tmp/landing-shots/mobile-375.png` — 750×8618 (dpr=2) full page
- `/tmp/landing-shots/tablet-768.png` — 1536×6126 (dpr=2) full page
- `/tmp/landing-shots/desktop-1280.png` — 1280×3091 full page
- `/tmp/landing-shots/mobile-hero-viewport.png` — mobile above-the-fold
- `/tmp/landing-shots/desktop-hero-viewport.png` — desktop above-the-fold
- `/tmp/landing-shots/desktop-hero-button-focused.png` — keyboard focus on
  primary CTA
- `/tmp/landing-shots/desktop-nav-focused.png` — keyboard focus on first
  header nav link
- `/tmp/landing-shots/desktop-howitworks.png` — HowItWorks section
- `/tmp/landing-shots/desktop-cli.png` — CLIUsage section
- `/tmp/landing-shots/desktop-cta.png` — CTA section
- Inspection JSON: `/tmp/landing-report.json`
