# 架构

面向理解内部实现的文档。使用者请看 [README](./README.md)，本地搭建与开发规范请看 [DEVELOPMENT](./DEVELOPMENT.md)。

## 总体形态

产物是**单文件** `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。基于 `vite-plugin-monkey`，把 TypeScript + Vue 3 编译压缩成一个 userscript，入口 `src/main.ts`。

脚本 `@match *://*/*`，在 `document-idle` 运行。启动流程：

1. `bootstrap()`：若页面已有 `#rw-root` 则直接返回（防重复注入）。
2. `mountPanel()`：建宿主元素、挂 Shadow DOM、注入样式、建 shadow 内 portal 容器、挂载 Vue 应用。
3. 注册 GM 菜单命令（显示/隐藏面板、学习本页、一键填报）。

两条核心链路：

- **学习**：`scanFields()` 扫描页面 → 读取已填值 → `upsertEntries()` 写入当前身份字典。
- **填报**：`scanFields()` → 本地匹配（可选 Jev 语义匹配）→ `fillField()` / `fillAsyncField()` 写回并派发事件。

## 目录结构

```
src/
  main.ts              入口：注册面板、菜单命令
  core.ts              learnPage() / fillPage() 两个核心流程
  storage.ts           GM 存储：字典增删改查、配置、导入导出合并
  types.ts             共享类型
  dom/
    label.ts           通用字段标签解析（label/aria/placeholder/表格/兄弟节点）
    scanner.ts         扫描页面得到 FieldDescriptor[]
    setter.ts          写入各类控件并派发事件（兼容 React/Vue）
  match/
    text.ts            归一化、同义词组、Dice 相似度
    local.ts           本地匹配 + 候选排序
    jev.ts             Jev choice 匹配客户端
  ui/
    panel.ts          挂载面板到 Shadow DOM（样式注入 + portal 容器 + Vue 实例）
    store.ts          面板响应式状态 + GM 存储桥接 + Reka toast manager
    App.vue           面板外壳（ConfigProvider / ToastProvider / Tabs / 悬浮球）
    OpsTab.vue        操作标签页
    DictTab.vue       字典标签页（Reka Select）
    ConfigTab.vue     设置标签页（Reka Switch / Slider）
    Toast.vue         顶部提示（Reka Toast）
    styles.ts         面板样式（字符串，注入 Shadow DOM）
test/                 单元测试（vitest + jsdom）
```

## 运行时形态：Shadow DOM

面板挂在 Shadow DOM 内，目的是**双向隔离**：

```
document
└─ <div id="rw-root">        ← 宿主，在 light DOM，定位用内联样式
   └─ #shadow-root
      ├─ <style>             ← styles.ts 的 PANEL_CSS
      ├─ <div data-rw-portal> ← Reka 弹出层的落点（ConfigProvider.teleportTo）
      └─ <div>               ← Vue 应用挂载点
```

- **面板 → 页面**：不注入任何全局 CSS。所有样式都在 shadow root 内，`.rw-*` 类不会泄漏，也不依赖 `rw-` 前缀避免冲突。
- **页面 → 面板**：shadow 边界挡住页面 CSS，面板内部不受影响。
- **宿主元素例外**：`<div id="rw-root">` 本身在 light DOM。按 CSS Scoping 规范，宿主元素的普通声明**外部页面优先于** shadow 内的 `:host`。所以宿主的 `position/right/bottom/z-index/color/font-size/line-height` 必须用**内联样式**（权重高于页面普通规则）设置，不能写在 `:host` 里。

样式写法与校验规则见 [AGENTS.md → 面板样式只进 Shadow DOM](./AGENTS.md#面板样式只进-shadow-dom)（唯一权威来源）。

## UI 层（Vue 3 + Reka UI）

面板是 Vue 3 应用（`<script setup>`），交互原语用 **Reka UI**（headless，零自带 CSS），样式全在 `styles.ts`。

用到：`ConfigProvider`、`Tabs`、`Select`、`Switch`、`Slider`、`Toast`（+ `createToastManager`）。

关键点——**弹出层默认会被 teleport 到 `document.body`，从而逃出 shadow root**。`App.vue` 用 `ConfigProvider` 的 `teleportTo` 指到 shadow 内的 `[data-rw-portal]` 容器，并 `:scroll-body="false"`。约束与理由见 [AGENTS.md → 交互用 Reka UI](./AGENTS.md#交互用-reka-ui弹出层必须留在-shadow-dom)。

状态：`store.ts` 持有 `reactive` 的 `state`（配置/字典/身份/当前 tab），并集中所有 GM 写操作；GM 存储非响应式，写完 `refresh()`。

## 核心模块

| 模块 | 职责 |
| --- | --- |
| `main.ts` | 入口。防重复注入、挂载面板、注册菜单命令 |
| `core.ts` | `learnPage()`（读表单写字典）、`fillPage()`（匹配后写回表单） |
| `storage.ts` | GM 存储读写：配置、多身份字典（profiles）、导入导出合并 |
| `dom/label.ts` | 从 label/aria/placeholder/表格/兄弟节点推断字段标签，产出候选标签并按可信度排序 |
| `dom/scanner.ts` | 扫描页面，产出 `FieldDescriptor[]`（种类、标签、候选、选择器） |
| `dom/setter.ts` | `fillField()` 同步写入；`fillAsyncField()` 处理自定义组件 / 区间字段，派发事件兼容 React/Vue |
| `match/text.ts` | 文本归一化、同义词组、Dice 相似度 |
| `match/local.ts` | 本地匹配打分与候选排序 |
| `match/jev.ts` | Jev `choice` 匹配客户端，含连接测试与重试 |
| `ui/store.ts` | 面板响应式状态（`reactive`）+ GM 存储桥接 + Reka toast manager；GM 存储非响应式，写后需 `refresh()` |
| `ui/panel.ts` | 建宿主、attachShadow、注入 `PANEL_CSS`、建 portal 容器、`createApp` 挂载 |

## 匹配与填报流程

1. **本地**：标签归一化后按 精确 → 同义词组 → 包含 → Dice 相似度 打分，取超过阈值（默认 0.62）的最高分。
2. **Jev**：本地未命中的字段，取本地排序前 N 个候选交给 Jev 的 `choice` 原语判断，置信度不足或选「以上都不是」则跳过。
3. **写入**：文本 / 日期 / 下拉 / 单选 / 多选 / 富文本分别处理，并派发 `input` / `change` 事件，尽量兼容前端框架。

## Jev 集成

- 每个待匹配字段是一个 `choice` 问题，选项直接用字典 key（语义化），已保存信息放在 `state.saved_info` 供模型引用；一次请求批量判断（多个 question 并行执行）。
- 接口地址留空时自动判断：`jv_live_` 前缀 → `https://jevtypesafeai.com/api/v1/decide`；否则 → `https://api.typesafe.ai/v1/systemone`。
- 请求走 `GM_xmlhttpRequest`（脚本声明 `@connect api.typesafe.ai` / `@connect jevtypesafeai.com`）以绕过页面 CORS。
- 请求失败（网络错误、`429`/`529` 等）按指数退避自动重试（最多 3 次，遵循 `Retry-After`）；仍失败则把错误显示在填报结果里，不静默当「未匹配」。

> API Key 存在浏览器本地（GM 存储），请求由脚本直接发起。这是个人自用脚本的取舍；若长期多人使用，建议改为自建后端转发。

## 存储模型

全部走 GM 存储（键值对，值为 JSON 字符串）：

| 键 | 内容 |
| --- | --- |
| `rw:config:v1` | 全局配置（Jev 开关/Key/地址/模型、匹配阈值、最低置信度等） |
| `rw:profiles:v1` | 多身份字典：`{ activeId, profiles: Profile[] }` |
| `rw:dict:v1` | 旧版单份字典，首次加载时迁移进默认身份 |

`Profile` = `{ id, name, entries: DictEntry[], updatedAt }`。`DictEntry` 以 `normalize(label)` 为稳定主键，携带原始标签、别名、值、字段种类、候选、来源站点。`storage.ts` 内部缓存 store，写操作后 `persist()` 落盘；面板侧再 `refresh()` 同步到响应式镜像。

## 已知限制

- 复杂自定义下拉组件（非原生 `<select>`）暂不自动填充。
- 文件上传、验证码、密码框不处理。
- 字典以标签为键，同一标签在不同站点含义不同时可能串味；可通过「字典」页手动改值。
