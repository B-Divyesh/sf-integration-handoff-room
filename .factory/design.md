# Integration Handoff Room — visual thesis

## Direction: orbital protocol atlas

An API handoff is a navigation problem: agency and client need to agree which payload, decision, and owner is the current reference point. The product looks like a precise, slightly surreal **orbital protocol atlas**—a dark observatory chart where release artifacts orbit one clear acceptance point. It is not a generic SaaS dashboard, a glowing gradient, or a space-game theme. The orbit diagram explains relationships; the reading and acknowledgement surfaces remain quiet, high-contrast documents.

The primary experience is night-chart dark mode, with an equally deliberate light “day chart” setting for users who need it. A room uses a fixed coordinate grid: fixture is the central body, decisions/questions are satellites, and an acknowledgement becomes a thin completed orbit. The graphic only appears when it helps identify the current selected object; it never sits behind readable text.

## Stack decision

Use Vite 7 with strict TypeScript, native browser components, and CSS custom-property tokens. This product needs fast document and form interactions, not a component-library ecosystem or large framework runtime. Rust/Axum and PostgreSQL provide the secure shared backend in later milestones. This keeps public/demo JavaScript comfortably below the 150 KB gzip target and lets the visual system remain explicit in CSS.

## Tokens

The source of truth is [`src/styles/tokens.css`](../src/styles/tokens.css). Values below are duplicated here for design review; implementation must use token names rather than hard-coded values.

| Token | Night chart | Day chart | Use |
| --- | --- | --- | --- |
| `--color-canvas` | `#07131F` | `#F4F0E6` | Page field |
| `--color-surface` | `#102333` | `#FFFDF7` | Reading planes and dialogs |
| `--color-surface-raised` | `#173348` | `#E6EDF0` | Selected/raised planes |
| `--color-ink` | `#F7F4E9` | `#122A3A` | Primary text |
| `--color-muted` | `#BED0D5` | `#4D6572` | Secondary text; never below 4.5:1 for body copy |
| `--color-line` | `#416174` | `#AABCC4` | Dividers and inactive orbital paths |
| `--color-signal` | `#F3B52A` | `#704500` | Primary action and current orbit |
| `--color-signal-ink` | `#07131F` | `#FFFDF7` | Text on the signal color |
| `--color-aqua` | `#63D9D2` | `#006D73` | Fixture/reference marker |
| `--color-success` | `#9BD683` | `#145C2D` | Complete state, paired with icon/text |
| `--color-warning` | `#F0BA54` | `#935D00` | Needs attention, paired with icon/text |
| `--color-danger` | `#FF9A86` | `#B43D37` | Error/destructive state, paired with icon/text |

Night `ink` on `canvas` and `surface`, day `ink` on `canvas` and `surface`, and the stated action color pairs must be checked at implementation at 4.5:1 minimum. The signal color is never used for small text without its signal-ink pairing. Status is always conveyed with a label and shape/icon in addition to color.

### Type, spacing, shape, and elevation

- **Display:** Space Grotesk, self-hosted WOFF2, 500–700. Its engineered letterforms give headings the measured, technical atlas character.
- **Text and code:** Atkinson Hyperlegible Next, self-hosted WOFF2, 400–700, with the native `ui-monospace` stack for payloads. It favors dense API values and clear character distinction.
- **Fallbacks:** `ui-sans-serif, system-ui, sans-serif` and `ui-monospace, SFMono-Regular, Consolas, monospace`. M1 may use fallbacks until reviewed font files are committed; it must not fetch fonts from a CDN.
- **Scale:** 12 / 14 / 16 / 20 / 25 / 32 / 40 / 52 px, using `clamp()` only for display sizes. Body is at least 16px with 1.55 line-height; payload text is 14px at 1.5 with horizontal scroll and copy controls.
- **Spacing:** 4px base; `4, 8, 12, 16, 24, 32, 48, 64, 96`. Page gutters are 24px desktop and 16px at 390px. Readable narrative measure is 68ch maximum.
- **Shape:** square-ish 6px instrument corners; 999px only for small status capsules. Use one-pixel map lines and offset corner marks, not soft card stacks. Dialogs use 12px corners only to make their temporary layer obvious.
- **Depth:** two surface levels and hairline paths; no drop-shadow fog. Selected fixture gets an aqua left rule and coordinate mark. The acknowledgement action has a signal orbit stroke, not a glowing button.

## Original visual assets and provenance

M1 uses a hand-authored SVG/CSS orbital atlas: circles, coordinate ticks, payload nodes, and simple line icons created in this repository by Param Factory. It has no external asset, trademark, or generated-image dependency. The future social image is composed from the same original SVG geometry at 1200×630. If an atmospheric illustration is later added, it must be generated through the factory image pipeline, reviewed for artifacts, saved as responsive AVIF/WebP under the image budget, disclosed in the footer/about copy, and recorded here with prompt, model, date, and license. No image contains readable product copy.

## Interaction grammar and motion

- Selecting a fixture moves the current coordinate marker to that fixture; linked decisions get a brief 180ms opacity emphasis. Selecting a decision traces only its associated orbit once (220ms transform/opacity), then stops.
- Publishing an acknowledgement closes an otherwise broken orbit with a 240ms stroke draw and immediately replaces it with a static completed ring; it also announces the receipt in text.
- Page transitions use a 160ms opacity/4px vertical settle from the initiating control. Dialogs originate from their trigger and return to it on close.
- No looped animation, parallax, star field, auto-scroll, or flashing. `prefers-reduced-motion: reduce` disables path/position animation and uses immediate state plus opacity; the atlas stays fully informative as a still diagram.

## Component system

The implementation inventory with component states and accessibility contracts is in [.factory/components.md](components.md). It contains 19 semantic building blocks, not a third-party UI kit. Buttons are verbs, links visibly look like links, and each interactive target is at least 44×44px.

## Five key screens

1. **Landing (`/`):** A left-aligned plain-language job headline and two actions sit beside a sparse orbital release map, not a centered marketing hero. Under it, three factual lines lead into a live-looking but clearly non-interactive room preview, a three-step explanation, privacy boundary, Studio price, and footer. The map is decorative with a concise alternative; the content plate is always solid.
2. **Demo room (`/demo`):** A persistent slim demo banner precedes a room header. Desktop uses a 3-column atlas: room/revision rail, central selected fixture/payload document, and a decision/checklist panel. On mobile the current fixture comes first, then checklist, decisions, and compact navigation; the atlas becomes a 48px relationship strip with text labels.
3. **Prepare room (`/rooms/new`):** A staged import ledger, not a wizard carousel: repository/release, fixture selection, redaction report, checklist, then publish. Each stage shows a coordinate and can be revisited. A blocking redaction finding is an error plane with exact next action.
4. **Client review (`/review/:token`):** The least amount of chrome. It opens on the selected fixture and plain completion status; decisions, questions, and acknowledgement are in a linear reading order. The acknowledgement plane repeats the revision identifier and plain legal limitation immediately beside the action.
5. **Settings and billing (`/settings/*`):** A quiet tabular instrument panel with clear agency boundary, subscription status, connected repositories, export/delete controls, and no orbit decoration except a small coordinate emblem in the page title.

`/privacy`, `/terms`, and `/404` inherit the field, typography, header/footer, and quiet map-line treatment. The 404 page says the coordinate is unknown and has a visible route back home—no joke or animation.

## State design

- **Empty:** A room with no fixture says what will appear and offers “Add a sanitized fixture”; an agency with no room offers “Create a room”. Never use abstract empty illustrations without a next action.
- **Loading:** Reserve the document shape with line skeletons and an `aria-busy` region; never make the atlas spin forever.
- **Error:** Explain what failed, whether the saved room changed, and one next action. Redaction and access errors state the safe boundary without exposing secret-like data.
- **Offline:** Demo remains usable from its cached sample. Real rooms show the last read state, an explicit offline status, and disable writes with an explanation; no silent queueing until M4 deliberately supports it.
- **Success:** Receipts include a human-readable timestamp, revision ID, actor name, and next action. Toasts supplement—never replace—persistent state.

## Responsive and accessibility rules

Design at 390px first, then 768px and 1280px. Mobile collapses the three-column room into an intentional reading sequence and makes the selected fixture persistent; it never hides decisions or makes a user horizontal-scroll the entire app. Desktop uses 12 columns, with payload text allowed to scroll only inside its own labelled code region. Respect safe-area insets. No fixed bar may obscure content or focus.

Every page has one `<h1>`, `header/nav/main/footer`, a skip link, visible high-contrast focus, logical headings, labels bound to inputs, error/live regions, and plain text equivalents for the map. Dialogs trap focus, restore it, and expose name/role/state. Hover is never the only way to reveal an action. At 200% zoom, the room becomes the mobile reading order rather than clipping. Meaningful illustrations have alt text; orbit decoration is `aria-hidden`.

## Route metadata and content rules

Each route gets a distinct title: `Integration Handoff Room — client API handoffs`, `Demo — Integration Handoff Room`, `Privacy — Integration Handoff Room`, `Terms — Integration Handoff Room`, and equivalent room/review titles without exposing private data in shared title text. All pages include a concise description, canonical URL, product-derived Open Graph/Twitter image, theme color, favicon, `lang="en"`, and an address-bar route that restores focus to the new h1. The navigation is wordmark/home, Demo, How it works (landing anchor), Pricing, and Privacy; the footer includes Privacy, Terms, Built by Param Factory, and build version.
