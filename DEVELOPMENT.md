# 开发

[English](./docs/DEVELOPMENT.en.md) · 中文

内部设计见 [ARCHITECTURE](./ARCHITECTURE.md)，分支与发布见 [CONTRIBUTING](./CONTRIBUTING.md)。

## 环境

Node.js（建议当前 LTS，需支持 Vite 8 / TypeScript 6）与 npm。

## 常用命令

```bash
npm install
npm run dev         # 控制台给出可安装的 dev 用户脚本链接
npm run build       # tsc 类型检查 + vite build → dist/resume-writer.user.js
npm run preview     # 预览构建产物
npm test            # vitest run
npm run test:watch
```

## 安装到浏览器

1. **开发版（默认）**：点开 `npm run dev` 控制台的 dev 脚本链接，改代码后热更新。
2. **构建版**：拖入浏览器或粘贴到 Tampermonkey，仅用于发布或回归。

同一时间只装一个版本。旧脚本先注入时，`bootstrap` 见到 `#rw-root` 就直接返回，新版不生效。

## 测试

- Vitest + jsdom，配置在 `vitest.config.ts`（不加载 `vite-plugin-monkey`）。`$` 别名指向 `test/mocks/gm.ts`，模拟 GM API。
- 只测纯逻辑：`label`、`custom`、`section`、`text`、`local`、`jev`、`storage`、`style-guard`。扫描、写入等 DOM 行为不写 vitest。
- 新增匹配、解析、存储逻辑尽量补测试。

## 样式守卫

`test/style-guard.test.ts` 扫描 `src/`，拦截三类违规：SFC 里的 `<style>`、漏掉 `?inline` 的 `.css` 导入、手写 `document.head` / `documentElement` 注入。设计见 [ARCHITECTURE → Shadow DOM 隔离](./ARCHITECTURE.md#shadow-dom-隔离)。

## 端到端（Playwright MCP）

扫描、写入这类依赖真实渲染的行为，用 Playwright MCP 交互式验证。不写 vitest，不写固定脚本，不建 `e2e/`。

1. 向用户索要真实表单页网址，不编造，不用示例站代替。
2. 确认 dev server 已启动；没启动则提醒用户开启。
3. `browser_navigate` 打开目标页，用 `browser_snapshot`、点击、读 DOM 核对结果。
4. 有问题就改代码，等 HMR 生效后重走，直到正确。
