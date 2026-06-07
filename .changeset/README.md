# Makoo Changesets 使用说明

这个目录用于保存还没有被消费的 Changeset。Makoo 使用 Changesets 管理
`packages/*` 下各个 npm 包的版本、CHANGELOG 和发布流程。

当前发布策略是独立版本：

- `@makoojs/core`
- `@makoojs/cli`
- `@makoojs/vue`
- `@makoojs/react`
- `@makoojs/create-makoo`

根包和文档站点是 private package，不参与版本和发布。

## 什么时候需要写 Changeset

只要一次改动会影响 npm 包的使用者，就应该写 Changeset：

- 修复 bug
- 新增功能
- 调整公开 API
- 改变 CLI 行为
- 改变构建产物、导出字段或包依赖关系

下面这些通常不需要写 Changeset：

- 只改文档
- 只改测试
- 只改内部 CI 或工具配置
- 不影响发布包行为的重构

## 如何创建 Changeset

在功能分支上运行：

```bash
pnpm changeset
```

按提示选择受影响的包、版本类型，并填写变更说明。命令会在 `.changeset/`
目录下生成一个 Markdown 文件。这个文件应该和本次代码改动一起提交。

## 如何选择版本类型

选择版本时以用户感知为准：

- `patch`：修复 bug，或不改变现有使用方式的小改动。
- `minor`：新增能力，且保持向后兼容。
- `major`：破坏性变更，用户需要改代码或改配置。

如果一次改动影响多个包，应该在同一个 Changeset 中选择所有受影响的包。
例如 core 的公开行为变化同时影响 React/Vue adapter 时，应同时选择相关包。

## CI 如何处理版本和 CHANGELOG

Changeset 文件合并到 `main` 后，`Changesets Release` workflow 会运行。

如果存在未消费的 Changeset，CI 会自动创建或更新 `Version Packages` PR。
这个 PR 会执行：

```bash
pnpm version-packages
```

也就是：

```bash
changeset version
```

它会自动完成：

- 更新相关包的 `package.json` 版本号
- 更新相关包的 `CHANGELOG.md`
- 删除已经消费掉的 `.changeset/*.md`
- 更新 lockfile 中的版本信息

检查并合并 `Version Packages` PR 后，CI 会再次触发并执行：

```bash
pnpm release
```

这个命令会构建、测试，并发布需要发布的 npm 包。

## 本地手动发版流程

通常不需要手动发版，优先走 CI。确实需要本地处理时，可以按下面顺序：

```bash
pnpm version-packages
pnpm install
pnpm release
```

注意：`pnpm release` 会执行真实 npm 发布，请确认 npm 登录状态、版本和
CHANGELOG 都正确后再运行。

## 常用命令

```bash
pnpm changeset
pnpm changeset status
pnpm version-packages
pnpm release
```

更多说明可以参考 Changesets 官方仓库：

https://github.com/changesets/changesets
