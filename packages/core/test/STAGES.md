# Userscript 测试体系进度

更新时间：2026-09-22。测试、fixture 和实验均限定在 core/test；公共实现位于 packages/test。原有测试入口未改动。

| 阶段 | 状态 | 已提交范围 / 下一项 |
| --- | --- | --- |
| 0 基线 | 完成 | `76bcd5f`：基线、缺口、首批用例与验收条件 |
| 1 真实运行原型 | 实现已提交，运行验收阻塞 | `4ec8d70`：公共 fixture、管理器适配、core-counter；需在允许 Chromium 启动的环境验证安装、点击及 CI 重复性 |
| 2 产物与框架 fixture | 当前首批案例通过 | `21ac2c6`：metadata 与清理回归；`0d8204f`：Vue SFC + Pinia、React TSX、经典脚本语法断言 |
| 3 E2E 与包消费 | 已开始，部分验证通过 | core tarball 离线消费与构建通过；框架和 tarball E2E 已编写，浏览器执行待验收 |
| 4 公共 API 收敛 | 待阶段 3 反馈 | 已有 API 为私有原型，不作为发布或稳定性承诺 |

## 当前证据

- 公共产物 API：`readUserscript` + Vitest 自定义 matcher，无需启动管理器。
- core 独立产物入口：6 个文件、17 个测试通过。
- core 发布产物：真实 npm pack / 离线安装，验证 ESM/CJS 导出并构建最终 userscript；不使用 core 源码 alias。
- 框架构建：真实 Vue、Pinia、React/ReactDOM 进入构建；这些 fixture 使用 Makoo 源码 alias，不与发布消费证据混淆。
- Playwright 独立入口：4 个用例可发现，包含原 core-counter、Vue、React 和 core tarball。
- 2026-09-22 重查 Unix socket 仍返回 EPERM。没有真实浏览器通过或 CI 通过的证据。

## 后续验收

1. 在支持 Chromium 的环境运行阶段 1 及已有阶段 3 用例，修复安装或行为问题。
2. 补关键 alive 重挂载、匹配/排除和 GM 存储用例，保持业务断言与平台准备分离。
3. 测量稳定性后接入独立 CI，不以重试或跳过掩盖失败。
4. 完成后再根据重复代码收敛 API，并验证独立 userscript 项目接入。

每个阶段或可独立审查的阶段增量单独 commit；提交代码不等于通过该阶段的全部验收。未创建 changeset、未发布包。
