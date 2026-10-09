# 网申快速填报助手

一个基于 **vite-plugin-monkey** 的油猴（userscript）插件，用于快速填报网申表单信息，具体分为两个阶段：

- **学习**：手动填好一份网申表，点「学习本页」，插件把「字段标签 → 填写内容」存成字典（保存在浏览器本地）。
- **填报**：打开任意网申页面，点「一键填报」，插件先做本地模糊匹配，匹配不上的再交给 **Jev**（TypeSafe 的结构化决策模型）做语义匹配，然后把匹配的内容填进去。

产物是单文件 `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。

## 安装

1. 前往 GitHub Release 页下载 `resume-writer.user.js`（链接待补）。
2. 打开 Tampermonkey 面板，点「添加新脚本」。
3. 删掉编辑器里的默认内容，粘贴 `resume-writer.user.js` 的全部内容，按 `Cmd+S` 保存。
4. 刷新要使用的网申页面，脚本即生效。

> 同一时间只能装一个版本。已装旧版时，先在面板里删除旧脚本，否则旧脚本会先运行，新版不生效。

## 使用

1. 在网申页面手动把表单填好。
2. 点右下角悬浮球 → 「学习本页」。字典里就会出现这些字段。
3. 换到别的网申页面，点「一键填报」。
4. 「字典」标签页可搜索、改值、删除、导出/导入 JSON；「设置」里配置 Jev。

页面上会有一个悬浮球，也可通过 Tampermonkey 菜单命令触发学习/填报。

## Jev 配置（可选）

未配置 Jev 时插件只用本地规则（同义词表 + 包含 + Dice 相似度）匹配，能覆盖大部分常见字段。配置 Jev 后可处理同义但措辞不同的字段。

在「设置」里填：

| 项 | 说明 |
| --- | --- |
| Jev API Key | TypeSafe 官方 key（`apikey_...`，从 console.typesafe.ai 获取） |
| Jev 模型 | 默认 `jev-latest` |
| Jev 最低置信度 | 低于该值的结果不采用 |

点「测试连接」会发一个最小的 `noul` 请求，直接告诉你 key / 地址 / 模型是否可用。

> API Key 存在浏览器本地（GM 存储），请求由脚本直接发起。这是个人自用脚本的取舍；若长期多人使用，建议改为自建后端转发。实现细节见 [ARCHITECTURE](./ARCHITECTURE.md#jev-集成)。

## 文档

- [ARCHITECTURE](./ARCHITECTURE.md) —— 内部设计：Shadow DOM 隔离模型、模块职责、匹配流程、Jev 集成、存储模型、已知限制。
- [DEVELOPMENT](./DEVELOPMENT.md) —— 本地搭建、开发流程、测试、发布。