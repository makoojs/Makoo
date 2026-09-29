# 固定环境 CI 验收

日期：2026-09-29。范围是当前私有测试包与 core 测试入口，不包含发布或其他包测试。

## 运行证据

| 运行 | 提交 | 结果 |
| --- | --- | --- |
| [36510738570](https://github.com/makoojs/Makoo/actions/runs/36510738570) | `2c1e8ed` | 产物检查 26 通过、1 失败；发现临时项目的 CI frozen lockfile 问题，浏览器步骤未运行 |
| [36532564267](https://github.com/makoojs/Makoo/actions/runs/36532564267) | `1ce6442` | 27 项产物测试、正常浏览器组与六组故障检查全部通过；发现 jsdom 关闭后的清理错误 |
| [36533493833](https://github.com/makoojs/Makoo/actions/runs/36533493833) | `2a296a9` | 再次全部通过，jsdom 清理错误已消除；下载 JSON 报告后逐组复核通过 |

两个成功 job 使用独立 runner 和每用例隔离 profile。每轮 8 个正常场景各执行两次，共 16 次正常执行；故障六组包含两项存储用例，共 7 次预期失败。没有跳过、预期失败标记或重试。

第二轮正常组报告耗时 44.88 秒，完整浏览器验收约 128 秒，包含安装与每组 runner 启动；完整 job 约 3 分 20 秒。两轮成功是可重复执行的初步证据，不用于估计长期偶发失败率。

## 已验证版本与行为

- Ubuntu 24.04，Node 24.21.0，pnpm 11.24.0。
- Playwright 1.63.0，Chromium 153.0.8010.12（revision 1243），Violentmonkey 2.49.0 MV3。
- 管理器权限、真实安装、计数更新、销毁及重建、Vue + Pinia、React、core tarball 消费、alive 重挂载及旧监听释放、匹配/排除、GM 持久化与 profile 隔离。
- 缺失产物、错误 match、错误计数、禁用 alive、移除 exclude、跳过存储写入，分别在预期准备或行为断言失败。

主 agent 下载第二轮 `userscript-reports-36533493833-1`（artifact `11016847948`），重新运行七组报告校验，并检查正常组的 16 次通过、故障组的 7 次失败、23 份成功清理附件及全部 `retry=0`。浏览器环境附件记录的版本为 153.0.8010.12。CI 原始执行日志确认每组子进程退出码也通过验收入口检查。

完整 trace 附件为 `userscript-acceptance-36533493833-1`（artifact `11016982770`）。Actions 附件保留 14 天；过期后可对相应提交重新运行 workflow 获取新证据。

## CI 范围

`userscript-acceptance.yml` 对相关 PR（目标 `main`）、相关 push（`main` 与 `feat/test-suite`）和手动调用执行同一验收入口。只读仓库权限，不使用发布凭据；失败保留可用报告。测试仍限定在 core 独立入口，不改变根测试发现规则，也不设置分支保护。

测试包维持私有原型。此结论不覆盖其他操作系统、浏览器或管理器；框架 fixture 使用源码 alias，只有 core 消费案例安装真实 core tarball，CLI 构建链仍来自仓库源码。独立普通 userscript 示例的浏览器测试仅完成用例发现，尚无该示例的真实交互证据。
