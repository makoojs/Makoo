# Userscript 测试体系：阶段 0 基线与用例决策

日期：2026-09-09。对应 `Makoo-Userscript-Test-Plan.md` 的 Phase 0。

## 状态与工作边界

- [x] fetch 远端分支，确认当前基线与并行开发差异。
- [x] 静态盘点现有测试环境和关键缺口。
- [x] 仅运行 core 测试，记录结果与耗时。
- [x] 确定首批 fixture、业务断言及公共工具边界。

阶段 0 完成；真实管理器接入、产物构建实验及 CI 重复性仍属于后续阶段，尚未验证。
当前约束：所有测试新增、修改和实验只能在 core 范围内进行；其他包测试只读。
本次仅新增本记录，没有修改测试代码、共享配置、依赖声明或锁文件，也没有运行其他包测试。
未来框架用例在本文中只是设计，不能据此直接修改 vue、react、cli 等包的测试。

## 1. 代码基线与远端变化

已执行 `git fetch --all --prune`。

| 引用 | 提交 | 本次用途 |
| --- | --- | --- |
| 当前 `feat/test-suite` | `f186a4911033adbbb0a35e770b403e9cca2cf0b1` | 实测基线 |
| `origin/main` | `f186a4911033adbbb0a35e770b403e9cca2cf0b1` | 与当前分支一致 |
| `origin/feat/test-suite` | `f186a4911033adbbb0a35e770b403e9cca2cf0b1` | 当前远端特性分支 |
| `origin/feat/runtime-inspector` | `592672855b8bd04817be64baaf8b8f248613ed74` | 只读审查，未合并 |

fetch 输出确认 runtime-inspector 从 `d4e915a` 更新到 `5926728`。其他分支的最新提交不能直接当作已合并的主分支代码。

并行分支中与本计划有关的变化：

- `packages/core/src/Task/TaskLifeCycle.ts`：`destroyAll` 改为逐任务调用 `destroy`；对应 core 测试增加逐任务销毁事件断言。后续清理用例应检查实际清理结果，避免固化旧的内部调用方式。
- `packages/core/vite.config.ts` 与根 `vite.config.ts`：将 `__dirname` 改为 `import.meta.dirname`。本次基线仍使用原配置，并出现相关 Vite 警告。
- CLI 构建、开发会话、metadata 相关配置及集成测试有变化。开始产物 fixture 时应重新核对当时实际分支，不能照搬本次主分支的配置预期。

未 cherry-pick 或合并该分支，以免同时引入其他包测试变动。

## 2. 现有测试盘点

以下数量来自当前基线的 `packages/*/test/**/*.test.ts` 文件枚举，非执行统计。

| 包 | 测试文件数 | 已查看的证据与边界 |
| --- | ---: | --- |
| core | 13 | 任务注册、运行、生命周期、DOMWatcher、事件、错误等；源码与 jsdom 路径 |
| cli | 9 | `test/integration/build.test.ts` 构建临时入口并检查文件、name 和代码字符串；不是管理器执行 |
| vue | 3 | `VueAdapter.test.ts` 使用真实 Vue 挂载；`VuePlugin.test.ts` 检查注册去重和清空，未形成 SFC + 实际插件产物交互链路 |
| react | 3 | `ReactAdapter.test.ts` mock `react-dom/client` 的 render/unmount；不能证明最终 React DOM 交互 |
| create-makoo | 5 | 模板和创建工具测试；本次不运行 |

配置与依赖证据：

- 根 `vite.config.ts` 默认 `environment: 'jsdom'`，并将 `@makoojs/*` 别名指向源码。没有独立产物/E2E 测试项目配置。
- core 测试还使用相对路径导入源码；`test/factory/TaskFactor.ts` 默认使用 VueAdapter。仅运行 core 测试不等于依赖图只包含 core，但不会执行 Vue 测试文件。
- `DomWatcher.test.ts` 已有 jsdom MutationObserver 测试；`TaskRunner.test.ts`、`TaskLifeCycle.test.ts` 部分路径 stub DOMWatcher。不能笼统地说“现有测试都是 mock”或“完全没有行为测试”。
- `packages/core/package.json` 导出 `dist` 下 ESM、CJS 和类型；源码路径通过不能证明这些发布入口可消费。
- 当前 CI 顺序为安装、构建、`pnpm test`、文档构建。构建后再执行源码测试，也不会自动变成发布包消费测试。
- 当前根/包依赖与 CI 未配置 Playwright 管理器 E2E 路径。

## 3. 实测结果与复现

环境：Node `v24.19.0`、实际 pnpm `11.19.0`。仓库声明 pnpm `11.24.0`，此差异保留记录；本次没有改声明。CI 声明 Node 24。
锁定安装结果：Vitest `4.1.7`、Vite `8.2.2`、jsdom `28.1.0`。

在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run packages/core/test
```

| 项目 | 结果 |
| --- | --- |
| 安装 | 成功，pnpm 报告约 21 秒；下载存在慢请求 |
| 退出码 | 0 |
| 测试文件 | 13 passed |
| 用例 | 210 passed |
| Vitest Duration | 2.21 秒 |
| tests | 639 毫秒 |
| transform / import / environment | 2.31 / 3.24 / 7.36 秒，为并行累计项，不能相加当作总耗时 |
| 警告 | 根 Vite 配置使用 `__dirname`，未来 native config loader 不支持该写法；本次未阻止执行 |

这是依赖安装后的一次本地运行，不是性能基准、稳定性保证或 CI 耗时预测。没有测量全仓测试耗时、真实构建或浏览器启动耗时；其他包测试未运行。

## 4. 首版要发现的遗漏

| 具体回归风险 | 当前证据不足的原因 | 新体系的通过条件 |
| --- | --- | --- |
| metadata 丢失重复字段、本地化值，或 meta/user 输出不一致 | 现有构建案例仅断言少量字符串 | 从真实构建结果解析字段，按输入配置检查值和多值保留 |
| 脚本成功打包但匹配不到页面、安装失败或不能执行 | jsdom 不处理扩展安装及匹配语义 | 固定管理器自动安装最终文件，在匹配页面看到脚本产生的结果 |
| 点击监听在打包后不工作或销毁后仍响应 | 源码行为不能证明最终执行环境 | 点击只增加一次；销毁后继续点击不再增加；重建后无重复监听 |
| 节点替换后不能恢复或重复挂载 | 部分观察链被 stub，未走管理器环境 | 替换 host 后恰好一个实例，交互正常，旧实例资源已清理 |
| 框架插件注册了但未应用到实际应用 | 注册断言不验证插件运行后的页面 | 真实 SFC/TSX 构建后交由管理器执行，插件数据及交互可见 |
| 发布包导出或依赖漏配 | 测试直接消费源码 | 独立临时项目安装实际 tarball 后构建并执行 |

这些是需要覆盖的风险，不代表已经复现了对应产品缺陷。

## 5. 首批 fixture 决策

### 第一条真实运行路径：core-counter

后续实验目录限定在 `packages/core/test/` 下，使用独立入口和配置；不修改根测试发现规则，也不借用其他包的测试 helper。

项目组成与职责：

- 本地 HTTP 页面：提供 `#increment`、`#count`、`#dispose`、`#restart` 与页面就绪标识。
- 用户脚本入口：使用公开 `createMakoo` / `listen` API 绑定点击，显示计数；暴露可由页面控件触发的销毁与重建行为。测试通过 DOM 交互观察结果，不依赖跨沙箱读取内部 runtime。
- 真实构建配置：通过 Makoo 构建链生成 `.user.js`，构建前传入本地服务端口及 match。允许读取构建包的生产 API，不复制或修改它的测试。
- 明确使用源码构建还是 tarball 消费；初期即使使用源码也必须执行其最终产物，发布消费证据留到专门案例。
- 浏览器流程：新 profile → 加载管理器 → 自动安装产物并确认 → 打开页面 → 执行断言 → finally 清理。

业务断言顺序：

1. 等待页面就绪和脚本特有的已启动标记，两者分开。
2. 初始计数为 0，点击一次为 1，再点击一次为 2。
3. 触发脚本提供的销毁操作，等待销毁完成标记；点击不再增加计数。
4. 触发重建，等待完成标记；每次点击只增加 1。
5. 若安装或启动阶段失败，直接报告该阶段失败，不能跳过行为断言后算通过。

销毁控件的驱动通道应独立于被销毁的业务监听，避免测试失去后续控制；页面只承载该 fixture 的协议，不将这个协议包装成通用测试包 API。
否定断言在确认动作已分发、页面仍可交互后检查，并明确观察窗口；不能只等待一个任意 timeout。

阶段 1 先跑通此项目的安装与点击，再扩展清理行为。通过加载本身不能验收。

### 后续项目与先后顺序

| 项目 | 设计输入 | 必须观察的结果 | 时机 |
| --- | --- | --- | --- |
| metadata-output | 已知 name、本地化字段、多条 match、exclude，以及按案例配置的 grant/require/resource、meta 输出选项 | 字段值与多值一致，文件符合配置，meta/user 相关字段一致；删掉预期字段时检查失败 | Phase 2 |
| core-alive | core + 最小真实 DOM adapter，挂载按钮并实际移除监听；配置 alive | host 替换后恢复一个实例，旧监听清理；停用 alive 后不会恢复 | Phase 3；不称为框架兼容验证 |
| vue-plugin-counter | 真实 Vue SFC + 一个实际状态插件，具体依赖在实施时固定版本 | 插件状态可读，按钮更新页面；不是只断言注册表 | Phase 2 构建 / Phase 3 执行；本次不新增 |
| react-counter | 真实 React TSX 与 ReactDOM | 初始 DOM 与点击更新，无 render mock | Phase 2 构建 / Phase 3 执行；本次不新增 |
| manager-match-storage | 匹配/排除页面、基础 GM 存储 | 匹配页执行；排除页在页面就绪后不执行；同一 profile 刷新保留值，新 profile 隔离 | Phase 3 |
| package-consumer | 干净临时项目安装实际 tarball，无源码 alias | 导出、依赖、构建与最终执行均成功 | Phase 3 |

真实第三方插件的版本、安装与构建成本尚未验证，不将其视为已就绪。当前 core 约束持续有效，实施框架测试前需要遵守当时的工作范围。

## 6. 公共能力与专用用例

| 可逐步沉淀到 `@makoojs/test` | 留在 Makoo 用例中 |
| --- | --- |
| 接收现成 `.user.js` 的读取与 metadata 解析，保留多值 | 哪些字段应由 Makoo 配置生成 |
| 临时目录、可选构建调用、输出与错误收集 | fixture 源码、构建选项与框架插件选择 |
| 浏览器/profile、本地服务、安装与清理准备 | counter、alive、生命周期与插件业务断言 |
| 少量管理器适配及失败证据 | 具体测试页面和场景控制协议 |

最小使用方式暂以数据流确定：产物测试“文件路径 → metadata 数据 → Vitest 断言”；E2E“文件路径 + 平台配置 → 已安装脚本的隔离浏览器与页面 → Playwright 断言”。
构建辅助可选。此时不承诺函数名、继承体系、跨管理器能力矩阵或统一 runner。

管理器是可替换平台；不导入 ScriptCat 或其他管理器内部 E2E Harness。阶段 1 根据自动安装、固定版本获取、CI 可运行性选一个平台，现阶段不预选。

## 7. 下一阶段交接

阶段 0 验收结论：已明确当前可复现基线、遗漏的具体风险、首个 core 项目及公共工具边界，可以进入阶段 1。

进入阶段 1 时：

1. 核对 main 与并行分支进展，尤其生命周期和构建配置变化。
2. 选择并固定一个真实管理器及浏览器版本，记录获取来源和安装入口。
3. 在 core 范围内实现 core-counter 原型与独立运行入口，先证明自动安装和点击结果。
4. 用安装失败、错误 match 或错误预期计数检查关键失败能被报告，实验仍限定 core。
5. 验证失败路径清理，随后在干净 CI 环境验证重复性；未经实测不声称 CI 就绪。

本次没有新建公共测试包或改动生产代码，也没有进行阶段 1 的浏览器实验。
