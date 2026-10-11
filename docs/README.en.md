# Resume Auto-Fill Assistant

English · [中文](../README.md)

Userscript (vite-plugin-monkey + TypeScript + Vue 3) that fills job application forms fast.

- **Learn**: fill out an application form by hand, then click "Learn this page". The fields and the values you entered are saved to a local dictionary in your browser.
- **Fill**: open an application page and click "One-click fill". Exact matches are filled in directly; the rest can be handed to **Jev** (TypeSafe structured decision model) for semantic matching.

The output is a single file, `dist/resume-writer.user.js`, installed with Tampermonkey / Violentmonkey.

## Installation

1. Download `resume-writer.user.js` from the GitHub Release (link TBD).
2. In the Tampermonkey panel, click "Add new script", paste the whole file, and press `Cmd+S` to save.
3. Reload the application page; the script takes effect.

> Only one version can be installed at a time. Delete the old script first, otherwise it runs first and the new version never loads.

## Usage

1. Fill out the application form by hand, then click the floating ball in the bottom-right corner → "Learn this page".
2. Switch to another application page and click "One-click fill".
3. The "Dictionary" tab lets you search, edit values, delete entries, and import/export JSON; the "Settings" tab configures Jev.

You can also trigger learning and filling from the Tampermonkey menu commands.

## Jev configuration (optional)

Without configuration, only exact matches are filled and the rest is left to you. Once configured, likely options are handed to the model, which can handle synonyms that are worded differently.

Fill in the "Settings" tab:

| Item | Description |
| --- | --- |
| Jev API Key | TypeSafe official key (`apikey_...`, from console.typesafe.ai) |
| Jev model | Defaults to `jev-latest` |
| Jev min confidence | Results below this value are discarded |

Click "Test connection" to send a minimal `noul` request that verifies the key, endpoint, and model.

> The API key is stored locally in the browser (GM storage) and the script issues requests directly. A trade-off for personal use; for multiple users, proxy through a self-hosted backend. See [ARCHITECTURE](./ARCHITECTURE.en.md#jev-integration).

## Docs

- [ARCHITECTURE](./ARCHITECTURE.en.md): internal design
- [DEVELOPMENT](./DEVELOPMENT.en.md): development, testing, end-to-end verification
- [CONTRIBUTING](./CONTRIBUTING.en.md): branching, commit messages, release
