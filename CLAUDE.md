# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio and blog site for Graeme Lawton, built with Nuxt 4 (Vue 3), TypeScript, Tailwind CSS, and SCSS.

## Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run generate   # Generate static site
npm run preview    # Preview production build
```

## Architecture

- **Framework**: Nuxt 4.3.1 with file-based routing
- **Styling**: Tailwind CSS 3 (utility classes) + SCSS (animations, global effects)
- **Fonts**: Syne (display/headings) and Lora (body/content), loaded via Google Fonts preconnect

### Directory Structure

All application code lives under `app/`:
- `app/pages/` — File-based routes (`/`, `/about`, `/projects`, `/ramblings/[slug]`)
- `app/components/` — Organized by domain: `Layout/` (Header, Footer), `Svg/` (icons)
- `app/layouts/default.vue` — Single layout with grain texture overlay, header, footer
- `app/assets/sass/main.scss` — Tailwind directives, reveal animations, global effects

### Design System

Custom Tailwind tokens defined in `tailwind.config.js`:
- **Colors**: `surface` (backgrounds), `ink` (text), `accent` (orange highlights) — each with variants (`raised`, `muted`, `subtle`, etc.)
- **Dark theme only** (no light mode currently)
- Staggered reveal animations (`.reveal-d1` through `.reveal-d6`) and accent hover underlines (`.accent-hover`) defined in `main.scss`

### Content

Blog posts and project data are defined inline within Vue page components — there is no CMS or markdown pipeline. All components use `<script setup>` syntax.

## No Testing

No test framework is configured.
