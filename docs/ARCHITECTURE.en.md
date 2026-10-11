# Architecture

English · [中文](../ARCHITECTURE.md)

Internal implementation. For usage see [README](./README.en.md); for development see [DEVELOPMENT](./DEVELOPMENT.en.md).

## Overall shape

A single-file userscript, entry point `src/main.ts`, `@match *://*/*`, running at `document-idle`.

Startup flow:

1. `bootstrap()`: return early if `#rw-root` already exists (prevents double injection).
2. `mountPanel()`: create the host, attach the Shadow DOM, inject styles, create the portal, mount Vue.
3. Register GM menu commands (show/hide panel, learn this page, one-click fill).

Core paths:

- **Learn**: `scanFields()` → `upsertEntries()` writes into the current profile dictionary.
- **Fill**: `scanFields()` → local match (optionally Jev) → `fillField()` / `fillAsyncField()` writes back.

## Directory structure

```
src/
  main.ts          Entry: prevent double injection, mount panel, register menu commands
  core.ts          learnPage() / fillPage()
  storage.ts       GM storage: config, multi-profile dictionaries, import/export merge
  types.ts         Shared types
  dom/
    label.ts       Field label inference (label/aria/placeholder/table/sibling), sorted by confidence
    section.ts     Infer the section heading, joined into field names like "Internship · Description"
    custom.ts      Detect and read custom dropdown components (UDesign / antd style)
    scanner.ts     Scan the page, produce FieldDescriptor[]
    setter.ts      Write to the various controls and dispatch events (React/Vue compatible)
  match/
    text.ts        Normalization, synonym groups, Dice similarity, literal-evidence tiers
    local.ts       Exact-match decision + tiered filtering of likely options (no scoring)
    jev.ts         Jev choice client, with connection test and retry
  ui/
    panel.ts       Create host, attachShadow, inject styles, create portal, mount Vue
    store.ts       Reactive state + GM bridge + Toast manager
    App.vue        Shell (ConfigProvider / ToastProvider / Tabs / floating ball)
    OpsTab.vue     Actions
    DictTab.vue    Dictionary (Reka Select)
    ConfigTab.vue  Settings (Reka Switch / Slider)
    Toast.vue      Top notices (Reka Toast)
    styles.ts      Panel style string, injected into the Shadow DOM
test/              vitest + jsdom: pure logic and rule guards
```

## Shadow DOM isolation

```
#rw-root (light DOM host)
└─ #shadow-root
   ├─ <style>              PANEL_CSS from styles.ts
   ├─ <div data-rw-portal> Reka overlay mount point
   └─ <div>                Vue mount point
```

- The panel injects no global CSS and `.rw-*` classes do not leak; page CSS cannot cross the shadow boundary.
- **Host exception**: `#rw-root` lives in the light DOM, so ordinary page rules win over `:host`. Its `position / right / bottom / z-index / color / font-size / line-height` must therefore be set with **inline styles**.

## UI layer

Vue 3 `<script setup>` + Reka UI (headless); all styles live in `styles.ts`.

- Reka overlays teleport to `document.body` by default, which escapes the shadow root. `App.vue`'s `ConfigProvider` must keep `teleportTo` pointing at `[data-rw-portal]` and `:scroll-body="false"`; new portal components must use the same wrapper.
- `store.ts` holds the `reactive` `state` and centralizes all GM writes. GM storage is not reactive, so call `refresh()` after writing. Components never write GM directly.

## Matching and filling

1. **Section prefix**: walk up to the nearest section heading around the field and join it into `Internship · Description`, so same-named sub-fields in different sections do not overwrite each other.
2. **Exact match**: a field is filled directly only when its normalized name equals a dictionary label/alias exactly; no approximate matching.
3. **Likely options**: unmatched fields are tiered by literal evidence (synonym group > contains > bigram > single char), preserving dictionary order within a tier, at most 6 candidates per field. Strip the field's own section prefix before computing evidence, otherwise fields in the same section would nominate each other via the shared prefix. An empty candidate set means the field is skipped.
4. **Jev field matching**: likely options go to `choice`; low confidence or a "none of the above" pick means skip.
5. **Jev option matching**: choice-type fields are written locally first; if the dictionary value does not match the wording of the page options (evaluated fragment by fragment for multi-select), the "dictionary value + actual options" is handed to Jev and refilled with the chosen options. Custom components expand the dropdown to read options first. Multi-select keeps locally matched items and only adds what Jev decided.
6. **Write-back**: handled per control type, dispatching `input` / `change` events to stay compatible with front-end frameworks.

## Jev integration

- **Two phases**: field matching (options are dictionary keys, saved info in `state.saved_info`, questions in parallel) and option matching (options are the page's real text; native controls come from scan results, custom components are expanded via `readCustomOptions()`). Each phase sends one batch request.
- **Endpoint**: decided by the key prefix. `jv_live_` → `https://jevtypesafeai.com/api/v1/decide`, otherwise → `https://api.typesafe.ai/v1/systemone`.
- **Network**: sent via `GM_xmlhttpRequest` (the script declares `@connect`), bypassing page CORS.
- **Retry**: network errors and `429` / `529` use exponential backoff, at most 3 attempts, honoring `Retry-After`. On continued failure an error is shown rather than silently treating it as "no match".
- **Security**: the API key is stored in GM local storage and requests are issued directly by the script. A trade-off for personal use; for multiple users, proxy through a self-hosted backend.

## Storage model

Everything goes through GM storage, with JSON strings as values:

| Key | Contents |
| --- | --- |
| `rw:config:v1` | Global config (Jev toggle / key / model, min confidence, etc.) |
| `rw:profiles:v1` | Multi-profile dictionaries: `{ activeId, profiles: Profile[] }` |
| `rw:dict:v1` | Legacy single dictionary, migrated into the default profile on first load |

`Profile = { id, name, entries: DictEntry[], updatedAt }`. `DictEntry` is keyed by `normalize(label)` and carries the original label, aliases, value, field kind, candidates, and source site.

## Known limitations

- No handling of file uploads, captchas, or password fields.
