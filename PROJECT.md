# MSA Stay — Project guide & roadmap

Single source of truth for brand, stack, content, and what comes next.
Update this file when decisions change.

---

## Company

| Field | Value |
|--------|--------|
| Name | **MSA Stay** |
| Tagline | Book a home rather than a hotel room |
| Focus | Business / B2B accommodations (not hotel nights) |
| Model | BnB-style homes for companies (teams, contractors, longer stays) |

### Cities — live

- Geel
- Moerbeke
- Knokke

### Cities / capacity — upcoming

- Moerbeke **+7**
- Balen (**new**)
- Geel **+5**

---

## Brand design system

### Fonts

| Role | Font | Usage |
|------|------|--------|
| Body / UI / forms / nav | **Inter** | Paragraphs, buttons, labels, navigation |
| Headings / logo wordmark | **Hind** | `h1`–`h3`, brand name |

Loaded via Google Fonts in `index.html`.

### Colors

| Token | Hex | Usage |
|--------|-----|--------|
| Brand | `#3C6169` | Buttons, accents, enquiry panel, city placeholders |
| Brand dark | `#2F4D54` | Hover states |
| Black | `#111111` | Main text, footer |
| Grey | `#6B7280` | Muted body text |
| Grey light | `#E5E7EB` | Borders |
| Grey soft | `#F3F4F6` | Section backgrounds, tags |
| White | `#FFFFFF` | Page background, cards |

CSS variables live in `css/styles.css` (`:root`).

### UI rules

- Corner radius: **4px** max
- No pill buttons, no gold accents, no decorative glow
- Sticky white header; brand-coloured contact panel

---

## Current site structure

Static multi-page prototype.

| File | Role |
|------|------|
| `index.html` | Homepage |
| `geel.html` | Geel property listing (9 unit cards) |
| `css/styles.css` | Styles / design tokens |
| `js/main.js` | Copy map (EN live, NL ready) + `applyCopy()` |
| `serve.js` | Local preview server (`node serve.js` → `http://127.0.0.1:8767`) |
| `PROJECT.md` | This roadmap |
| `properties/` | Source content: cities → streets → units |

### Homepage sections (top → bottom)

1. Header — logo, nav (What we do, Cities, How we work, Upcoming, Enquire)
2. Overview / hero — tagline, B2B pitch, stats
3. Cities — Geel (links to `geel.html`), Moerbeke, Knokke
4. How we work — company stays, invoicing, workspace ready
5. Upcoming — Moerbeke +7, Balen, Geel +5
6. Contact — mailto form (`hello@msastay.be` placeholder)
7. Footer

### Geel listing page (`geel.html`)

- Shows all 9 Geel units as cards, grouped by street
- Cover photos when present under each unit’s `images/` folder
- **Not clickable yet** — detail pages with more photos come later
- Homepage Geel city card links here

### Language

- **Live:** English (`currentLang = "en"` in `js/main.js`)
- **Ready:** Dutch strings in `copy.nl` (no UI switcher yet)
- Strings use `data-i18n` / `data-i18n-placeholder` in HTML (homepage)

---

## Property content library (`properties/`)

Source of truth for real accommodations. **Not wired into the homepage yet** — homepage stays overview-only until we deliberately connect this.

### Folder layout

```
properties/
  {city}/
    {street address}/
      Business Accommodation '{Unit name}'/
        Info.txt          ← important facts about the unit
        images/
          Main.jpg|jpeg   ← card cover / title image (required when photos exist)
          …               ← extra photos for detail pages later
```

**Convention:** always name the card cover `Main` (any common image extension). Listing pages use that file first.

City folders present: `geel`, `moerbeke`, `knokke-heist`, `balen`.

### Geel — started (9 units)

| Street | Units |
|--------|--------|
| **Stationsstraat 96** | Eclectic Living, Flow Living, Garden Living, Loft Intimate, Natural Living, Scandinavian Living, Urban Living |
| **Stationstraat 82** | Luxury Loft, Luxury XL |

Note: street spelling differs (`Stationsstraat` vs `Stationstraat`) — keep as on disk until confirmed.

### Status (as of last check)

- Folders + empty `Info.txt` + empty `images/` folders are in place for Geel’s 9 units
- Fill `Info.txt` and drop photos into each unit’s `images/` when ready
- Moerbeke / Knokke-Heist / Balen folders exist but have no units yet

### Later use

When we leave homepage-only focus: read this tree for listings, detail pages, and eventually the `msa_stay` database.

---

## Assets (photos & logo)

| Asset | Status | Path |
|--------|--------|------|
| Property photos | Per unit under `properties/` | `properties/{city}/{street}/.../images/` |
| Site-wide / hero extras | Optional | `images/` |
| Logo | Placeholder house SVG | `images/logo.svg` or `images/logo.png` |

**How to add unit photos:** put files in that unit’s `images/` folder (and fill `Info.txt`). Homepage will stay separate until we connect properties.

---

## Hosting (later)

Static hosting is enough for the prototype:

- Netlify / Vercel / Cloudflare Pages / GitHub Pages
- Domain TBD (e.g. `msastay.be`)

Local preview: `node serve.js` → `http://127.0.0.1:8767`

---

## Database & backend (later)

Not implemented yet. Suggested names when we add a backend:

| Item | Suggested name | Notes |
|------|----------------|--------|
| Database | `msa_stay` | Primary app database |
| Properties table | `properties` | City, address, amenities, status, photos |
| Enquiries table | `enquiries` | Company, city, message, dates |
| Companies table | `companies` | B2B clients (optional phase 2) |

Stack TBD (e.g. PostgreSQL + API, or Supabase / Firebase). Contact form today uses `mailto:` only.

---

## Roadmap

### Done

- [x] Static homepage prototype
- [x] Design system: Inter, Hind, `#3C6169` / white / black / grey
- [x] Sections: overview, cities, how we work, upcoming, contact
- [x] EN copy + NL copy map (no switcher UI yet)
- [x] Geel listing page with 9 unit cards (`geel.html`)

### Next

- [ ] Polish homepage until it feels ideal (current focus alongside city pages)
- [ ] Fill remaining Geel `Info.txt` + `images/` for units still without photos
- [ ] Make each Geel unit card open a detail page (more photos + Info.txt)
- [ ] Host on Netlify (or similar) + optional custom domain
- [ ] EN \| NL language toggle in the header
- [ ] Moerbeke / Knokke / Balen listing pages when content is ready
- [ ] Real contact email / form backend (not only mailto)
- [ ] Database `msa_stay` + admin for properties / availability
- [ ] Company invoicing / booking flow (B2B)

---

## Notes for collaborators / Cursor

- Prefer this file when asking “what fonts/colors do we use?”
- Keep brand decisions here; mirror tokens in `css/styles.css`
- Do not invent a second palette without updating this doc
