---
name: Electric Slate Sprich
colors:
  surface: '#121316'
  surface-dim: '#121316'
  surface-bright: '#38393c'
  surface-container-lowest: '#0d0e11'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#292a2d'
  surface-container-highest: '#343538'
  on-surface: '#e3e2e6'
  on-surface-variant: '#c5c9ac'
  inverse-surface: '#e3e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#8f9378'
  outline-variant: '#444932'
  surface-tint: '#b0d500'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#caf300'
  on-primary-container: '#596c00'
  inverse-primary: '#536600'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#ffffff'
  on-tertiary: '#4e2600'
  tertiary-container: '#ffdcc4'
  on-tertiary-container: '#9b5100'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#caf300'
  primary-fixed-dim: '#b0d500'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb781'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#6f3800'
  background: '#121316'
  on-background: '#e3e2e6'
  surface-variant: '#343538'
  surface-base: '#121316'
  surface-card: '#1c1d22'
  surface-raised: '#25262c'
  surface-stroke: '#33353e'
  electric-lime: '#d4ff00'
  punch-orange: '#ff8800'
  vivid-purple: '#a855f7'
  cyan-spark: '#38bdf8'
  status-online: '#22c55e'
  status-rest-day: '#64748b'
  text-primary: '#f8fafc'
  text-muted: '#94a3b8'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  german-prompt-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  german-prompt-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-badge:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system powers a gamified, ADHD-friendly German speaking trainer built to eliminate executive dysfunction and conversational paralysis. The target audience includes neurodivergent learners, international professionals, and second-language speakers tackling German CEFR A2/B1 speaking barriers who need rapid dopamine feedback loops without feeling visually overwhelmed or patronized.

The visual style is **High-Contrast Cyber-Tactile Dark Mode**. It pairs an ultra-deep charcoal/slate foundation with punchy neon semantic accents, chunky pill geometries, and tactile micro-surfaces. The atmosphere is confident, patient, and modern:
- **Zero-Overwhelm Chunking:** Information is broken into clear interactive modules with generous touch targets and low information density.
- **Dopamine-Forward Scannability:** Color acts strictly as functional feedback. Vibrant category pills and glowing audio waveforms celebrate small vocal repetitions.
- **Dignified & Forgiving:** No punitive streak counters or shrill warning states. Banked rest days and attempt-first disclosures protect cognitive safety.

## Colors

The system uses an assertive dark palette grounded in tiered slate charcoals, highlighted by electric chromatic signals:

- **Primary (`#d4ff00` Electric Lime):** Denotes primary user action targets, active recording states, immediate vocal feedback, and high-priority micro-milestones.
- **Secondary (`#a855f7` Vivid Purple):** Reserved for vocabulary mastery, dialogue drill sets, and active linguistic categorization.
- **Tertiary (`#ff8800` Punch Orange):** Applied to warm-up missions, streak stamina, and energy gauges.
- **Neutral (`#121316` Deep Obsidian):** The foundational dark space. All tiered surfaces scale from `#1c1d22` (containers) to `#25262c` (interactive tiles and cards) to maintain contrast without harsh pitch-black glare.

### Semantic Rules & Accessibility
- Never communicate status by color alone. Provenance labels (e.g., `measured`, `AI estimate`, `self-reported`) and completion statuses must always accompany explicit iconography and typographic labels.
- The German target phrase is always set in the highest foreground contrast (`#f8fafc`), whereas auxiliary English hints and translations use `#94a3b8` or remain hidden behind attempt-first toggle surfaces.

## Typography

Typography prioritizes immediate conversational clarity and phonological readability. 

- **Display & Headings (Space Grotesk):** Provides a technical, modern cadence with energetic mechanical ink-traps that give the platform an empowering software persona.
- **Body & German Target Prompts (Plus Jakarta Sans):** Offers balanced geometric open counters and clean ascenders/descenders, allowing neurodivergent readers to scan German compound nouns (`Krankenversicherung`, `Vorstellungsgespräch`) with zero fatigue.
- **Linguistic Primacy:** Target German vocabulary lines use `german-prompt-lg` in bold weights. English definitions, when revealed, are presented in smaller, calmer weights (`body-md`) with deliberate color differentiation.

## Layout & Spacing

The layout is built upon an adaptive 12-column fluid grid system on desktop that gracefully collapses to a single-column, bottom-anchored layout on mobile viewports.

- **Desktop (1024px+):** Dashboard modules display side-by-side: left-side navigation and mission hubs anchor the lesson tree, while the primary right quadrant hosts live waveforms, AI talk coaches, and the 7-day effort tracker.
- **Mobile / Android PWA (<= 768px):** Adopts an ADHD-focused single-action canvas. One speaking task is displayed at a time to prevent cognitive scatter, with record triggers firmly rooted to the ergonomic bottom thumb-zone.
- **Spacing Rhythm:** Standard spacing utilizes an 8px grid foundation. Generous padding (`space-lg` to `space-xl`) inside cards prevents clutter, ensuring clear cognitive boundaries between discrete German phrases, playback controls, and category selectors.

## Elevation & Depth

Visual hierarchy uses **tonal layer stepping paired with neon ambient halos**, avoiding noisy, high-contrast borders:

1. **Base Floor (`#121316`):** The master canvas level. Completely unbordered and silent.
2. **Container Shell (`#1c1d22`):** Primary card modules. Inset with subtle 1px border lines (`#33353e` at 50% opacity) with zero drop shadow to eliminate visual noise.
3. **Active Interactive Stage (`#25262c`):** Interactive phrase modules, recording beds, and category chips. Hover and focus states emit soft, diffused colored ambient glows matching the respective accent (e.g., `0px 8px 24px -4px rgba(212, 255, 0, 0.18)` for active lime items).
4. **Active Recording Elevation:** When audio capture is active, the recording waveform card floats above all sibling content, backed by a soft 12px backdrop blur filter and a subtle pulsing perimeter glow.

## Shapes

The design system embraces an ultra-tactile, chunky pill-shaped geometry (`roundedness: 3`). 

- Default interactive buttons and pills use a continuous pill corner radius (full capsule curvature `9999px` or minimum `20px`).
- Master dashboard containers and lesson cards use deep, comfortable corners (`24px` to `28px`), giving the application a welcoming, playful, game-like silhouette that removes the intimidation factor of traditional language textbooks.
- Slotted exercise tokens and draggable sentence builders use pronounced `16px` to `20px` radii to indicate touch affordance and physical modularity.

## Components

### Buttons & Voice Triggers
- **Record Trigger (Primary Action):** Large circular pill button with glowing active states. In idle mode, it displays the microphone glyph on `#25262c` with an electric lime border. When engaged, it transitions to a filled `#d4ff00` button with a pulsing, tactile state that communicates active recording time (up to 60s limit).
- **Secondary Action Buttons:** Low-profile capsules using `#25262c` surface colors, bright text, and subtle hover borders.
- **Slower Audio Playback:** Pill button toggling between `1.0x` and `0.75x` speeds, tagged with clear icon cues.

### Category Chips & Tagged Slots
- **Gamified Topic Chips:** Full-capsule badges (e.g., *Food*, *Traveling*, *Work*, *Health*) using high-saturation background fills (`#ff8800`, `#a855f7`, `#38bdf8`) paired with white or deep charcoal typography and accompanying visual iconography.
- **Interactive Word Ordering Slots:** Dotted, tactile drop slots styled to clearly distinguish unpopulated slots from filled answers.

### Waveform Audio Visualizer
- Multi-bar dynamic frequency visualizer set within the `#1c1d22` container. Individual visualizer bars utilize gradient fills transitioning from `#a855f7` to `#38bdf8` or `#d4ff00`, reacting dynamically to audio decibels during playback and recording.

### Effort & Streak Tracker (Forgiving Rhythm Strip)
- A 7-day horizontal pill strip representing weekly practice cadence.
- Completed days (qualifying 15+ minutes) illuminate with vibrant checkmarks inside `#22c55e` or `#d4ff00` capsules.
- Banked rest days (up to 2) are celebrated as intentional recovery with a calm slate shield icon (`#64748b`), explicitly avoiding punishing broken streaks or negative color states.

### Provenance Badges
- Micro-pill metadata tags attached to every evaluation score: `measured`, `checked locally`, `self-rated`, `self-reported`, `AI estimate`, and `imported Gemini assessment`. Styled in neutral slate with high-contrast text (`label-mono`) to guarantee academic transparency and cognitive trust.