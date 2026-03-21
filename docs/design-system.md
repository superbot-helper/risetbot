# Design System

## Overview
RisetBot uses a lightweight local design system built on Tailwind CSS v4 tokens in `frontend/src/index.css`. The visual direction remains minimalist, calm, and readable for dense survey-processing workflows.

## Core Principles
- Prioritize clarity for data-heavy operational screens.
- Pair every async AI action with explicit feedback.
- Reuse semantic tokens before introducing one-off values.
- Keep desktop and mobile behavior visually consistent.

## Design Tokens
Primary tokens live in `frontend/src/index.css` and are exposed through CSS variables.

- Colors: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--sidebar`
- Typography: `--font-sans`, `--font-display`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- Shadows: `--shadow-subtle`, `--shadow-float`

## Typography
- Base font family: `Inter`
- Headings use stronger weight and tighter spacing for dashboard readability.
- Supporting copy should prefer semantic muted tokens over hardcoded grays when practical.

## Surface System
- Page background uses `background`.
- Primary containers use `card`.
- Grouped utility sections use `secondary`.
- Warnings and failures use `destructive`.
- Borders and separators use `border`.

## Motion
- Framer Motion is used for modal entry, list reveal, and step transitions.
- Motion should clarify state changes rather than decorate static UI.
- Long-running flows should always combine animation with text-based progress.

## Feedback Patterns
- File uploads show per-file progress bars.
- Extraction and analysis pipelines show labeled steps plus percentage progress.
- Toasts use distinct success and failure icon treatments.
- Auto-generate and report flows should surface active processing states.

## Accessibility
- Use semantic HTML and explicit labels.
- Preserve visible focus states.
- Pair status color with text or iconography.

## Component Guidance
- Prefer shared primitives in `frontend/src/components/ui`.
- New pages should consume semantic tokens before raw Tailwind color classes.
- Extract repeated visual patterns into shared components once reused.
