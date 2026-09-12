# Core API

从 `@makoojs/core` 导入运行时 API。按你正在处理的对象选择参考页；首次使用请先阅读[快速开始](../docs/getting-started.md)。

## API 索引

| API | 用途 |
| --- | --- |
| <span id="createmakoo">[`createMakoo()`](./runtime.md#createmakoo)</span> | 创建 Runtime |
| <span id="inject">[`inject()`](./runtime.md#inject)</span> | 声明组件任务 |
| <span id="listen">[`listen()`](./runtime.md#listen)</span> | 声明监听任务 |
| <span id="任务类型">[任务类型](./runtime.md#任务类型)</span> | 任务声明与运行句柄 |
| <span id="startedtasks">[`StartedTasks`](./runtime.md#startedtasks)</span> | 本次启动的任务句柄 |
| <span id="artifactoptions">[`ArtifactOptions`](./runtime.md#artifactoptions)</span> | 组件任务选项 |
| <span id="createobserverhub">[`createObserverHub()`](./observation.md#createobserverhub)</span> | 创建生命周期事件中心 |
| <span id="createactivitystore">[`createActivityStore()`](./observation.md#createactivitystore)</span> | 创建可订阅状态 |
| <span id="观察类型">[观察类型](./observation.md#观察类型)</span> | 事件载荷和回调类型 |
| <span id="signal-类型">[Signal 类型](./observation.md#signal-类型)</span> | 可订阅状态源 |
| <span id="adapter-类型">[Adapter 类型](./adapters.md#adapter-类型)</span> | 组件挂载协议 |
| <span id="makoocontext">[`MakooContext`](./adapters.md#makoocontext)</span> | 组件内的任务控制 |
| <span id="domwatcher">[`DOMWatcher`](./utilities.md#domwatcher)</span> | 等待元素与观察节点替换 |
| <span id="domwatcher-ondomready">[`DOMWatcher.onDomReady()`](./utilities.md#domwatcher-ondomready)</span> | 等待目标元素 |
| <span id="domwatcher-ondomalive">[`DOMWatcher.onDomAlive()`](./utilities.md#domwatcher-ondomalive)</span> | 观察目标移除与恢复 |
| <span id="logger">[`Logger`](./utilities.md#logger)</span> | 输出带等级的日志 |
| <span id="错误类">[错误类](./utilities.md#错误类)</span> | 任务、挂载和状态源错误 |
| <span id="makooerror">[`MakooError`](./utilities.md#makooerror)</span> | 错误码、摘要与上下文 |
| <span id="常量">[常量](./utilities.md#常量)</span> | 监听操作、事件名与错误码 |
| <span id="errorcode">[`ErrorCode`](./utilities.md#errorcode)</span> | 错误码常量 |
| <span id="action">[`Action`](./utilities.md#action)</span> | 监听器开关操作 |
| <span id="observe-event-names">[`OBSERVE_EVENT_NAMES`](./utilities.md#observe-event-names)</span> | 生命周期事件名 |
| <span id="日志类型">[日志类型](./utilities.md#日志类型)</span> | 日志接口和等级 |
| <span id="错误类型">[错误类型](./utilities.md#错误类型)</span> | 错误详情与上下文类型 |
