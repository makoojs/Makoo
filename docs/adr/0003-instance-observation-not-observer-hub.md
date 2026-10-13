# 用实例观察补缺口，不恢复 ObserverHub

第 3 项（hook 与对外 observer）决定：单注入的当前相继续只通过 Status Handle / StateView 观察；Core Instance 上增加封闭的只读 `observe`，在事实提交后再同步投递少量 Observation Notice（`injection-removed`、`instance-disposed`、`diagnostic`）。不恢复旧的 `createObserverHub` / `ObserveEvent` 事件总线，不在声明上提供用户生命周期 hook，也不把 `observe` 暴露进已挂载组件。

选择这条路，是因为旧 Hub 把生命周期推成可发射、可拦截的并行叙事，容易变成第二套调度；新 Core 内部已是领域直调 + `status.set`，对外只需补 Status Handle 表达不了的实例级事实。`observe` 回调允许同步重入 `command` / `remove` / `dispose`，但必须先提交事实再通知、使用订阅者快照、同一次 dispose 只产生一条 `instance-disposed`，且 diagnostic 不无限套娃；观察不得成为 Core 的调度引擎。入门文档以 `statusHandle` / `command` 为主路径，`observe` 留给进阶脚本与 CLI。
