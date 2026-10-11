# 开发

本地搭建、测试与端到端验证。内部设计见 [ARCHITECTURE](./ARCHITECTURE.md)，分支与发布见 [CONTRIBUTING](./CONTRIBUTING.md)。

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

## 安装到浏览器

1. **开发版（默认）**：点开 `npm run dev` 控制台给出的 dev 脚本链接即可安装，改代码后热更新。
2. **构建版**：把 `dist/resume-writer.user.js` 拖进浏览器，或在 Tampermonkey「添加新脚本」里粘贴。仅用于发布或回归。

Tampermonkey 同时只能装一个版本。已装旧版时先卸载，或用 dev 链接覆盖；否则旧脚本先注入，`bootstrap` 见到 `#rw-root` 就直接返回。

## 测试

- Vitest + jsdom，配置在 `vitest.config.ts`（不加载 `vite-plugin-monkey`）。`$` 别名指向 `test/mocks/gm.ts`，模拟 GM API。
- 现有用例：`label`、`custom`、`section`、`text`、`local`、`jev`、`storage`（含身份与迁移）、`style-guard`。
- 只测纯逻辑。扫描、写入等 DOM 行为不写 vitest，见下方端到端。
- 新增匹配、解析、存储逻辑尽量补测试。`test/` 有自己的 `tsconfig.json`。

## 样式

面板样式只进 Shadow DOM，设计见 [ARCHITECTURE → Shadow DOM 隔离](./ARCHITECTURE.md#shadow-dom-隔离)。`test/style-guard.test.ts` 递归扫描 `src/`，拦截三类违规：SFC 里的 `<style>`、漏掉 `?inline` 的 `.css` 导入、手写 `document.head` / `documentElement` 注入。

## 端到端（Playwright MCP）

扫描、写入这类依赖真实渲染的行为，用 Playwright MCP 交互式验证。不写 vitest 用例，不写固定脚本，不建 `e2e/` 目录。

1. 向用户索要真实表单页网址。不编造，不用示例站代替。
2. 确认 dev server 已启动；没启动则提醒用户开启。
3. `browser_navigate` 打开目标页，用 `browser_snapshot`、点击、读 DOM 核对扫描与写入结果。
4. 发现问题就改代码，等 HMR 生效后重走一遍，直到结果正确。
