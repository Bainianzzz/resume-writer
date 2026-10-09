# AGENTS.md

网申快速填报助手：基于 vite-plugin-monkey 的油猴 userscript（TypeScript + Vue 3），产物是单文件 `dist/resume-writer.user.js`。

## 硬约束

- **不自己启动 dev server**：不跑 `npm run dev`，也不后台起 Vite。没起就提醒用户开启，并等待确认。
- **调试只用开发版**，不用 `dist/resume-writer.user.js`。构建版仅在用户明确要求发布/回归时使用。
- **样式只进 Shadow DOM**：样式写在 `src/ui/styles.ts` 的 `PANEL_CSS`；`.css` 必须 `?inline` 导入；`<div id="rw-root">` 的定位用内联样式。
- **SFC 不写 `<style>`**（含 `scoped`），否则会被抽成全局 CSS 污染宿主页面。
- **不手写 `document.head` / `documentElement` 注入**。`npm test` 的 `test/style-guard.test.ts` 会拦截以上三类违规。
- **Reka 弹出层不得逃出 shadow root**：保留 `App.vue` 中 `ConfigProvider` 的 `teleportTo`（指向 `[data-rw-portal]`）和 `:scroll-body="false"`，新增 portal 组件不得回退到 `document.body`。
- **GM 存储不是响应式的**：所有写操作走 `src/ui/store.ts` 的 action，写完调 `refresh()`。
- **vitest 只测纯逻辑**，不写扫描/写入等 DOM 行为用例。
- **DOM 行为用 Playwright MCP 交互式验证**：不写固定脚本，不建 `e2e/` 套件。
- **端到端必须用用户提供的真实表单页网址**：不编造地址，不用示例站代替；没给就停下等用户。
- **只在被明确要求时才 `git commit`**，否则改完即停，留在工作区。
- **完成前两条都要过**：`npm test` 和 `npm run build`。

## 文档索引

- [ARCHITECTURE.md](./ARCHITECTURE.md)：内部设计
- [DEVELOPMENT.md](./DEVELOPMENT.md)：开发流程、安装到浏览器、端到端测试
