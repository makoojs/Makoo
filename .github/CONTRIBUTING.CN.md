# 贡献指南

感谢你愿意参与 Makoo 的开发。这个文档说明提交代码前需要了解的基本流程。
更细的协作约定会在确认后继续补充。

## 开发环境

本仓库使用 pnpm workspace 管理 monorepo。

```bash
pnpm install
```

常用命令：

```bash
pnpm build
pnpm test
pnpm docs:build
pnpm changeset
```

## 项目结构

- `packages/core`：框架无关的运行时核心。
- `packages/cli`：CLI、配置解析、扫描、代码生成和 Vite 插件。
- `packages/react`：React adapter。
- `packages/vue`：Vue adapter 和 Vue plugin。
- `packages/create-makoo`：项目脚手架。
- `apps/docs-website`：文档站点。

实现改动时，请优先把代码放在已有职责边界内。不要把框架特定逻辑放进
`packages/core`。

## 提交 Pull Request 前

提交 Pull Request 前，请根据改动类型完成本地验证。

代码改动必须至少运行：

```bash
pnpm test
```

如果改动涉及公开 API、CLI 行为、构建产物、导出字段或包依赖关系，必须运行：

```bash
pnpm build
pnpm test
```

如果改动涉及文档，必须运行：

```bash
pnpm docs:build
```

文档改动还需要亲自查看页面效果，确认最终展示达到了改动目的。可以使用：

```bash
pnpm docs:dev
```

CI 会在 Pull Request 中执行构建、测试和文档构建，但本地验证仍然是提交前的
必要步骤。

## 分支命名

分支命名是强制要求。请使用下面的格式：

```text
<type>/<short-description>
```

常用类型：

- `feat`：新增功能。
- `fix`：修复问题。
- `docs`：文档改动。
- `test`：测试相关改动。
- `refactor`：不改变行为的重构。
- `chore`：工具、配置、依赖或维护类改动。
- `ci`：CI/CD 相关改动。

示例：

```text
feat/vue-plugin-options
fix/cli-config-resolution
docs/getting-started
ci/changesets-release
```

请使用简短、清晰、可读的英文描述，单词之间使用 `-` 连接。

## Commit Message

Commit message 强制使用 Conventional Commits：

```text
<type>: <summary>
```

示例：

```text
feat: add vue plugin options
fix: resolve cli config path
docs: update getting started guide
ci: add changesets release workflow
```

常用类型与分支类型保持一致：`feat`、`fix`、`docs`、`test`、`refactor`、
`chore`、`ci`。

提交信息应使用简洁英文描述本次提交的实际改动。

## Issue 关联

Pull Request 不强制关联 issue。

如果 PR 是为了解决已有 issue，建议在 PR 描述中关联：

```text
Closes #123
```

小修、文档、维护类改动可以不关联 issue。

## Pull Request

Pull Request 标题强制使用 Conventional Commits，格式与 commit message 一致：

```text
<type>: <summary>
```

示例：

```text
feat: add vue plugin options
fix: resolve cli config path
docs: update getting started guide
```

Pull Request 描述需要使用项目模板。模板会在 `.github` 中单独维护。

PR 一般由 owner 进行 review。合并前应确保 CI 通过，并确认 Changeset 是否符合
本次改动范围。

## Changeset

如果改动会影响 npm 包使用者，需要在提交前创建 Changeset：

```bash
pnpm changeset
```

需要 Changeset 的常见情况：

- 修复 npm 包中的 bug。
- 新增功能。
- 调整公开 API。
- 改变 CLI 行为。
- 改变构建产物、导出字段或包依赖关系。

通常不需要 Changeset 的情况：

- 只改测试。
- 只改文档。
- 只改内部 CI 或工具配置。
- 不影响发布包行为的重构。

CI 会检查发布相关包改动是否带有 `.changeset/*.md` 文件。`Version Packages`
PR 由 Changesets 自动生成，不需要手动添加 Changeset。

## 版本和发布

Makoo 使用 Changesets 管理版本、CHANGELOG 和 npm 发布。

基本流程：

1. 功能 PR 合并到 `main`。
2. Changesets Release workflow 创建或更新 `Version Packages` PR。
3. 检查并合并 `Version Packages` PR。
4. CI 执行构建、测试，并发布需要发布的 npm 包。

不要手动修改包版本号，除非正在处理 Changesets 生成的版本 PR。

## 文档

文档位于 `apps/docs-website/docs`。修改文档后必须运行：

```bash
pnpm docs:build
```

同时需要亲自查看页面效果，确认内容、导航、排版和链接符合预期。

文档部署由 GitHub Pages workflow 处理。

