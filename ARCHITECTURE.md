# 架构

内部实现。使用见 [README](./README.md)，开发见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 总体形态

单文件 userscript，入口 `src/main.ts`，`@match *://*/*`，`document-idle` 运行。

启动流程：

1. `bootstrap()`：已有 `#rw-root` 则直接返回（防重复注入）。
2. `mountPanel()`：建宿主、挂 Shadow DOM、注入样式、建 portal、挂载 Vue。
3. 注册 GM 菜单命令（显示/隐藏面板、学习本页、一键填报）。

核心链路：

- **学习**：`scanFields()` → `upsertEntries()` 写入当前身份字典。
- **填报**：`scanFields()` → 本地匹配（可选 Jev）→ `fillField()` / `fillAsyncField()` 写回。

## 目录结构

```
src/
  main.ts          入口：防重复注入、挂面板、注册菜单命令
  core.ts          learnPage() / fillPage()
  storage.ts       GM 存储：配置、多身份字典、导入导出合并
  types.ts         共享类型
  dom/
    label.ts       字段标签推断（label/aria/placeholder/表格/兄弟节点），按可信度排序
    section.ts     推断区域标题，拼成「实习经历·描述」这类字段名
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
#rw-root（light DOM 宿主）
└─ #shadow-root
   ├─ <style>              styles.ts 的 PANEL_CSS
   ├─ <div data-rw-portal> Reka 弹出层落点
   └─ <div>                Vue 挂载点
```

- 面板不注入全局 CSS，`.rw-*` 类不泄漏；页面 CSS 进不了 shadow 边界。
- **宿主例外**：`#rw-root` 在 light DOM，页面的普通规则优先于 `:host`。因此宿主的 `position / right / bottom / z-index / color / font-size / line-height` 必须用**内联样式**。

## UI 层

Vue 3 `<script setup>` + Reka UI（headless），样式全在 `styles.ts`。

- Reka 弹出层默认 teleport 到 `document.body`，会逃出 shadow root。`App.vue` 的 `ConfigProvider` 必须保留 `teleportTo` 指向 `[data-rw-portal]` 与 `:scroll-body="false"`；新增 portal 组件沿用这层包裹。
- `store.ts` 持有 `reactive` 的 `state`，集中所有 GM 写操作。GM 存储非响应式，写完调用 `refresh()`。组件不直接写 GM。

## 匹配与填报

1. **区域前缀**：向上找字段所在的最近区域标题，拼成 `实习经历·描述`，避免不同区域的同名子字段互相覆盖。
2. **完全匹配**：字段名归一化后与字典 label / 别名完全相同才直填，不做近似判断。
3. **疑似选项**：未命中的字段按字面证据分层（同义组 > 包含 > 二元组 > 单字）取候选，层内保持字典原序，每字段最多 6 条。计算证据前先剥掉自身区域前缀，否则同区字段会因共享前缀互为候选。候选为空则放弃该字段。
4. **Jev 字段匹配**：疑似选项交给 `choice` 判断；置信度不足或选「以上都不是」则跳过。
5. **Jev 选项匹配**：选择类字段先本地写值；若字典值与页面选项措辞对不上（多选逐片段判断），把「字典值 + 实际选项」交给 Jev，再用命中的选项重填。自定义组件先展开下拉读取选项。多选保留本地已命中项，只补上 Jev 判定的项。
6. **写入**：按控件类型分别处理，派发 `input` / `change` 事件以兼容前端框架。

## Jev 集成

- **两阶段**：字段匹配（选项为字典 key，已保存信息放在 `state.saved_info`，多题并行）；选项匹配（选项为页面真实文本，原生控件来自扫描结果，自定义组件由 `readCustomOptions()` 展开）。两阶段各发一次批量请求。
- **接口**：由 key 前缀决定。`jv_live_` → `https://jevtypesafeai.com/api/v1/decide`，否则 → `https://api.typesafe.ai/v1/systemone`。
- **网络**：经 `GM_xmlhttpRequest` 发出（脚本声明 `@connect`），绕过页面 CORS。
- **重试**：网络错误、`429` / `529` 指数退避，最多 3 次，遵循 `Retry-After`。仍失败则显示错误，不静默当作「未匹配」。
- **安全**：API Key 存在 GM 本地，请求由脚本直接发起。个人自用的取舍；多人使用建议自建后端转发。

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
