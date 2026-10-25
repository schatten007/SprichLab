# Sprich — Web Deployment & Brand Asset Manifest (.ZIP Archive Structure)

This document provides the structured file tree, ready-to-use vector markup, configuration files, and deployment instructions for downloading and bundling the complete **Sprich** production asset suite.

---

## 1. Archive File Structure (`sprich-web-assets.zip`)

```text
sprich-web-assets/
├── public/
│   ├── manifest.webmanifest
│   ├── favicon.ico
│   ├── icons/
│   │   ├── icon.svg
│   │   ├── favicon-32.png
│   │   ├── favicon-48.png
│   │   ├── apple-touch-icon.png
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   ├── icon-maskable-512x512.png
│   │   ├── shortcut-today.png
│   │   ├── shortcut-words.png
│   │   └── shortcut-workplace.png
│   ├── fonts/
│   │   ├── SpaceGrotesk-Bold.woff2
│   │   ├── PlusJakartaSans-Regular.woff2
│   │   └── PlusJakartaSans-Bold.woff2
│   └── assets/
│       ├── berlin-baeckerei-theke.webp
│       ├── avatar-partner-elena.webp
│       ├── companion-rhythm-wave.webp
│       └── still-life-brotzeit.webp
├── docs/
│   ├── ASSET_MANIFEST.md
│   └── OFFLINE_CACHE_STRATEGY.md
└── README.md
```

---

## 2. Master Vector Graphic (`public/icons/icon.svg`)

Full-bleed, edge-to-edge electric lime acoustic soundwave `S` glyph on deep obsidian background (`#121316`), zero outer squircle or artificial white borders:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#121316"/>
  <defs>
    <filter id="subtle-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Stylized Acoustic 'S' Soundwave Glyphs -->
  <g fill="none" stroke="#d4ff00" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" filter="url(#subtle-glow)">
    <!-- Upper loop soundwave resonance -->
    <path d="M 330 160 C 330 110, 290 85, 230 85 C 170 85, 140 120, 140 165 C 140 230, 340 250, 340 335 C 340 400, 290 427, 220 427 C 155 427, 120 395, 120 345" />
    <!-- Center acoustic rhythm bars -->
    <line x1="200" y1="130" x2="200" y2="190" stroke-width="20" />
    <line x1="240" y1="110" x2="240" y2="210" stroke-width="24" />
    <line x1="280" y1="135" x2="280" y2="185" stroke-width="18" />
    <!-- Lower loop acoustic rhythm bars -->
    <line x1="180" y1="315" x2="180" y2="375" stroke-width="18" />
    <line x1="220" y1="295" x2="220" y2="400" stroke-width="24" />
    <line x1="260" y1="320" x2="260" y2="380" stroke-width="20" />
  </g>
  <!-- Resonance Cadence Accent Dots -->
  <circle cx="100" cy="256" r="7" fill="#38bcd8" opacity="0.9" />
  <circle cx="412" cy="256" r="7" fill="#a855f7" opacity="0.9" />
</svg>
```

---

## 3. Web App Manifest (`public/manifest.webmanifest`)

Configured for standalone PWA installation, zero cloud telemetry, and offline-first caching:

```json
{
  "name": "Sprich — German Speaking Trainer",
  "short_name": "Sprich",
  "description": "Local-first, ADHD-friendly German speaking practice for everyday, university, and workplace situations.",
  "start_url": "/?source=pwa",
  "id": "/?source=pwa",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#121316",
  "theme_color": "#121316",
  "lang": "de-DE",
  "dir": "ltr",
  "categories": [
    "education",
    "productivity"
  ],
  "icons": [
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    },
    {
      "src": "/icons/favicon-32.png",
      "sizes": "32x32",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/favicon-48.png",
      "sizes": "48x48",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Today's Speaking Bite",
      "short_name": "Today",
      "description": "Direct jump trigger for today's 15-minute speaking bite routine",
      "url": "/today",
      "icons": [
        {
          "src": "/icons/shortcut-today.png",
          "sizes": "96x96",
          "type": "image/png"
        }
      ]
    },
    {
      "name": "Vocabulary Vault",
      "short_name": "Words",
      "description": "Quick launcher for the Offline Vocabulary Vault",
      "url": "/words",
      "icons": [
        {
          "src": "/icons/shortcut-words.png",
          "sizes": "96x96",
          "type": "image/png"
        }
      ]
    },
    {
      "name": "Workplace Missions",
      "short_name": "Workplace",
      "description": "Direct jump to German Workplace scenario drills",
      "url": "/workplace",
      "icons": [
        {
          "src": "/icons/shortcut-workplace.png",
          "sizes": "96x96",
          "type": "image/png"
        }
      ]
    }
  ],
  "display_override": [
    "window-controls-overlay",
    "standalone",
    "minimal-ui"
  ],
  "prefer_related_applications": false
}
```

---

## 4. HTML Head Integration (`index.html`)

Paste into your application's `<head>` tag for full PWA and platform bookmark compatibility:

```html
<!-- Primary Brand Favicons & Icons -->
<link rel="icon" type="image/svg+xml" href="/icons/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png">

<!-- Apple Touch Icon (iOS Safari & Home Screen) -->
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">

<!-- Web App Manifest -->
<link rel="manifest" href="/manifest.webmanifest">

<!-- Mobile & PWA Theme Chrome -->
<meta name="theme-color" content="#121316">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sprich">
<meta name="application-name" content="Sprich">
```

---

## 5. Offline Self-Hosted Typography Configuration (`styles/fonts.css`)

Self-hosted WOFF2 fonts eliminating Google Fonts or external CDN telemetry:

```css
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/SpaceGrotesk-Bold.woff2') format('woff2');
}

@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/PlusJakartaSans-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/PlusJakartaSans-Bold.woff2') format('woff2');
}
```

---

## 6. How to Extract or Build the .zip Package

Run the following command in your terminal or build script to assemble the bundle:

```bash
mkdir -p sprich-assets/public/icons sprich-assets/public/fonts sprich-assets/public/assets
# Copy generated assets into respective folders
zip -r sprich-web-assets.zip sprich-assets/
```
