# Dashboard UI/UX Guide

A short style reference based on a modern minimal SaaS dashboard (timesheet app shot). Colors and content are intentionally left out; this covers structure, type, shape and behavior.

---

## 1. Style category

**Modern minimal SaaS / "Linear-style" / "shadcn-style" UI.**

- Hairline borders instead of heavy shadows
- Neutral surfaces and lots of whitespace
- Small, refined typography with tight tracking
- Soft, nested corner radii
- Compact "pro tool" density

**Suggested stack:** Next.js + Tailwind CSS + shadcn/ui (Radix primitives). The framework itself doesn't affect the look; Tailwind + shadcn/ui is what gets you there fastest.

---

## 2. Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│ Logo  [≡]    │  [Timer bar: project ▾ | 02:30:42 | ▶]  ? 🔔 ◯ │
│              │                                              │
│ GROUP LABEL  │  Page Title            [Filter ▾][Date ▾][<][>]│
│  • Item      │                              [Cancel][Save]  │
│  • Item (12) │  ┌── Day card ──────────────────────────┐    │
│              │  │ Date · total time                    │    │
│ GROUP LABEL  │  │ Timeline 06:00 ──────────── 22:00    │    │
│  • Item      │  │ ┌ Table ───────────────────────────┐ │    │
│              │  │ │ ☐ Task | Project | Tag | Time | ⋯│ │    │
│ [Workspace ⇅]│  │ └──────────────────────────────────┘ │    │
└──────────────┴──┴──────────────────────────────────────┴────┘
```

- **Sidebar (~240px):** collapsible, toggle next to the logo, nav grouped under small muted labels, count badges, workspace switcher pinned to the bottom. This is close to the shadcn/ui Sidebar block with its team switcher.
- **Top bar:** a persistent timer widget on the left and utility icons plus the avatar on the right.
- **Page header:** title on the left, filters and pagination on the right, page-level actions (Cancel/Save) below.
- **Content:** a vertical stack of cards, one per day.

---

## 3. Typography

**Font:** a neo-grotesque sans with tight tracking. Inter / Inter Display or SF Pro are the closest matches; Geist, Satoshi and General Sans give a similar feel.

| Role | Size | Weight | Tracking | Tailwind |
|---|---|---|---|---|
| Page title | 28–32px | 600 | -0.02 to -0.03em | `text-3xl font-semibold tracking-tight` |
| Card title | 16–18px | 600 | -0.01em | `text-lg font-semibold tracking-tight` |
| Body / table rows | 13–14px | 500 | normal | `text-sm font-medium` |
| Labels / headers / axis | 12px | 400 | normal | `text-xs text-muted-foreground` |
| Group labels (sidebar) | 12px | 400–500 | normal | `text-xs text-muted-foreground` |

**Details that make it look good:**

- **Split-weight numbers:** large dark numbers with small muted units, e.g. **8**h **24**min.
  ```html
  <span class="text-lg font-semibold">8</span><span class="text-xs text-muted-foreground">h</span>
  ```
- **Tabular numerals** on all times and timers so the digits don't jump: `tabular-nums`.
- Hierarchy comes from **weight and muted opacity**, not big size jumps.

---

## 4. Corner radii

Use **nested radii**: inner radius ≈ outer radius − padding. Bigger containers get bigger curves, and each inner layer steps down.

| Element | Radius | Tailwind |
|---|---|---|
| App shell | 20–24px | `rounded-3xl` |
| Cards | 16px | `rounded-2xl` |
| Inner table / panels | 12px | `rounded-xl` |
| Active nav item, top timer bar | 10–12px | `rounded-xl` |
| Buttons, selects, inputs | 6–8px | `rounded-md` / `rounded-lg` |
| Chips / tags | 6px (not full pills) | `rounded-md` |
| Progress/timeline bars, avatars | full | `rounded-full` |

shadcn base: `--radius: 0.5rem;`, then scale up for the larger containers.

---

## 5. Surfaces, borders and spacing

- **1px subtle borders** for cards, table rows and inputs. Shadows are minimal or absent.
- **Compact controls:** buttons and selects are about 28–32px tall (`h-8`) with `text-xs`/`text-sm`.
- **Generous outer spacing, tight inner spacing:** cards use roughly `p-5`/`p-6`, rows roughly `py-3`, and gaps between cards roughly `gap-6`.
- **Chips:** small (`px-2 py-0.5 text-xs`) with a soft tinted background and a matching border.

---

## 6. Icons

- Small (16px) **filled/solid** icons in the sidebar. Phosphor (fill) or Iconsax Bold match closely; Lucide works if you prefer outline icons.
- Keep stroke weight and size consistent across the whole UI.

---

## 7. Components

- **Sidebar nav item:** icon + label, `rounded-xl` highlighted background when active, optional count badge on the right.
- **Workspace switcher:** logo tile + two-line text (label/name) + up/down chevron, pinned to the bottom.
- **Timer bar:** project dropdown, monospaced/tabular elapsed time in a small bordered box, compact square play button.
- **Filter dropdowns:** bordered, `rounded-lg`, small text + chevron.
- **Pagination arrows:** square icon buttons, bordered.
- **Day card:** header (date + total), timeline, table, and an "Edit" button at the bottom right.
- **Timeline:** a light track with `rounded-full` bars positioned by time and an hour axis in muted `text-xs`.
- **Table:** checkbox column, task, project chip, tag chip, duration, and a "⋯" menu for row actions.

---

## 8. UX patterns

- **Dual representation:** a visual timeline for the quick overview plus a table for exact values.
- **Visible edit state:** in edit mode, timeline blocks switch to a **hatched/striped fill with drag handles** on each side (draggable and resizable). Read mode uses solid bars.
- **Persistent global action:** the timer is always available in the top bar.
- **Scoped editing:** each card has its own "Edit" button, while the page has global Cancel/Save.
- **Progressive disclosure:** secondary row actions live behind the "⋯" menu.
- **Clear header pattern:** title on the left, filters and navigation on the right.

---

## 9. Pitfalls to avoid

- Don't place the table header inline with the checkbox rows; keep it a distinct, clearly separated row.
- Add **labels or tooltips to timeline bars** so they aren't anonymous.
- Watch **contrast and size** on muted 12px text; it can become hard to read.
- Keep radii consistent. Mixing pills and square chips breaks the calm look.

---

## 10. Quick-start tokens

```css
:root {
  --radius: 0.5rem;
  font-family: "Inter", "Geist", system-ui, sans-serif;
  font-feature-settings: "cv11", "ss01";
}

h1, h2, h3 { letter-spacing: -0.02em; }
.time { font-variant-numeric: tabular-nums; }
```

```bash
npx create-next-app@latest
npx shadcn@latest init
npx shadcn@latest add sidebar button select badge table checkbox dropdown-menu
```
