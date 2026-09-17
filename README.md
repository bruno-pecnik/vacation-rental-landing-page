# Vacation Rental Landing Page

A multilingual, single-page static landing page for a vacation rental apartment. Built so guests who already found the property on Booking.com (or via a recommendation) can search its exact name and reach a direct contact point (WhatsApp) instead — no booking engine, no payments, just information and a fast way to get in touch.

**Live site:** _(added once GitHub Pages is enabled)_

## Features

- Single HTML document with JS-driven section switching (no page reloads, URL hash per section)
- Language switcher (EN / IT / DE / PL / CZ)
- WhatsApp contact button with a pre-filled message template
- Image gallery, location/nearby info with an embedded Google Map
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
│   ├── main.js         # section/tab switching logic
│   └── translations.js # language strings
└── images/
```

## Status

🚧 In progress — see commit history for build steps.
