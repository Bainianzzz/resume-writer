# 网申快速填报助手

[English](./docs/README.en.md) · 中文

![学习与填报流程：手动填一次，点「学习本页」存入浏览器本地字典；换页面点「一键填报」，遇到不同词汇交给 Jev 语义匹配](./docs/assets/workflow.jpg)

油猴脚本（vite-plugin-monkey + TypeScript + Vue 3），快速填报网申表单。

- **学习**：手动填好一份网申表，点「学习本页」，字段与填写内容存入浏览器本地字典。
- **填报**：打开网申页，点「一键填报」。完全匹配的字段直接填入；其余可交给 **Jev**（TypeSafe 结构化决策模型）做语义匹配。

产物是单文件 `dist/resume-writer.user.js`，用 Tampermonkey / Violentmonkey 安装。

## 安装

1. 从 GitHub Release 下载 `resume-writer.user.js`（链接待补）。
2. Tampermonkey 面板点「添加新脚本」，粘贴全部内容，按 `Cmd+S` 保存。
3. 刷新网申页，脚本生效。

> 同一时间只能装一个版本。先删旧脚本，否则旧脚本先运行，新版不生效。

## 使用

1. 手动填好网申表，点右下角悬浮球 →「学习本页」。
2. 换到其他网申页，点「一键填报」。
3. 「字典」页可搜索、改值、删除、导入/导出 JSON；「设置」页配置 Jev。

也可用 Tampermonkey 菜单命令触发学习和填报。

## Jev 配置（可选）

未配置时只填完全匹配的字段，其余留给人工。配置后，疑似选项交给模型判断，能处理措辞不同的同义字段。

「设置」中填写：

| 项 | 说明 |
| --- | --- |
| Jev API Key | TypeSafe 官方 key（`apikey_...`，从 console.typesafe.ai 获取） |
| Jev 模型 | 默认 `jev-latest` |
| Jev 最低置信度 | 低于该值的结果不采用 |

点「测试连接」发送一个最小的 `noul` 请求，验证 key、地址、模型。

> API Key 存在浏览器本地（GM 存储），由脚本直接发起请求。个人自用的取舍；多人使用建议改为自建后端转发。详见 [ARCHITECTURE](./ARCHITECTURE.md#jev-集成)。

## 文档

- [ARCHITECTURE](./ARCHITECTURE.md)：内部设计
- [DEVELOPMENT](./DEVELOPMENT.md)：开发、测试、端到端验证
- [CONTRIBUTING](./CONTRIBUTING.md)：分支、提交、发布
