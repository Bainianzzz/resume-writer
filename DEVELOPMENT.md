# 开发

本地搭建与开发规范。内部设计见 [ARCHITECTURE](./ARCHITECTURE.md)。

## 环境

- Node.js（支持 Vite 8 / TypeScript 6，建议当前 LTS 或更高）
- npm

## 常用命令

```bash
npm install
npm run dev        # Vite 启动，控制台给出可安装的 dev 用户脚本链接
npm run build      # tsc 类型检查 + vite build → dist/resume-writer.user.js
npm run preview    # 预览构建产物
npm test           # vitest run
npm run test:watch
```

> AI：不要自己运行 `npm run dev` 或后台启动 Vite，由用户启动。改动后 `npm test` 与 `npm run build` 都必须通过。

## 安装到浏览器

1. **开发版（默认）**：`npm run dev` 控制台给出的 dev 脚本链接，点开即装，改代码后热更新。
2. **构建版**：把 `dist/resume-writer.user.js` 拖进浏览器，或在 Tampermonkey「添加新脚本」里粘贴。

注意：Tampermonkey 同时只装一个版本。已装旧版时先卸载，或用 dev 链接覆盖；否则旧脚本先注入，`bootstrap` 见到 `#rw-root` 就直接返回。

> AI：调试只用开发版，构建版仅在用户明确要求发布或回归时使用。

## 测试

- Vitest + jsdom，配置在 `vitest.config.ts`（不加载 `vite-plugin-monkey`）。`$` 别名到 `test/mocks/gm.ts` 模拟 GM API。
- 现有用例：`label`、`custom`、`text`、`jev`、`storage`（含身份与迁移）、`style-guard`。
- DOM 行为（扫描、写入）不写 vitest 用例，见下方端到端。

> AI：vitest 只测纯逻辑。新增匹配、解析、存储逻辑尽量补测试。`test/` 有自己的 `tsconfig.json`。

## 样式

面板样式只进 Shadow DOM，设计见 [ARCHITECTURE → Shadow DOM 隔离](./ARCHITECTURE.md#shadow-dom-隔离)。`test/style-guard.test.ts` 递归扫描 `src/`，拦截三类违规：SFC 里的 `<style>`、漏 `?inline` 的 `.css` 导入、手写 `document.head` / `documentElement` 注入。

## 端到端（Playwright MCP）

扫描、写入这类依赖真实渲染的行为，用 Playwright 交互式验证，不写 vitest 用例，也不写固定脚本。

> AI：直接用 Playwright MCP 驱动浏览器，不要先写脚本再跑。步骤：
>
> 1. 向用户索要真实表单页网址。不编造，不拿示例站充数。
> 2. 确认 dev server 已起；没起就提醒用户，不要自己开。
> 3. `browser_navigate` 打开目标页，再用 `browser_snapshot`、点击、读 DOM 核对扫描与写入结果。
> 4. 发现问题就改代码，等 HMR 生效后重走一遍，直到结果正确。
>
> 不建 `e2e/` 目录，不写 `.spec.ts`。这里是交互式验证，不是回归套件。

## 发布

1. 同步更新 `vite.config.ts` 中 userscript 的 `version` 与 `package.json` 的 `version`。
2. `npm run build`，产物为 `dist/resume-writer.user.js`。

userscript 元数据（`name` / `namespace` / `description` / `match` / `connect` 等）在 `vite.config.ts` 的 `monkey({ userscript })` 里维护。

## 提交

> AI：改完代码默认不提交、不推送，把改动留在工作区。只有用户明确要求提交时才 `git commit`。
