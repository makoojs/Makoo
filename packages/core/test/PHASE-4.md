# Phase 4：公共 API 与独立接入

日期：2026-09-22。

本阶段完成 API 整理、最小示例和独立包消费检查。阶段 1/3 的真实浏览器验收仍待完成，不能据此宣称整个测试体系已验收。

## 公开边界

- 根入口提供产物读取，`/metadata` 提供字符串解析。
- `/vitest` 提供 userscript 专用 matcher、类型扩展和诊断。
- `/playwright` 提供 `test`、`expect`、`prepareManager`、构建输入与用户 fixture 类型。内部资源 fixture 从公开类型中移除。
- 不增加 runner、管理器或框架抽象；现有入口足够覆盖当前用例。
- 修复声明文件相对导入缺少扩展名的问题。独立 NodeNext 项目原先报 TS2834/TS2835，修复后无需源码 alias 或 `skipLibCheck`。

## 独立项目证据

`standalone` 是普通 userscript 项目，使用真实包入口和领域断言，不依赖 Makoo core/CLI。

`artifacts/standalone.spec.ts` 在仓库外的临时目录安装测试包 tarball，首先禁用自动 peer 安装与全局模块查找，确认未安装 runner/core 时读取、解析的 ESM/CJS 导出仍正常工作。随后显式链接仓库工具链，运行产物 matcher、加载 E2E 案例，并以 TypeScript 5.9.3 检查 NodeNext 与 Bundler 的公开类型。

测试包始终来自 tarball；工具链复用本机安装，不把该结果当成全新机器的联网安装验收。E2E 仅执行用例发现，不把发现成功当成页面交互通过。

## 本轮验证

| 检查 | 结果 |
| --- | --- |
| 测试包构建 | ESM/CJS 与声明生成通过 |
| core 独立产物入口 | 7 文件、18 用例通过，约 15.16 秒 |
| core 原有入口 | 13 文件、210 用例通过 |
| 独立项目类型 | NodeNext/Bundler 通过，包含错误参数拒绝 |
| 仓库公开 API 类型 | `noEmit` 检查通过 |
| 改动文件格式与 diff | Biome、`git diff --check` 通过 |

新增验证和示例全部位于 `packages/core/test`，默认测试入口、其他包测试和根锁文件未改。测试包保持私有，不发布、不生成 changeset；阶段提交不包含任务前已有的 Logo 改动。

## 后续验收缺口

- 在允许 Chromium 启动的环境验证管理器安装、页面交互和可重复运行。
- 补齐阶段 3 中匹配/排除、基础 GM 持久化与 `alive` 自动重挂载等场景的验收证据。
- 根据实际运行结果选择 CI 必跑项；当前没有将未经浏览器验收的用例接为必跑门禁。
- CommonJS 类型消费及其他 Node、runner、管理器版本不在本轮验证范围。

使用、支持范围和排错说明见 `packages/test/README.md`；可复制示例见 `packages/core/test/standalone/README.md`。
