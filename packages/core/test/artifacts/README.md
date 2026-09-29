# 阶段 2：产物验证

本目录使用独立 Node/Vitest 配置，文件命名为 `.spec.ts`，不会进入根配置原有的 `.test.ts` 匹配范围。
现有测试文件、根测试配置及其他包测试均未修改。

仓库根目录执行：

```sh
pnpm build:core
pnpm --filter @makoojs/test build
pnpm -C packages/core/test/frameworks install --frozen-lockfile
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

阶段 2 的 metadata 与框架构建案例已通过。Vue SFC + Pinia 3.0.4、React TSX + ReactDOM 通过真实 Makoo 构建链，构建图确认实际依赖参与编译；最终文件使用公共 matcher 检查 metadata、meta/user 一致性和经典脚本语法。所有框架 fixture 和测试仍位于 core/test 内，未改动其他包测试。

框架案例目前使用源码 alias，不是 tarball 消费；构建通过不代表组件、Pinia 状态和点击行为已在浏览器验证。
阶段 1 仍受 Chromium 本地 socket 权限限制，实际安装与交互未验收。
`consumer.spec.ts` 已通过 core 实际 tarball 离线安装、ESM/CJS 导出加载、声明文件存在性和最终脚本构建验证；浏览器完整消费尚待验收。声明检查仅验证文件存在，不等同于独立项目完整类型检查。

新包暂设 `private: true`，API 尚可调整；未生成 changeset 或进行发布。

## 公共 API

构建案例通过 `@makoojs/test/vitest` 的专用 matcher 检查产物。独立 Vitest 配置将公开入口映射到新包 dist，不直接导入 matcher 源码。`matchers.spec.ts` 验证反向断言、诊断和多值比较；底层解析测试仍检查解析数据结构。

## 封装后验证（2026-09-10）

当时 3 个文件、11 个产物/解析/matcher 用例通过；新包生成 ESM/CJS 和类型声明。core 原有 13 文件、210 个测试仍全部通过。Vitest 集成入口采用 ESM，以匹配 Vitest 的加载要求。

`api.types.ts` 仅由专用 `noEmit` 配置检查，不执行测试或生成文件；覆盖 matcher 补全、反向/异步断言、E2E 页面和构建配置的类型，以及错误参数拒绝。声明构建保留 `import 'vitest'`，保证消费 dist 时类型扩展仍有效。

## 阶段 2 验证（2026-09-22）

5 个文件、16 个测试通过，包括超时清理、相对资源、两种框架实际构建与语法故障检查。框架依赖在 `../frameworks` 独立安装并固定版本；不会增加 core 发布依赖。

阶段 3 产物侧新增 tarball 案例后共 6 文件、17 个测试通过。该案例需要先执行 `pnpm build:core`，使用本机 npm 打包和离线安装，不发布包、不执行安装脚本。

## 阶段 4 独立接入验证

`standalone.spec.ts` 消费测试包本身的 tarball，在仓库外的临时项目验证可选 peer 边界、产物 matcher、E2E 用例发现，以及 NodeNext/Bundler 声明消费。测试包无源码 alias；runner 和 TypeScript 显式复用本机固定工具链，不代表全新机器安装验收。可复制的普通 userscript 示例和命令见 `../standalone/README.md`。

## 阶段 3 行为产物补充

`behaviors.spec.ts` 新增 4 项检查：构建 alive、匹配/排除和 GM 存储产物，使用专用 matcher 检查声明与语法；在 jsdom 中执行最终 alive 产物，验证连续两次恢复、重复挂载防护及旧按钮监听清理。禁用 alive 后恢复断言失败，移除 exclude 后 metadata 断言失败。此补充没有模拟 GM API，管理器语义仍由 E2E 验证。
