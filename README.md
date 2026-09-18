# Vacation Rental Landing Page

A multilingual, single-page static landing page for a vacation rental apartment. Built so guests who already found the property on Booking.com (or via a recommendation) can search its exact name and reach a direct contact point (WhatsApp) instead — no booking engine, no payments, just information and a fast way to get in touch.

**Live site:** https://bruno-pecnik.github.io/vacation-rental-landing-page/

## Features

- Single HTML document with JS-driven section switching (no page reloads, URL hash per section)
- Language switcher (EN / IT / DE / PL / CZ / HR)
- WhatsApp contact buttons with a pre-filled message template, plus a typed contact form that opens the same WhatsApp message for visitors who'd rather not leave the page
- Guest reviews carousel with per-review dynamic height, arrows and pagination dots
- "Rated on Booking.com" trust badge linking out to the real listing
- Image gallery (grid on desktop, swipeable one-photo carousel on mobile), location/nearby info with an embedded Google Map
- Scroll-reveal animations on major sections (skipped automatically for reduced-motion preferences or if IntersectionObserver isn't supported)
- Open Graph / Twitter Card meta tags, favicon and apple-touch-icon for proper link previews and bookmarking
- No backend, no database — pure static site, hosted free on GitHub Pages

## Tech stack

Vanilla HTML, CSS and JavaScript. No framework, no build step — deliberately, for fast load times, simple SEO, and full control over the markup.

## Project structure

```
.
├── index.html      # single page, all sections
├── css/
│   └── styles.css
├── js/
│   ├── main.js         # section/tab switching, carousels, scroll-reveal, contact form
│   └── translations.js # language strings
└── images/
```

## Status

🚧 In progress — see commit history for build steps.
