# 贡献指南

开发、测试与端到端验证见 [DEVELOPMENT](./DEVELOPMENT.md)。

## 核心约定

**`main` 只接受合并，不直接提交。** GitHub 分支保护拦住直接 push、强推与删除，管理员同样受限。本地 `.githooks/` 再拦一道，新克隆需启用一次：

```bash
git config core.hooksPath .githooks
```

钩子可用 `--no-verify` 绕过，真正的约束在服务端。

## 工作流

1. 从最新 `main` 切分支：`git switch -c feat/xxx`
2. 提交后推送：`git push -u origin feat/xxx`
3. 开 PR 到 `main`，用 **squash merge** 合并

`main` 保持线性，一个功能一个提交。

改动涉及行为、数据结构或模块职责时，同步更新 [ARCHITECTURE](./ARCHITECTURE.md)；命令或用法有变时，同步更新 [DEVELOPMENT](./DEVELOPMENT.md) 与 [README](./README.md)。

## 提交信息

首行不超过 72 字符，形如 `type(scope): 意图`，用英文书写。

- `type`：`feat`、`fix`、`refact`、`docs`、`test`、`chore`
- `scope`：改动落点，如 `match`、`dom`、`ui`、`jev`
- 正文按需写，用 `- ` 要点，一条对应一个具体改动

```text
refact(match): fill only exact matches locally, defer the rest to Jev

- replace similarity scoring with matchExact plus literal-evidence tiers
- cap per-field Jev candidates at 6
```

## 发布

PR 合入 `main` 后，`.github/workflows/release.yml` 读取版本号，若对应 release 不存在，则构建并发布 `vX.Y.Z`，产物是 `dist/resume-writer.user.js`。版本号未变时自动跳过。

发布只需一个 PR：同步更新 `vite.config.ts` 与 `package.json` 的 `version`（两处须一致，workflow 会校验），合入即可。

userscript 元数据（`name` / `namespace` / `description` / `match` / `connect` 等）在 `vite.config.ts` 的 `monkey({ userscript })` 中维护。
