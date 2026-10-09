# 开发

本地搭建、开发流程与编码规范。系统内部设计见 [ARCHITECTURE](./ARCHITECTURE.md)。

## 环境要求

- Node.js（支持 Vite 8 / TypeScript 6 的版本，建议当前 LTS 或更高）
- npm

## 快速开始

```bash
npm install

npm run dev      # 开发：Vite 启动，并在控制台给出可安装的 dev 用户脚本链接
npm run build    # 构建：tsc 类型检查 + vite build，产出 dist/resume-writer.user.js
npm run preview  # 预览构建产物
npm test         # 单元测试（vitest run）
npm run test:watch
```

## 安装到浏览器

1. **构建版**：把 `dist/resume-writer.user.js` 拖进浏览器，或在 Tampermonkey 面板「添加新脚本」里粘贴。
2. **开发版**：`npm run dev` 时，Vite 会在控制台给出一个可安装的 dev 用户脚本链接，点开即装；改代码后自动热更新。

> 注意：Tampermonkey 同时只应装一个版本。若已装旧版，先卸载或用 dev 链接覆盖安装，否则旧脚本会先注入并截胡（`bootstrap` 见到已有 `#rw-root` 就返回）。

## 目录结构

见 [ARCHITECTURE → 目录结构](./ARCHITECTURE.md#目录结构)。

## 样式约束

面板挂在 **Shadow DOM** 里，样式必须留在 shadow root 内，不得向宿主页面注入任何全局 CSS。完整规则见 [AGENTS.md → 样式约束](./AGENTS.md#面板样式只进-shadow-dom)（那是唯一权威来源）。要点：样式写在 `src/ui/styles.ts`，SFC 里不写 `<style>`。

**校验：**

```bash
npm test                                          # test/style-guard.test.ts 会拦住 SFC 里的 <style>
grep -c 'document.head' dist/resume-writer.user.js # 应为 0
```

## 测试

- 栈：Vitest + jsdom，配置见 `vitest.config.ts`（独立于 `vite.config.ts`，不加载 `vite-plugin-monkey`）。
- `$` 模块被 alias 到 `test/mocks/gm.ts`，模拟 GM API。
- 用例覆盖：标签解析、扫描、写入、文本匹配、Jev、存储、样式守卫。
- 约定：新增纯逻辑（匹配、解析、存储）尽量补测试；`test/` 有自己的 `tsconfig.json`。

```bash
npm test
```

## 浏览器内手动验证

自动化测试不覆盖真实页面渲染。手动验证：

1. `npm run dev`（或 `npm run build` 后安装 `dist`）。
2. 打开任意表单页，确认右下角出现悬浮球，点开三个标签页（操作 / 字典 / 设置）渲染正常。
3. 想验证样式隔离，可在一个带侵略性全局样式的页面加载脚本（注意先卸载已装版本）：

   ```css
   div { position: static; margin: 40px; font-size: 30px; }
   * { box-sizing: content-box; }
   button { background: hotpink; border: 5px solid green; }
   ```

   面板应不受影响：悬浮球仍是蓝色圆形、无绿边；面板仍固定在右下角。

## 发布与版本

`vite.config.ts` 里 userscript 的 `version` 与 `package.json` 的 `version` 需同时更新，然后构建：

```bash
npm run build
```

产物为单文件 `dist/resume-writer.user.js`。userscript 的 `name` / `namespace` / `description` / `match` / `connect` 等元数据在 `vite.config.ts` 的 `monkey({ userscript: { ... } })` 中维护。

## 提交

改完代码默认**不自动提交**——把改动留在工作区由用户审阅。只有用户明确要求「提交」时才执行 `git commit`。规则同样记录在 [AGENTS.md → 提交](./AGENTS.md#提交)。
