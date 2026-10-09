# 网申快速填报助手

一个基于 **vite-plugin-monkey** 的油猴（userscript）插件，用于网申表单的「学习 → 填报」。

- **学习**：你手动填好一份网申表，点「学习本页」，插件把「字段标签 → 填写内容」存成字典（保存在浏览器本地）。
- **填报**：打开任意网申页面，点「一键填报」，插件先做本地模糊匹配，匹配不上的再交给 **Jev**（TypeSafe 的结构化决策模型）做语义匹配，然后把内容填进去。

产物是单文件 `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。

## 快速开始

```bash
npm install
npm run dev      # 开发：Vite 会启动并把 userscript 在浏览器打开
npm run build    # 构建：生成 dist/resume-writer.user.js
```

安装方式：
1. 打开 Tampermonkey 面板 → 「添加新脚本」，或把 `dist/resume-writer.user.js` 拖进浏览器。
2. `npm run dev` 时，Vite 会在控制台给出一个可安装的 dev 用户脚本链接，点开即装。

## 使用

1. 在网申页面手动把表单填好。
2. 点右下角悬浮球 → 「学习本页」。字典里就会出现这些字段。
3. 换到别的网申页面，点「一键填报」。
4. 「字典」标签页可搜索、改值、删除、导出/导入 JSON；「设置」里配置 Jev。

页面上会有一个悬浮球，也可通过 Tampermonkey 菜单命令触发学习/填报。

## Jev 配置（可选，但推荐）

未配置 Jev 时插件只用本地规则（同义词表 + 包含 + Dice 相似度）匹配，能覆盖大部分常见字段。配置 Jev 后可处理同义但措辞不同的字段。

在「设置」里填：

| 项 | 说明 |
| --- | --- |
| Jev API Key | TypeSafe 官方 key（`apikey_...`，从 console.typesafe.ai 获取） |
| Jev 接口地址 | 留空自动判断：`jv_live_` 前缀 → `https://jevtypesafeai.com/api/v1/decide`；否则 → `https://api.typesafe.ai/v1/systemone`。也可手填其他网关 |
| Jev 模型 | 默认 `jev-latest` |
| Jev 最低置信度 | 低于该值的结果不采用 |

实现方式：把每个待匹配字段作为一个 `choice` 问题，选项直接使用字典 key（语义化），已保存信息放在 `state.saved_info` 供模型引用，一次请求批量判断（Jev 的多个 question 会并行执行）。

点「测试连接」会发一个最小的 `noul` 请求，直接告诉你 key / 地址 / 模型是否可用。

请求走 `GM_xmlhttpRequest`（脚本声明了 `@connect api.typesafe.ai` / `@connect jevtypesafeai.com`），以绕过页面 CORS。

请求失败时（网络错误、`429`/`529` 等）会按指数退避自动重试（最多 3 次，遵循 `Retry-After`）；仍失败则把错误显示在填报结果里，而不是静默当作“未匹配”。

> 注意：API Key 存在浏览器本地（GM 存储），请求由脚本直接发起。这是个人自用脚本的取舍；若长期多人使用，建议改为自建后端转发。

## 架构

```
src/
  main.ts              入口：注册面板、菜单命令、自动填报
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
    panel.ts           悬浮面板（操作 / 字典 / 设置）
    styles.ts          面板样式
```

## 匹配策略

1. **本地**：标签归一化后按 精确 → 同义词组 → 包含 → Dice 相似度 打分，取超过阈值（默认 0.62）的最高分。
2. **Jev**：本地未命中的字段，取本地排序前 N 个候选交给 Jev 的 `choice` 原语判断，置信度不足或选「以上都不是」则跳过。
3. **写入**：文本/日期/下拉/单选/多选/富文本分别处理，并派发 `input`/`change` 事件，尽量兼容前端框架。

## 已知限制

- 复杂自定义下拉组件（非原生 `<select>`）暂不自动填充。
- 文件上传、验证码、密码框不处理。
- 字典以标签为键，同一标签在不同站点含义不同时可能串味；可通过「字典」页手动改值。

## Roadmap

- [ ] 自定义下拉组件适配（Ant Design / Element UI 等）
- [ ] 字段级匹配结果可视化高亮与一键改选
- [ ] 每条字典项绑定来源站点，按站点过滤候选
- [ ] 学习时支持「仅学习标记过的字段」
