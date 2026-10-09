# 架构

内部实现说明。使用方式见 [README](./README.md)，开发流程见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 总体形态

单文件 userscript `dist/resume-writer.user.js`，由 `vite-plugin-monkey` 把 TypeScript + Vue 3 打包而成，入口 `src/main.ts`。脚本 `@match *://*/*`，`document-idle` 运行。

启动流程：

1. `bootstrap()`：页面已有 `#rw-root` 则直接返回（防重复注入）。
2. `mountPanel()`：建宿主、挂 Shadow DOM、注入样式、建 portal 容器、挂载 Vue。
3. 注册 GM 菜单命令（显示/隐藏面板、学习本页、一键填报）。

两条核心链路：

- **学习**：`scanFields()` → 读取已填值 → `upsertEntries()` 写入当前身份字典。
- **填报**：`scanFields()` → 本地匹配（可选 Jev）→ `fillField()` / `fillAsyncField()` 写回并派发事件。

## 目录结构

```
src/
  main.ts              入口：防重复注入、挂面板、注册菜单命令
  core.ts              learnPage() / fillPage()
  storage.ts           GM 存储：字典、身份、配置、导入导出合并
  types.ts             共享类型
  dom/
    label.ts           字段标签解析（label/aria/placeholder/表格/兄弟节点），按可信度排序
    custom.ts          自定义下拉组件（UDesign / antd 风格）的识别与已选值读取
    scanner.ts         扫描页面得到 FieldDescriptor[]
    setter.ts          写入各类控件并派发事件（兼容 React/Vue）
  match/
    text.ts            归一化、同义词组、Dice 相似度
    local.ts           本地匹配打分与候选排序
    jev.ts             Jev choice 匹配客户端
  ui/
    panel.ts           挂载到 Shadow DOM（样式 + portal 容器 + Vue 实例）
    store.ts           面板响应式状态 + GM 存储桥接 + Toast manager
    App.vue            外壳（ConfigProvider / ToastProvider / Tabs / 悬浮球）
    OpsTab.vue         操作
    DictTab.vue        字典（Reka Select）
    ConfigTab.vue      设置（Reka Switch / Slider）
    Toast.vue          顶部提示（Reka Toast）
    styles.ts          面板样式字符串，注入 Shadow DOM
test/                  vitest + jsdom：纯逻辑与规则守卫
```

## Shadow DOM 隔离

```
document
└─ <div id="rw-root">          ← 宿主，light DOM
   └─ #shadow-root
      ├─ <style>               ← styles.ts 的 PANEL_CSS
      ├─ <div data-rw-portal>  ← Reka 弹出层落点
      └─ <div>                 ← Vue 挂载点
```

- **面板 → 页面**：不注入任何全局 CSS，`.rw-*` 类不会泄漏。
- **页面 → 面板**：shadow 边界挡住页面 CSS。
- **宿主例外**：`#rw-root` 在 light DOM，按 CSS Scoping 规范，页面的普通规则优先于 `:host`。因此宿主的 `position / right / bottom / z-index / color / font-size / line-height` 必须用**内联样式**设置。

> AI：样式写 `src/ui/styles.ts` 的 `PANEL_CSS`，SFC 不写 `<style>`。完整规则见 AGENTS.md 硬约束。

## UI 层

Vue 3 `<script setup>` + Reka UI（headless，无自带 CSS）。用到 `ConfigProvider`、`Tabs`、`Select`、`Switch`、`Slider`、`Toast`（+ `createToastManager`）。样式全在 `styles.ts`。

Reka 弹出层默认 teleport 到 `document.body`，会逃出 shadow root。`App.vue` 用 `ConfigProvider` 的 `teleportTo` 指向 `[data-rw-portal]`，并设 `:scroll-body="false"`。

> AI：新增 portal 组件保持这层包裹，不要回退到 `document.body`。

`store.ts` 持有 `reactive` 的 `state`（配置 / 字典 / 身份 / 当前 tab），并集中所有 GM 写操作。GM 存储非响应式，写完调 `refresh()` 同步镜像。

> AI：组件内不直接写 GM，所有写操作走 store action。

## 核心模块

| 模块 | 职责 |
| --- | --- |
| `main.ts` | 入口：防重复注入、挂面板、注册菜单命令 |
| `core.ts` | `learnPage()`（读表单写字典）、`fillPage()`（匹配后写回） |
| `storage.ts` | GM 存储读写：配置、多身份字典（profiles）、导入导出合并 |
| `dom/label.ts` | 从 label/aria/placeholder/表格/兄弟节点推断标签，产出按可信度排序的候选 |
| `dom/custom.ts` | 识别自定义下拉组件，读取已选值 |
| `dom/scanner.ts` | 扫描页面，产出 `FieldDescriptor[]`（种类、标签、候选、选择器） |
| `dom/setter.ts` | `fillField()` 同步写入；`fillAsyncField()` 处理自定义组件与区间字段 |
| `match/text.ts` | 归一化、同义词组、Dice 相似度 |
| `match/local.ts` | 本地打分与候选排序 |
| `match/jev.ts` | Jev `choice` 客户端，含连接测试与重试 |
| `ui/store.ts` | 响应式状态 + GM 桥接 + toast manager |
| `ui/panel.ts` | 建宿主、attachShadow、注入 `PANEL_CSS`、建 portal、`createApp` 挂载 |

## 匹配与填报

1. **本地**：标签归一化后依次按 精确 → 同义词组 → 包含 → Dice 打分，取超过阈值（默认 0.62）的最高分。
2. **Jev 字段匹配**：本地未命中的字段，取本地排序前 N 个候选交给 Jev `choice` 判断；置信度不足或选「以上都不是」则跳过。
3. **Jev 选项匹配**：选择类字段先本地写值；若字典值与页面选项措辞对不上（多选则逐个片段判断），把「字典值 + 实际选项」交给 Jev `choice` 判断应选哪一项，再用命中的选项文本重填。原生 `select` / `radio` / 复选框组的选项来自 `FieldDescriptor.options`；自定义选择组件（`custom`）需先展开下拉读取当前选项，再交给 Jev。多选会保留本地已命中的项，仅补上 Jev 判定的项。
4. **写入**：文本 / 日期 / 下拉 / 单选 / 多选 / 富文本分别处理，派发 `input` / `change` 事件以兼容前端框架。

## Jev 集成

- 字段匹配：每个字段是一个 `choice` 问题，选项为字典 key；已保存信息放在 `state.saved_info`。多个问题并行批量判断。
- 选项匹配：选择类字段本地写值失败或有漏选时，每个待判断的字典值片段是一个 `choice` 问题，选项即页面真实选项文本，把 Jev 判定的选项重新写回。原生控件选项来自扫描结果；自定义组件（div 型 select）用 `readCustomOptions()` 展开下拉枚举选项。两阶段各发一次请求。
- 接口地址固定，由 key 前缀决定：`jv_live_` 前缀 → `https://jevtypesafeai.com/api/v1/decide`，否则 → `https://api.typesafe.ai/v1/systemone`。
- 请求走 `GM_xmlhttpRequest`（脚本声明 `@connect api.typesafe.ai` / `@connect jevtypesafeai.com`），绕过页面 CORS。
- 网络错误、`429` / `529` 指数退避重试，最多 3 次，遵循 `Retry-After`。仍失败则在结果中显示错误，不静默当作「未匹配」。

> API Key 存在 GM 本地存储，请求由脚本直接发起。这是个人自用的取舍；多人长期使用时建议改为自建后端转发。

## 存储模型

全部走 GM 存储，值为 JSON 字符串：

| 键 | 内容 |
| --- | --- |
| `rw:config:v1` | 全局配置（Jev 开关 / Key / 模型、匹配阈值、最低置信度等） |
| `rw:profiles:v1` | 多身份字典：`{ activeId, profiles: Profile[] }` |
| `rw:dict:v1` | 旧版单份字典，首次加载迁移进默认身份 |

`Profile = { id, name, entries: DictEntry[], updatedAt }`。`DictEntry` 以 `normalize(label)` 为主键，携带原始标签、别名、值、字段种类、候选、来源站点。

> AI：`storage.ts` 内部缓存 store，写后 `persist()` 落盘；面板侧再 `refresh()`。

## 已知限制

- 不处理文件上传、验证码、密码框。
