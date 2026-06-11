# Cascrow Logo Files

All SVG icons share the same S-shaped mark (viewBox 10 10 80 80, paths use a 100×100 coordinate space).

## Files

### icon-black-on-white.svg
- **Verwendung:** Google Search-Ergebnis-Logo, Strukturierte Daten (schema.org)
- **Kopiert nach:** `public/icon.svg` (wird von `src/app/layout.tsx` structured-data `logo.url` referenziert)
- **Hintergrund:** Weiß `#FFFFFF`
- **Icon-Farbe:** Schwarz `#000000`

### icon-copper-on-dark.svg
- **Verwendung:** Browser-Tab-Favicon
- **Kopiert nach:** `src/app/icon.svg` (Next.js App Router Favicon-Konvention)
- **Hintergrund:** Dunkelbraun `#171311` mit abgerundeten Ecken (rx=20)
- **Icon-Farbe:** Copper `#C4704B`

### icon-copper-transparent.svg
- **Verwendung:** Inline React-Komponente `<CascrowIcon>` in `src/components/logo.tsx`
- **Eingebaut in:**
  - Navigation (alle Seiten via `<Logo variant="nav">`)
  - Footer (`src/components/site-footer.tsx`)
  - Cinematic Intro (`src/components/cinematic-intro.tsx`)
  - OG-Share-Bild (`src/app/opengraph-image.tsx`)
  - Agent Trust Badge (`src/app/api/badge/[walletAddress]/route.ts`)
- **Hintergrund:** Transparent
- **Icon-Farbe:** Copper `#C4704B`

### icon-white-transparent.svg
- **Verwendung:** Reserve — für helle Hintergründe (z.B. PDF-Export, E-Mail-Templates)
- **Hintergrund:** Transparent
- **Icon-Farbe:** Off-White `#EDE6DD`

## Icon-Pfade (SVG)

Beide Pfade teilen dieselben Koordinaten und können mit beliebiger `fill`-Farbe verwendet werden:

```
<path d="M 30.7,67.3 A 33,33 0 1,1 85.9,35.5 L 71.4,39.3 A 18,18 0 1,0 41.3,56.7 Z"/>
<path d="M 69.3,32.7 A 33,33 0 1,1 14.1,64.5 L 28.6,60.7 A 18,18 0 1,0 58.7,43.3 Z"/>
```

## Marke

Die Wortmarke „cascrow" wurde beim DPMA als Wortmarke angemeldet (Stand Juni 2026).
