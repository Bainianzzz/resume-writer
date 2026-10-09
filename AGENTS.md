# AGENTS.md

网申快速填报助手：基于 vite-plugin-monkey 的油猴 userscript（TypeScript + Vue 3），产物是单文件 `dist/resume-writer.user.js`。

本文只写 agent 容易做错、且不看就会踩的硬约束。内部设计见 [ARCHITECTURE](./ARCHITECTURE.md)，开发流程见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 硬约束

### 面板样式只进 Shadow DOM

面板挂在 Shadow DOM 里，样式必须留在 shadow root 内，且不得向宿主页面注入任何全局 CSS。做法：

- 样式写在 `src/ui/styles.ts` 的 `PANEL_CSS` 字符串里，由 `src/ui/panel.ts` 注入 `shadow.appendChild(<style>)`。
- 独立 `.css` 文件必须以 `?inline` 以字符串导入（`import css from './x.css?inline'`）。
- 宿主元素 `<div id="rw-root">` 在 light DOM，其定位与基础排版用**内联样式**设置（`:host` 的普通声明会输给页面 CSS）。

**SFC 里不写 `<style>`（含 `<style scoped>`）**：`@vitejs/plugin-vue` 会把它抽成全局 CSS 注入 `document.head`，污染宿主页面。`test/style-guard.test.ts` 会拦住这种写法并报出文件。

校验：`npm test` 通过，且 `grep -c 'document.head' dist/resume-writer.user.js` 为 `0`。

### UI 用 Vue 3 `<script setup>`

组件放 `src/ui/*.vue`，用 Composition API（`<script setup lang="ts">`）。面板状态集中在 `src/ui/store.ts`。

### GM 存储不是响应式的

`GM_setValue` 不会触发 Vue 更新。所有写操作走 `src/ui/store.ts` 的 action，写完后调 `refresh()` 重新镜像到响应式 `state`。

## 完成前

改动后确保两条都过：

```bash
npm test
npm run build
```
