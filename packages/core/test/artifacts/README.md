# 阶段 2：产物验证

本目录使用独立 Node/Vitest 配置，文件命名为 `.spec.ts`，不会进入根配置原有的 `.test.ts` 匹配范围。
现有测试文件、根测试配置及其他包测试均未修改。

仓库根目录执行：

```sh
pnpm build:core
pnpm --filter @makoojs/test build
pnpm exec vitest run --config packages/core/test/artifacts/vitest.config.ts
pnpm exec tsc --project packages/core/test/artifacts/tsconfig.types.json
```

## 已实现

- `packages/test` 新包提供字符串解析和文件读取，不依赖浏览器。
- 解析测试覆盖多值、本地化、无值字段、自定义字段、源位置、CRLF、结构错误和代码区伪 metadata。
- 真实构建调用 Makoo CLI 的生产 Vite 插件，入口使用 core API；不复制或修改 CLI 测试。
- 分别检查启用/关闭 meta 文件输出时的文件集合，按配置断言 name、version、match、exclude、grant、require、resource。
- 对比 `.meta.js` 与 `.user.js` 的结构化字段。
- 删除真实产物的一条 match 后，同一检查必须失败。
- 每个构建使用临时 root 和 finally 清理，不改变进程 cwd。

require/resource 使用固定 fixture URL，仅检查配置输出；这些测试不下载或执行其内容。
当前通过的是编译产物约定，不能作为浏览器、GM API 或管理器匹配语义的通过证据。

## 剩余事项

阶段 2 的产物部分已实现。Vue SFC、React TSX 与实际插件项目按当前范围约束暂缓；完整阶段 2 尚未验收。
阶段 1 仍受 Chromium 本地 socket 权限限制，实际安装与交互未验收。
包导出构建可检查，但实际 tarball 安装和浏览器完整消费留在后续阶段。

新包暂设 `private: true`，API 尚可调整；未生成 changeset 或进行发布。

## 公共 API

构建案例通过 `@makoojs/test/vitest` 的专用 matcher 检查产物。独立 Vitest 配置将公开入口映射到新包 dist，不直接导入 matcher 源码。`matchers.spec.ts` 验证反向断言、诊断和多值比较；底层解析测试仍检查解析数据结构。

## 封装后验证（2026-09-10）

3 个文件、11 个产物/解析/matcher 用例通过；新包生成 ESM/CJS 和类型声明。core 原有 13 文件、210 个测试仍全部通过。Vitest 集成入口采用 ESM，以匹配 Vitest 的加载要求。

`api.types.ts` 仅由专用 `noEmit` 配置检查，不执行测试或生成文件；覆盖 matcher 补全、反向/异步断言、E2E 页面和构建配置的类型，以及错误参数拒绝。声明构建保留 `import 'vitest'`，保证消费 dist 时类型扩展仍有效。
