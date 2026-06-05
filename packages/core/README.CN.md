# @makoojs/core

`@makoojs/core` 是 Makoo 的框架无关运行时内核。它负责注入任务的注册与调度、等待目标 DOM、挂载 artifact、管理 alive 重注入、绑定事件监听器，并提供生命周期观察事件、日志和错误基础设施。

项目应该从 `@makoojs/cli` 开始，它负责提供 Vite 插件、扫描 `injections` 目录、解析 manifest、生成userscript 入口代码，并把配置透传给 [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 完成开发、构建和安装流程。`@makoojs/core` 是更底层的运行时包，只有在你想脱离 Makoo 的 CLI 流程，手动集成注入运行时时，才需要直接使用它。`@makoojs/vue` 和 `@makoojs/react` 则是组件挂载适配器，用来把 Vue 或 React 组件接入 `@makoojs/core` 的注入流程。

> [!NOTE]
> `@makoojs/core`包是其他包的父包，其他的包都直接或间接的依赖该包的类型或功能

## 适用场景

- 编写自定义 `ResolvableMountAdapter`，让 Makoo 能挂载新的 artifact 类型。
- 直接创建 `Injector`，在没有 CLI 扫描和代码生成的环境中手动注册任务。
- 监听注入生命周期事件，用于调试、埋点、错误上报或可视化开发工具。
- 使用 `DOMWatcher`、`createActivityStore` 等底层工具构建更定制的运行时集成。

## 安装

```bash
// npm install @makoojs/core
// yarn add @makoojs/core
pnpm add @makoojs/core
```

## 最小运行时示例

下面的示例展示了 core 的基本路径：创建 `Injector`，注册 adapter，注册 artifact，然后调用 `run()` 等待目标 DOM 并挂载。

```ts
import { Injector, type ResolvableMountAdapter } from '@makoojs/core';

type TextArtifact = {
	kind: 'text';
	text: string;
};

const textAdapter: ResolvableMountAdapter<TextArtifact, HTMLElement> = {
	name: 'text',
	matches(artifact): artifact is TextArtifact {
		return (
			typeof artifact === 'object' &&
			artifact !== null &&
			(artifact as { kind?: unknown }).kind === 'text'
		);
	},
	mount({ mountPoint, artifact }) {
		const el = document.createElement('span');
		el.textContent = artifact.text;
		mountPoint.appendChild(el);

		return { handle: el };
	},
	unmount({ handle }) {
		handle.remove();
	}
};

const injector = new Injector({
	alive: true,
	scope: 'local',
	timeout: 5000
}).applyAdapter(textAdapter);

injector.register('#app', {
	kind: 'text',
	text: 'Hello from Makoo core'
});

injector.run();
```

## Injector 基础

`Injector` 是 core 的主要入口。它把任务注册、DOM 等待、adapter 解析、挂载、事件绑定和生命周期控制组织在一起。

常用方法：

| 方法 | 说明 |
| --- | --- |
| `applyAdapter(adapter)` | 注册一个可解析 artifact 的挂载适配器 |
| `register(injectAt, artifact, options?)` | 注册一个组件或其他 artifact 注入任务 |
| `registerListener(listenAt, event, callback, activitySignal?)` | 注册一个独立 DOM 事件监听任务 |
| `run()` | 开始调度已注册任务 |
| `enableAlive(taskId)` / `disableAlive(taskId)` | 开启或关闭指定组件任务的 alive 重注入 |
| `reset(taskId)` / `destroy(taskId)` | 重置或销毁单个任务 |
| `resetAll()` / `destroyAll()` | 重置或销毁所有任务 |
| `on()` / `onTask()` / `onAny()` | 监听生命周期观察事件 |

`register()` 返回 `taskId`、`isSuccess`，以及当前任务的 `enableAlive()` / `disableAlive()` 快捷方法。

## Adapter Contract

core 不关心 artifact 是 Vue 组件、React 组件还是其他对象。它只要求 adapter 实现统一的挂载协议。

```ts
import type { ResolvableMountAdapter } from '@makoojs/core';

const adapter: ResolvableMountAdapter<MyArtifact, MyHandle, MyInstance> = {
	name: 'my-adapter',
	matches(artifact): artifact is MyArtifact {
		return isMyArtifact(artifact);
	},
	mount(input) {
		// input.host 是 Makoo 创建的宿主元素
		// input.mountPoint 是 adapter 应该挂载内容的位置
		// input.makoo 是当前任务的上下文能力
		return {
			handle,
			instance
		};
	},
	unmount(input) {
		// 根据 input.reason 做清理
	}
};
```

`mount(input)` 会收到：

| 字段 | 说明 |
| --- | --- |
| `host` | Makoo 创建并插入到目标位置的宿主元素 |
| `mountPoint` | adapter 应该挂载内容的节点 |
| `artifact` | 当前被注册的 artifact |
| `taskId` | 当前任务 ID |
| `injectAt` | 当前任务的目标选择器 |
| `makoo` | 当前任务的上下文能力 |

`makoo` 上下文可以让 adapter 内部控制当前任务：

```ts
mount({ makoo }) {
	const off = makoo.onTask('artifact:mountSuccess', (event) => {
		makoo.getLogger().debug('mounted', event.taskId);
	});

	return {
		handle: {
			off
		}
	};
}
```

## 生命周期与 Alive 模式

`alive` 用来处理目标 DOM 被页面重新渲染、删除后又出现的场景。开启后，Makoo 会观察已挂载节点的移除，并在目标选择器重新出现时尝试重新注入。

```ts
const result = injector.register('#toolbar', artifact, {
	alive: true,
	scope: 'global',
	timeout: 8000
});

result.disableAlive();
result.enableAlive();
```

`scope` 支持：

| 值 | 说明 |
| --- | --- |
| `local` | 在当前挂载区域附近观察 DOM 变化 |
| `global` | 在整个 document 范围内观察 DOM 变化 |

`alive` 只适用于组件或 artifact 注入任务。独立 listener 任务不使用 alive 重注入机制。

## Listener 与 Activity Signal

除了挂载 artifact，`Injector` 也可以注册独立 DOM 事件监听任务。

```ts
import { createActivityStore } from '@makoojs/core';

const enabled = createActivityStore(true);

injector.registerListener(
	'#save',
	'click',
	() => {
		console.log('save clicked');
	},
	() => enabled
);

injector.run();

enabled.set(false);
enabled.set(true);
```

`createActivityStore()` 返回一个简单的可订阅布尔状态。传入 listener 后，Makoo 会根据状态自动 attach 或 detach 事件监听器。

> [!NOTE]
> 现在`@makoojs/cli`是无法解析这种listener的挂载形式，只支持**`component+listener`**的形式

## 观察事件

core 会在注册、运行、挂载、listener、alive、DOM watcher 和任务状态变化时发出观察事件。你可以通过 `on()`、`onTask()` 或 `onAny()` 监听它们。

```ts
const off = injector.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, event.injectAt);
});

injector.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopPropagation();
	}
});

off();
```

常见事件包括：

- `register:start`
- `register:success`
- `run:start`
- `run:taskScheduled`
- `artifact:mountStart`
- `artifact:mountSuccess`
- `artifact:mountFail`
- `listener:attached`
- `alive:enabled`
- `alive:observerStarted`
- `task:statusChange`
- `dom:targetFound`
- `dom:targetTimeout`

完整事件名可以从 `OBSERVE_EVENT_NAMES` 获取。

## DOMWatcher

`DOMWatcher` 是 core 的底层 DOM 观察工具。通常你不需要直接使用它，因为 `Injector.run()` 和 alive 模式已经封装了目标等待和恢复逻辑。

在自定义运行时中，可以直接使用：

```ts
import { DOMWatcher } from '@makoojs/core';

const stop = DOMWatcher.onDomReady(
	'#app',
	(el) => {
		console.log('target ready', el);
	},
	document,
	{
		once: true,
		timeout: 5000
	}
);

stop();
```

`DOMWatcher.onDomAlive()` 可以观察一个已存在节点的移除和恢复，主要用于实现重注入能力。

## 日志与错误

core 默认使用 `Logger` 输出带 `[Makoo]` 前缀的日志。你可以传入自定义 logger。

```ts
import { Injector, type ILogger } from '@makoojs/core';

const logger: ILogger = {
	info: console.info,
	warn: console.warn,
	error: console.error,
	debug: console.debug
};

const injector = new Injector({ logger });
```

core 还导出以下错误相关类型：

- `MakooError`
- `AdapterError`
- `TaskError`
- `ErrorCode`
- `MakooIssue`

这些类型适合在自定义集成中做错误识别、日志归类或用户提示。

## 公开能力概览

`@makoojs/core` 的主入口导出以下几类能力：

| 类别 | 代表导出 |
| --- | --- |
| 注入调度 | `Injector`、`InjectionConfig`、`ArtifactOptions` |
| Adapter 协议 | `MountAdapter`、`ResolvableMountAdapter`、`AdapterMountInput`、`AdapterUnmountInput`、`MakooContext` |
| 生命周期观察 | `ObserverHub`、`OBSERVE_EVENT_NAMES`、`ObserveEvent`、`ObserveHook`、`LifecycleHookMap` |
| DOM 观察 | `DOMWatcher` |
| Listener signal | `createActivityStore`、`ActivitySignalSource` |
| 日志 | `Logger`、`ILogger`、`LoggerLevel` |
| 错误 | `MakooError`、`AdapterError`、`TaskError`、`ErrorCode` |

完整 API 参考后续会放到独立文档站中。

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoojs/core` | 框架无关的注入运行时内核 |
| `@makoojs/vue` | Vue adapter 与 Vue 插件注册辅助 |
| `@makoojs/react` | React adapter |
| `@makoojs/cli` | Vite 插件、配置解析、扫描、代码生成和 userscript 构建接入 |
| `@makoojs/create-makoo` | 项目脚手架 |

如果你只是开发普通 userscript 项目，优先使用 `@makoojs/cli`+`@makoojs/core`。如果你要扩展 Makoo 的运行时能力，再直接使用 `@makoojs/core`。
