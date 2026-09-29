# Userscript 测试体系进度

更新时间：2026-09-29。测试、fixture 和实验均限定在 core/test；公共实现位于 packages/test。原有测试入口未改动。

| 阶段 | 状态 | 已提交范围 / 下一项 |
| --- | --- | --- |
| 0 基线 | 完成 | `b5eff66`：基线、缺口、首批用例与验收条件 |
| 1 真实运行原型 | 首轮真实浏览器验收通过 | 公共 fixture、管理器权限、安装、core-counter 交互及清理已在 GitHub runner 验证；继续核对独立 CI 重复性 |
| 2 产物与框架 fixture | 当前首批案例通过 | metadata、清理、Vue SFC + Pinia、React TSX、经典脚本语法及独立消费共 27 项通过 |
| 3 E2E 与包消费 | 首轮完整运行验收通过 | 8 场景各执行两次；六组故障全部命中预期失败；继续核对独立 CI 重复性 |
| 4 公共 API 收敛 | 当前接口与独立接入验证完成 | `d26d63b`：公开类型、NodeNext 声明修复、独立项目消费与文档；仍为私有原型，不作为发布或稳定性承诺 |

## 当前证据

- 公共产物 API：`readUserscript` + Vitest 自定义 matcher，无需启动管理器。
- core 独立产物入口：完整运行 9 个文件、27 项全部通过，包含行为、验收报告与独立包消费检查。
- core 发布产物：真实 npm pack / 离线安装，验证 ESM/CJS 导出并构建最终 userscript；不使用 core 源码 alias。
- 框架构建：真实 Vue、Pinia、React/ReactDOM 进入构建；这些 fixture 使用 Makoo 源码 alias，不与发布消费证据混淆。
- Playwright 独立入口：8 个用例可发现，包含原 core-counter、Vue、React、core tarball、alive、匹配/排除及两项隔离存储检查。
- 测试包 tarball 独立消费已通过；产物断言和 NodeNext/Bundler 类型检查使用公开入口，工具链复用范围见 `PHASE-4.md`。
- CommonJS `.cts` 类型消费通过独立 tarball 项目的 NodeNext 检查，错误参数可被拒绝；已经 GPT-6 Sol review 和主 agent 核验。
- 最终 alive 产物在 jsdom 中通过两次重挂载及旧监听清理检查，禁用 alive 会被恢复断言拒绝。该证据不代表真实管理器执行。
- 本地 Unix socket 与 Chromium 限制仍存在。2026-09-29 改用 GitHub Ubuntu 24.04 runner 后，[运行 36532564267](https://github.com/makoojs/Makoo/actions/runs/36532564267) 在提交 `1ce6442` 上完整通过：27 项产物检查、16 次正常浏览器执行、六组故障共 7 次预期失败检查。验收入口逐组确认阶段、断言来源和清理附件。
- 该轮基线耗时约 46 秒，完整浏览器验收约 128 秒；证据附件 `userscript-acceptance-36532564267-1` 在 Actions 保留 14 天。这是固定环境的首轮成功，尚不代表长期无偶发失败。
- 新增独立 `test:acceptance` 命令，验证完整场景重复执行与六组故障，保留 Playwright JSON 报告；经过 GPT-6 Sol review、主 agent 核验修正及复审，详见 `REVIEW-2026-09-28.md`。

## 后续验收

独立验收 workflow 已成功运行：仅 `feat/test-suite` 的相关 push 和手动调用触发，不接入默认 CI 或 PR 门禁。

1. 收尾首轮 CI 暴露的 jsdom 关闭顺序问题，单独上传便于核验的 JSON 报告。
2. 再次完整执行独立 CI，核对每项正常场景、故障命中和清理证据。
3. 根据重复执行结果接入独立 PR 检查；不以重试或跳过掩盖失败。

每个阶段或可独立审查的阶段增量单独 commit；提交代码不等于通过该阶段的全部验收。未创建 changeset、未发布包。
