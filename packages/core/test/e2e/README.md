# Core E2E 套件使用案例

本目录只保留 core 的构建配置、页面、脚本和业务断言。公共浏览器、HTTP 服务、管理器适配、安装、日志和清理由 `@makoojs/test/playwright` 提供。

仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build:core
pnpm --filter @makoojs/test build
pnpm -C packages/core/test/frameworks install --frozen-lockfile
pnpm -C packages/core/test/e2e install --frozen-lockfile
pnpm -C packages/core/test/e2e exec playwright install chromium
pnpm -C packages/core/test/e2e run prepare:manager
pnpm -C packages/core/test/e2e test
```

本目录通过 `file:../../../test` 消费新包，改动新包后先构建，再执行本目录 `install --force --frozen-lockfile` 刷新本地依赖副本。

## 连续验收入口

完成上述依赖、构建、浏览器和管理器准备后，在 Node 24 环境运行：

```sh
pnpm -C packages/core/test/e2e test:acceptance
```

该入口依次调用 Playwright：先让全部 8 项正常用例各执行两次，再运行缺失产物、错误 match、错误计数、禁用 alive、移除 exclude、跳过存储写入六组故障。它沿用 Playwright JSON reporter，不另造测试执行器或报告格式。

每次运行在 `acceptance-results/run-*` 下保存各组 `report.json`、`runner.log`、Playwright 附件和 trace。正常组首次失败立即停止；必须恰好包含清单中的 8 个场景、单项目 repeatEach=2、每个场景两个完整通过结果，提前停止或跳过不能通过验收。修改场景名称或数量时须同步 `acceptanceReport.ts` 的清单。故障组须同时满足：退出码 1、正确的失败阶段、预期错误或特定 `acceptance:*` 断言标签、测试用例来源（行为故障）、无重试或预期失败标记，以及完成清理的附件。浏览器启动失败、匹配页正向检查失败都不能当成排除页故障检测成功。

任何组不满足要求时，命令返回非零并停止后续组，保留证据供排查。命令会清除外部遗留的两种故障环境变量，再为每组设置对应故障。重复运行产生独立目录，旧报告不参与本次判定。

这个入口可在本机或现有 CI 的单独 job 中运行。目前尚无真实浏览器全部通过的证据，因此没有改动默认测试命令或增加 PR 必跑门禁。当前浏览器权限问题仍需要在允许 Chromium 启动的环境解决。

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

## 阶段 3 用例（2026-09-22）

- `frameworks.spec.ts`：真实管理器安装 Vue SFC + Pinia、React TSX 产物，等待组件出现后连续点击并断言状态更新。
- `consumer.spec.ts`：将本地构建的 core 打成 tarball，在临时项目离线安装后构建最终脚本，安装到管理器并验证点击。消费路径不使用 core 源码 alias；构建工具仍调用仓库 CLI 生产代码，不代表 CLI 发布包已验收。
- `counter.spec.ts`：保留原有计数、销毁及重建行为验证。

独立入口共发现 4 个 E2E 用例。重新检查环境仍无法创建 Unix socket，因此这些真实浏览器行为仍待执行，未接入 CI 必跑，也未将阶段 1/3 标记为完成。

## 阶段 3 行为补齐（2026-09-22）

`behavior.spec.ts` 通过相同的公共 `test.use` / `userscriptPage` API 增加 4 项用例；准备、安装、隔离和清理由测试包负责。独立入口共可发现 8 项用例。

| 场景 | 业务断言 |
| --- | --- |
| `alive` | 连续替换两次宿主节点，每次自动重挂载；按钮只有一个，挂载/卸载次数准确，点击一次只增加一次；保留的旧按钮被实际点击后不再改变计数 |
| 匹配与排除 | 同一 profile 先验证匹配页执行，再访问 exclude 页与不匹配页，最后返回匹配页确认仍执行 |
| GM 存储 × 2 | 两个隔离 profile 使用相同脚本名称、namespace 和存储 key，均从 0 开始；写入后刷新保留值，并可继续更新 |

排除页和不匹配页先等待页面就绪，再等待页面在 `load` 后完成 1000ms 观察窗口，最后检查脚本执行计数仍为 0。该结果只能证明窗口内未执行；观察时长有明确边界，不将瞬时缺少元素当成不执行。正向控制页在前后都必须通过。

GM 用例使用真实的 `GM.getValue` / `GM.setValue`。计数显示在异步写入完成后更新，刷新前等待该显示值，不用 localStorage 或模拟 GM API 代替管理器存储。脚本内的异步错误显示到 `#storage-state`，使就绪断言失败。

在允许 Chromium 启动的环境运行：

```sh
pnpm -C packages/core/test/e2e exec playwright test behavior.spec.ts
MAKOO_BEHAVIOR_FAULT=disable-alive pnpm -C packages/core/test/e2e exec playwright test behavior.spec.ts --grep alive
MAKOO_BEHAVIOR_FAULT=remove-exclude pnpm -C packages/core/test/e2e exec playwright test behavior.spec.ts --grep matching
MAKOO_BEHAVIOR_FAULT=skip-storage-write pnpm -C packages/core/test/e2e exec playwright test behavior.spec.ts --grep storage
```

正常命令应通过，三个故障命令应在对应行为断言失败。故障通过构建配置控制，不在安装后改写产物。故障 E2E 仍待真实执行，没有配置 `test.fail`、跳过或重试来把失败转为成功。

`../artifacts/behaviors.spec.ts` 验证三种真实构建的 metadata 和经典脚本语法。补充的 jsdom 检查直接执行最终 `alive.user.js`，确认连续两次恢复及旧监听清理，并确认禁用 alive 后恢复断言失败。移除 exclude 的产物也会被专用 matcher 拒绝。这些结果不替代管理器安装、GM 存储与页面匹配语义验收。
