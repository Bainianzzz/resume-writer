# 架构

内部实现说明。使用见 [README](./README.md)，开发见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 总体形态

单文件 userscript，由 `vite-plugin-monkey` 把 TypeScript + Vue 3 打包而成，入口 `src/main.ts`。`@match *://*/*`，`document-idle` 运行。

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
  main.ts          入口：防重复注入、挂面板、注册菜单命令
  core.ts          learnPage() / fillPage()
  storage.ts       GM 存储：配置、多身份字典、导入导出合并
  types.ts         共享类型
  dom/
    label.ts       字段标签推断（label/aria/placeholder/表格/兄弟节点），按可信度排序
    section.ts     推断字段所属区域标题，拼成「实习经历·描述」这类字段名
    custom.ts      自定义下拉组件（UDesign / antd 风格）的识别与读值
    scanner.ts     扫描页面，产出 FieldDescriptor[]
    setter.ts      写入各类控件并派发事件（兼容 React/Vue）
  match/
    text.ts        归一化、同义词组、Dice 相似度、字面证据分层
    local.ts       完全匹配判定 + 疑似选项分层筛选（不打分）
    jev.ts         Jev choice 客户端，含连接测试与重试
  ui/
    panel.ts       建宿主、attachShadow、注入样式、建 portal、挂载 Vue
    store.ts       响应式状态 + GM 桥接 + Toast manager
    App.vue        外壳（ConfigProvider / ToastProvider / Tabs / 悬浮球）
    OpsTab.vue     操作
    DictTab.vue    字典（Reka Select）
    ConfigTab.vue  设置（Reka Switch / Slider）
    Toast.vue      顶部提示（Reka Toast）
    styles.ts      面板样式字符串，注入 Shadow DOM
test/              vitest + jsdom：纯逻辑与规则守卫
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

- **面板 → 页面**：不注入全局 CSS，`.rw-*` 类不会泄漏。
- **页面 → 面板**：shadow 边界挡住页面 CSS。
- **宿主例外**：`#rw-root` 在 light DOM，按 CSS Scoping 规范，页面的普通规则优先于 `:host`。因此宿主的 `position / right / bottom / z-index / color / font-size / line-height` 必须用**内联样式**设置。

## UI 层

Vue 3 `<script setup>` + Reka UI（headless，无自带 CSS），样式全在 `styles.ts`。

- Reka 弹出层默认 teleport 到 `document.body`，会逃出 shadow root。`App.vue` 的 `ConfigProvider` 设 `teleportTo` 指向 `[data-rw-portal]`，并设 `:scroll-body="false"`。新增 portal 组件须保持这层包裹。
- `store.ts` 持有 `reactive` 的 `state`（配置 / 字典 / 身份 / 当前 tab），并集中所有 GM 写操作。GM 存储非响应式，写完调用 `refresh()` 同步镜像。组件内不直接写 GM。

## 核心模块

| 模块 | 职责 |
| --- | --- |
| `core.ts` | `learnPage()`（读表单写字典）、`fillPage()`（匹配后写回） |
| `storage.ts` | GM 存储读写：配置、多身份字典（profiles）、导入导出合并 |
| `dom/label.ts` | 从 label/aria/placeholder/表格/兄弟节点推断标签，产出按可信度排序的候选 |
| `dom/section.ts` | 从 DOM 位置推断区域标题，拼成带区域的字段名 |
| `dom/scanner.ts` | 扫描页面，产出 `FieldDescriptor[]`（种类、标签、候选、选择器） |
| `dom/setter.ts` | `fillField()` 同步写入；`fillAsyncField()` 处理自定义组件与区间字段 |
| `match/text.ts` | 归一化、同义词组、Dice 相似度、字面证据分层 |
| `match/local.ts` | 完全匹配判定 + 疑似选项分层筛选 |
| `match/jev.ts` | Jev `choice` 客户端，含连接测试与重试 |

## 匹配与填报

1. **区域前缀**：扫描时从字段的 DOM 位置向上找最近的区域标题（如「实习经历」「项目经历」），拼成 `实习经历·描述`，避免不同区域的同名子字段互相覆盖。
2. **本地完全匹配**：字段名归一化后与字典条目的 label / 别名完全相同才直填，不做近似判断。
3. **疑似选项**：未命中的字段按字面证据分层（同义组 > 包含 > 二元组 > 仅单字）筛出候选，层内保持字典原序，每字段最多 6 条。计算证据前先剥掉字段自身区域的前缀，因为前缀只用于区分身份，否则同区字段会因共享前缀而互为候选。筛完为空即视为不在字典里，直接放弃该字段。
4. **Jev 字段匹配**：把疑似选项交给 Jev `choice` 判断；置信度不足或选「以上都不是」则跳过。
5. **Jev 选项匹配**：选择类字段先本地写值；若字典值与页面选项措辞对不上（多选则逐片段判断），把「字典值 + 实际选项」交给 Jev，再用命中的选项文本重填。原生 `select` / `radio` / 复选框组的选项来自 `FieldDescriptor.options`；自定义组件（`custom`）先展开下拉读取选项。多选保留本地已命中的项，只补上 Jev 判定的项。
6. **写入**：文本 / 日期 / 下拉 / 单选 / 多选 / 富文本分别处理，派发 `input` / `change` 事件以兼容前端框架。

## Jev 集成

- **字段匹配**：每个字段是一个 `choice` 问题，选项为字典 key，已保存信息放在 `state.saved_info`，多题并行。
- **选项匹配**：每个待判断的字典值片段是一个 `choice` 问题，选项为页面真实选项文本。原生控件选项来自扫描结果，自定义组件用 `readCustomOptions()` 展开下拉枚举。两阶段各发一次请求。
- **接口**：由 key 前缀决定。`jv_live_` 前缀走 `https://jevtypesafeai.com/api/v1/decide`，否则走 `https://api.typesafe.ai/v1/systemone`。
- **网络**：走 `GM_xmlhttpRequest`（脚本声明 `@connect api.typesafe.ai` / `@connect jevtypesafeai.com`），绕过页面 CORS。
- **重试**：网络错误、`429` / `529` 指数退避，最多 3 次，遵循 `Retry-After`。仍失败则在结果中显示错误，不静默当作「未匹配」。
- **安全**：API Key 存在 GM 本地存储，请求由脚本直接发起。这是个人自用的取舍；多人长期使用建议改为自建后端转发。

## 存储模型

全部走 GM 存储，值为 JSON 字符串：

| 键 | 内容 |
| --- | --- |
| `rw:config:v1` | 全局配置（Jev 开关 / Key / 模型、最低置信度等） |
| `rw:profiles:v1` | 多身份字典：`{ activeId, profiles: Profile[] }` |
| `rw:dict:v1` | 旧版单份字典，首次加载迁移进默认身份 |

`Profile = { id, name, entries: DictEntry[], updatedAt }`。`DictEntry` 以 `normalize(label)` 为主键，携带原始标签、别名、值、字段种类、候选、来源站点。

## 已知限制

- 不处理文件上传、验证码、密码框。
