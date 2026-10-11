# 贡献指南

代码提交与协作规范。开发环境、测试与端到端验证见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 核心约定

**`main` 只接受合并，不接受直接提交。**

- **服务端**：GitHub 分支保护拦住直接 push、强推、删除分支，管理员同样受限。
- **本地**：`.githooks/` 的 `pre-commit` 与 `pre-push` 提前拦下对 `main` 的直接提交与推送。新克隆需启用一次：

  ```bash
  git config core.hooksPath .githooks
  ```

  钩子可用 `--no-verify` 绕过，真正的约束在服务端。

## 工作流

1. 从最新 `main` 切出特性分支：`git switch -c feat/xxx`
2. 在分支上提交，然后 `git push -u origin feat/xxx`
3. 开 PR，目标分支 `main`
4. 用 **squash merge** 合并，把多个提交压成 `main` 上的一个提交

合并后 `main` 保持线性，一个功能一个提交。

## 提交信息

- 首行不超过 72 字符，形如 `type(scope): 意图`
- 常用 `type`：`feat`、`fix`、`refact`、`docs`、`test`、`chore`
- `scope` 写改动落在哪块，如 `match`、`dom`、`ui`、`jev`
- 正文只在需要时写，用 `- ` 要点，一条对应一个具体改动
- 用英文书写

```text
refact(match): fill only exact matches locally, defer the rest to Jev

- replace similarity scoring with matchExact plus literal-evidence tiers
- cap per-field Jev candidates at 6
```

## 合并门禁

PR 到 `main` 会自动跑两个 workflow，两个都通过才允许合并：

| Workflow | 做什么 |
| --- | --- |
| `test` | `npm test`（vitest run） |
| `build` | `npm run build`（tsc 类型检查 + vite build） |

分支保护把这两项设为必需状态检查，红灯时合并按钮是灰的。本地先跑同样两条命令，可以少等一轮 CI：

```bash
npm test
npm run build
```

改动涉及行为、数据结构或模块职责时，同步更新 [ARCHITECTURE](./ARCHITECTURE.md)；命令或用法有变时，同步更新 [DEVELOPMENT](./DEVELOPMENT.md) 与 [README](./README.md)。

## 发布

1. 同步更新 `vite.config.ts` 中 userscript 的 `version` 与 `package.json` 的 `version`。
2. `npm run build`，产物为 `dist/resume-writer.user.js`。
3. 把 `resume-writer.user.js` 挂到 GitHub Release。

userscript 元数据（`name` / `namespace` / `description` / `match` / `connect` 等）在 `vite.config.ts` 的 `monkey({ userscript })` 中维护。
