# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

````js
export default defineConfig([
  # FairArena — Client (React + TypeScript)

  This folder contains the frontend for FairArena - Curl Tester. It is built with
  React 19 + TypeScript, Vite, and TailwindCSS. The quick-start below is all you
  need to run the client locally during development.

  ## Quick Start

  Install dependencies and run the dev server (HMR via Vite):

  ```bash
  cd client
  pnpm install
  pnpm run dev
````

By default the dev server proxies `/api/*` and `/terminal` to `http://localhost:4000`.

## Build for Production

```bash
pnpm run build
pnpm run preview
```

## Environment

- `VITE_API_URL` — URL of the backend API (set in Vercel or `.env.local` for local tests)

## Lint & Type-Check

```bash
pnpm run lint
npx tsc --noEmit
```

## Notes

- Keep components small and well-typed. Use `zod` in the client only for
  improved UX validation; server-side validation remains authoritative.
- See the top-level `README.md` for deployment and architecture details.
  // Enable lint rules for React DOM
