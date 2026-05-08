# Codex Project Memory

## Project

Terian Services corporate site.

Repository:

`C:\Users\David\source\repos\Terian_Services`

## Working Context

We are continuously improving the Terian Services corporate website. The site is a Vite + React frontend hosted as an Azure Static Web App, with supporting Terraform infrastructure.

The site has already grown beyond a single Award Nomination System page and now includes multiple corporate, product, service, privacy, trust, and contact pages.

## Current Direction

Position Terian Services as a corporate brand that builds AI/ML-empowered enterprise software and provides services around AI analytics, integrity and fraud detection, data mining, MLOps, and datacenter-to-cloud migration.

The Award Nomination System remains a flagship product, but the site should communicate the broader Terian Services company story.

## Key Files

- `frontend/index.html` - HTML shell, site title, favicon, root mount.
- `frontend/src/App.tsx` - SPA route selection.
- `frontend/src/components/Header.tsx` - main navigation.
- `frontend/src/components/Footer.tsx` - site footer.
- `frontend/src/pages/` - page components.
- `frontend/public/terian_services_logo.png` - corporate logo asset.
- `frontend/public/staticwebapp.config.json` - Azure Static Web Apps config.
- `docs/SITE_UPDATE_ACTION_PLAN.md` - larger site roadmap and page-by-page plan.

## Conventions

- Prefer existing React and Tailwind patterns already present in the frontend.
- Keep changes scoped and production-minded.
- Use the corporate logo asset for brand identity where appropriate.
- Validate frontend changes with `npm run build` from `frontend` when practical.

## Recent Decisions

- Use `frontend/public/terian_services_logo.png` as the browser favicon instead of the temporary inline SVG clock icon.
- Keep project memory in `docs/Codex_Project_Memory.md` so future Codex sessions can quickly recover the project context.
- Add an `Ask AI` navigation item after `Contact`, pointing to `/ask-ai`.
- Add `frontend/src/pages/AskAI.tsx` as a static Ask Analytics AI shell for now; live AI behavior will be implemented later.

## Useful Commands

Run from `C:\Users\David\source\repos\Terian_Services\frontend`:

```powershell
npm run build
npm run dev
```

## Next Steps

- Continue implementing the corporate site roadmap in `docs/SITE_UPDATE_ACTION_PLAN.md`.
- Consider adding a full favicon set and Open Graph image.
- Continue refining service/product pages, routing, metadata, and contact workflows.
