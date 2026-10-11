# Development

English · [中文](../DEVELOPMENT.md)

For internal design see [ARCHITECTURE](./ARCHITECTURE.en.md); for branching and release see [CONTRIBUTING](./CONTRIBUTING.en.md).

## Environment

Node.js (current LTS recommended; must support Vite 8 / TypeScript 6) and npm.

## Common commands

```bash
npm install
npm run dev         # console prints a link to the installable dev userscript
npm run build       # tsc type-check + vite build → dist/resume-writer.user.js
npm run preview     # preview the build output
npm test            # vitest run
npm run test:watch
```

## Installing into the browser

1. **Dev build (default)**: open the dev script link printed by `npm run dev`; code changes hot-reload.
2. **Built version**: drag into the browser or paste into Tampermonkey; only for release or regression.

Install only one version at a time. If the old script injects first, `bootstrap` sees `#rw-root` and returns early, so the new version never takes effect.

## Testing

- Vitest + jsdom, configured in `vitest.config.ts` (does not load `vite-plugin-monkey`). The `$` alias points to `test/mocks/gm.ts`, which mocks the GM API.
- Pure logic only: `label`, `custom`, `section`, `text`, `local`, `jev`, `storage`, `style-guard`. DOM behaviors such as scanning and writing are not covered by vitest.
- Add tests for new matching, parsing, and storage logic where possible.

## Style guard

`test/style-guard.test.ts` scans `src/` and blocks three kinds of violation: `<style>` inside SFCs, `.css` imports missing `?inline`, and hand-written `document.head` / `documentElement` injection. Design: [ARCHITECTURE → Shadow DOM isolation](./ARCHITECTURE.en.md#shadow-dom-isolation).

## End-to-end (Playwright MCP)

Behaviors that depend on real rendering, such as scanning and writing, are verified interactively with Playwright MCP. No vitest, no fixed scripts, no `e2e/` suite.

1. Ask the user for a real form page URL; do not invent one or substitute an example site.
2. Confirm the dev server is running; if not, remind the user to start it.
3. Use `browser_navigate` to open the target page, then `browser_snapshot`, clicks, and DOM reads to check results.
4. Fix the code when something is wrong, wait for HMR, and repeat until correct.
