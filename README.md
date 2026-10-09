# 网申快速填报助手

一个基于 **vite-plugin-monkey** 的油猴（userscript）插件，用于网申表单的「学习 → 填报」。

- **学习**：你手动填好一份网申表，点「学习本页」，插件把「字段标签 → 填写内容」存成字典（保存在浏览器本地）。
- **填报**：打开任意网申页面，点「一键填报」，插件先做本地模糊匹配，匹配不上的再交给 **Jev**（TypeSafe 的结构化决策模型）做语义匹配，然后把内容填进去。

产物是单文件 `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。

## 安装

把 `dist/resume-writer.user.js` 拖进浏览器，或在 Tampermonkey 面板「添加新脚本」里粘贴。本地开发与构建见 [DEVELOPMENT](./DEVELOPMENT.md)。

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

点「测试连接」会发一个最小的 `noul` 请求，直接告诉你 key / 地址 / 模型是否可用。

> API Key 存在浏览器本地（GM 存储），请求由脚本直接发起。这是个人自用脚本的取舍；若长期多人使用，建议改为自建后端转发。实现细节见 [ARCHITECTURE](./ARCHITECTURE.md#jev-集成)。

## 文档

- [ARCHITECTURE](./ARCHITECTURE.md) —— 内部设计：Shadow DOM 隔离模型、模块职责、匹配流程、Jev 集成、存储模型、已知限制。
- [DEVELOPMENT](./DEVELOPMENT.md) —— 本地搭建、开发流程、样式约束、测试、发布。

## Roadmap

- [ ] 自定义下拉组件适配（Ant Design / Element UI 等）
- [ ] 字段级匹配结果可视化高亮与一键改选
- [ ] 每条字典项绑定来源站点，按站点过滤候选
- [ ] 学习时支持「仅学习标记过的字段」
