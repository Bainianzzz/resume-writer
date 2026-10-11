# 网申快速填报助手

基于 **vite-plugin-monkey** 的油猴脚本（TypeScript + Vue 3），快速填报网申表单。分两步：

- **学习**：手动填好一份网申表，点「学习本页」，字段标签和填写内容存入浏览器本地字典。
- **填报**：打开网申页，点「一键填报」。完全匹配的字段直接填入；其余字段可交给 **Jev**（TypeSafe 结构化决策模型）做语义匹配。

产物是单文件 `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。

## 安装

1. 从 GitHub Release 下载 `resume-writer.user.js`（链接待补）。
2. Tampermonkey 面板点「添加新脚本」，删除默认内容，粘贴全部内容，按 `Cmd+S` 保存。
3. 刷新网申页面，脚本生效。

> 同一时间只能装一个版本。已装旧版时先删除旧脚本，否则旧脚本先运行，新版不生效。

## 使用

1. 在网申页面手动填好表单。
2. 点右下角悬浮球 →「学习本页」。
3. 换到其他网申页，点「一键填报」。
4. 「字典」标签页可搜索、改值、删除、导入/导出 JSON；「设置」里配置 Jev。

也可通过 Tampermonkey 菜单命令触发学习和填报。

## Jev 配置（可选）

未配置时只填完全匹配的字段，其余留给人工。配置后，字面相关的疑似选项交给模型判断，能处理措辞不同的同义字段。

在「设置」里填写：

| 项 | 说明 |
| --- | --- |
| Jev API Key | TypeSafe 官方 key（`apikey_...`，从 console.typesafe.ai 获取） |
| Jev 模型 | 默认 `jev-latest` |
| Jev 最低置信度 | 低于该值的结果不采用 |

点「测试连接」会发一个最小的 `noul` 请求，直接告诉你 key、地址、模型是否可用。

> API Key 存在浏览器本地（GM 存储），请求由脚本直接发起。这是个人自用脚本的取舍；多人长期使用建议改为自建后端转发。详见 [ARCHITECTURE](./ARCHITECTURE.md#jev-集成)。

## 文档

- [ARCHITECTURE](./ARCHITECTURE.md)：内部设计
- [DEVELOPMENT](./DEVELOPMENT.md)：本地开发、测试、端到端验证
- [CONTRIBUTING](./CONTRIBUTING.md)：分支、提交、合并门禁与发布
