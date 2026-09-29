# Core E2E 套件使用案例

本目录只保留 core 的构建配置、页面、脚本和业务断言。公共浏览器、HTTP 服务、管理器适配、安装、日志和清理由 `@makoojs/test/playwright` 提供。

仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build:core
pnpm --filter @makoojs/test build
pnpm -C packages/core/test/e2e install --frozen-lockfile
pnpm -C packages/core/test/e2e exec playwright install chromium
pnpm -C packages/core/test/e2e run prepare:manager
pnpm -C packages/core/test/e2e test
```

本目录通过 `file:../../../test` 消费新包，改动新包后先构建，再执行本目录 `install --force --frozen-lockfile` 刷新本地依赖副本。

`counter.spec.ts` 使用公开的 `test.use` 配置 HTML 与构建回调。套件提供安装好的 `userscriptPage`；案例检查页面就绪、脚本启动、点击计数、销毁后停止响应和重新绑定不重复计数。页面中的独立观察器确认销毁后的点击确实已分发。

固定环境：Playwright 1.63.0 / Chromium revision 1243（Chrome for Testing 153.0.8010.12），Violentmonkey 2.49.0 MV3。

## 验证边界

- 真实用户脚本构建已通过。
- 当前环境创建 Unix socket 返回 EPERM，Chromium 在扩展加载前退出；安装与业务行为未验证。
- 公共 API 能加载、发现案例，不等于浏览器执行通过。
- UI 适配依赖 Chromium 的用户脚本开关和暴力猴确认页，仍需要真实运行验证。
- 不依赖管理器内部 E2E Harness，不通过脚本注入代替真实管理器。
- 不接入默认 Vitest 入口，不修改其他包测试。

## 故障入口

```sh
MAKOO_E2E_FAULT=install pnpm -C packages/core/test/e2e test
MAKOO_E2E_FAULT=match pnpm -C packages/core/test/e2e test
MAKOO_E2E_FAULT=count pnpm -C packages/core/test/e2e test
```

`install` 返回不存在的产物路径，应在 artifact 准备阶段失败；`match` 在构建前排除目标页，脚本启动断言应失败；`count` 使用错误计数预期，交互断言应失败。
三个命令均应返回非零退出码。后两项仍需正常浏览器环境验证，不标记预期失败来掩盖问题。

套件将最后阶段、产物和日志放入 Playwright 附件，浏览器启动后保留 trace；finally 关闭浏览器、服务并清理临时目录。报告在本目录 `test-results` / `playwright-report`。

## 封装后验证（2026-09-10）

通过公开包入口发现 1 个 E2E 案例。缺失产物故障返回非零退出码，报告记录 `Last stage: artifact`，检查 `/tmp/makoo-userscript-*` 无残留。安装及交互仍未实测，不能据此标记阶段 1 完成。
