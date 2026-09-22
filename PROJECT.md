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
- Mol
- Knokke

### Cities / capacity — upcoming

- Mol **+10**
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

```
msa-stay/
  admin/           Admin UI (properties + amenities)
  css/             Public site styles
  data/            SQLite database (msa_stay.sqlite)
  js/              Public site scripts
  properties/      Photo folders only (city → street → unit → images/)
  server/          Database helpers (db.js)
  serve.js         HTTP server + API
  index.html       Homepage
  geel.html        Geel listings (loaded from API)
  moerbeke.html    Moerbeke listings (loaded from API)
  property.html    Property detail template
  package.json
  PROJECT.md
```

| Path | Role |
|------|------|
| `serve.js` | Server + `/api/properties` + `/api/amenities` |
| `server/db.js` | SQLite schema and queries |
| `data/msa_stay.sqlite` | Property & amenity data |
| `admin/` | Manage properties and amenities |
| `js/properties-client.js` | Public API client |
| `js/city-listings.js` | Renders city listing cards from API |
| `js/property-page.js` | Renders property detail from API |
| `js/main.js` | Homepage copy (EN / NL map) |
| `properties/` | Image files on disk |

Content (name, guests, description, amenities) is edited in **Admin**, not in code.

### Homepage sections (top → bottom)

1. Header — logo, nav (What we do, Cities, How we work, Upcoming, Enquire)
2. Overview / hero — tagline, B2B pitch, stats
3. Cities — Geel → `geel.html`, Moerbeke → `moerbeke.html`, Knokke
4. How we work — company stays, invoicing, workspace ready
5. Upcoming — Moerbeke +7, Balen, Geel +5
6. Contact — mailto form (`hello@msastay.be` placeholder)
7. Footer

### City & property pages

- Listings: `geel.html` / `moerbeke.html` fetch from API and group by street
- Detail: `property.html?id=<slug>` loads one property from API
- Photos: `properties/{city}/{street}/{folder}/images/` (cover preferred as `Main.*`)

### Language

- **Live:** English (`currentLang = "en"` in `js/main.js`)
- **Ready:** Dutch strings in `copy.nl` (no UI switcher yet)
- Strings use `data-i18n` / `data-i18n-placeholder` in HTML (homepage)

---

## Property photos (`properties/`)

Photos only — property text lives in the database.

```
properties/
  {city}/
    {street address}/
      {unit folder}/
        images/
          Main.jpg|jpeg|png   ← card cover when present
          …
```

City folders present: `geel`, `moerbeke`, `knokke-heist`, `balen`.

---

## Assets (photos & logo)

| Asset | Status | Path |
|--------|--------|------|
| Property photos | Per unit under `properties/` | `properties/{city}/{street}/.../images/` |
| Logo | Placeholder house SVG in header | (inline in HTML) |

**How to add unit photos:** put files in that unit’s `images/` folder (name cover `Main`), then in Admin open the property → Sync from folder (or Upload).

---

## Hosting (later)

Static hosting is enough for the prototype:

- Netlify / Vercel / Cloudflare Pages / GitHub Pages
- Domain TBD (e.g. `msastay.be`)

Local preview: `node serve.js` → `http://127.0.0.1:8767`

---

## Database & admin

Local SQLite database (no external service):

| Item | Path / name |
|------|-------------|
| Database file | `data/msa_stay.sqlite` |
| Tables | `properties`, `amenities`, `property_amenities`, `property_images` |
| Admin UI | http://127.0.0.1:8767/admin/ |
| API | `/api/properties`, `/api/amenities`, `/api/cities` |

Public listing and property pages load from the API. Manage **cities**, properties, and amenities in Admin.

City listings use one template: `city.html?slug=geel` (old `geel.html` / `moerbeke.html` / `mol.html` redirect here).

Start: `npm start` or `node serve.js` (if PowerShell blocks npm: `node serve.js` or `npm.cmd start`)

---

## Later backend (beyond local SQLite)

Already have local SQLite + admin. Next steps when going live:

| Item | Notes |
|------|--------|
| Enquiries table | Company, city, message, dates |
| Companies table | B2B clients (optional) |
| Auth on `/admin` | Required before public hosting |
| Hosting | Needs Node (or export) — plain static hosts won’t run SQLite API |

Contact form today uses `mailto:` only.

---

## Roadmap

### Done

- [x] Static homepage prototype
- [x] Design system: Inter, Hind, `#3C6169` / white / black / grey
- [x] Sections: overview, cities, how we work, upcoming, contact
- [x] EN copy + NL copy map (no switcher UI yet)
- [x] Geel & Moerbeke listing pages (API-driven)
- [x] Shared property detail pages
- [x] SQLite database + admin for properties & amenities

### Next

- [ ] Polish homepage until it feels ideal
- [ ] Add photos for units still without images (via Admin sync/upload)
- [ ] Host with Node (or similar) + optional custom domain
- [ ] EN \| NL language toggle in the header
- [ ] Knokke / Balen listing pages when content is ready
- [ ] Real contact email / form backend (not only mailto)
- [ ] Admin login before public deploy
- [ ] Company invoicing / booking flow (B2B)

---

## Notes for collaborators / Cursor

- Prefer this file when asking “what fonts/colors do we use?”
- Keep brand decisions here; mirror tokens in `css/styles.css`
- Do not invent a second palette without updating this doc
