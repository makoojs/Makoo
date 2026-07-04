# @makoojs/core

`@makoojs/core` 是 Makoo 的框架无关运行时核心。它负责声明注入任务、启动任务批次、等待目标 DOM、挂载 artifact、管理 alive 重新注入、绑定事件监听，并提供生命周期观察、日志和错误基础设施。

普通项目通常从 `@makoojs/cli` 开始。只有在你想绕过 CLI 生成入口、手动集成运行时时，才需要直接使用 core。

> [!NOTE]
> `@makoojs/core`包是其他包的父包，其他的包都直接或间接的依赖该包的类型或功能

## 使用场景

- 编写自定义 `ResolvableMountAdapter`，让 Makoo 挂载新的 artifact 类型。
- 使用 `createMakoo()` 创建运行时，并显式启动任务声明。
- 监听注入生命周期事件，用于调试、埋点、错误上报或可视化开发工具。
- 使用 `DOMWatcher`、`createActivityStore` 等底层工具构建自定义运行时集成。

## 安装

```bash
// npm install @makoojs/core
// yarn add @makoojs/core
pnpm add @makoojs/core
```

## 最小运行时示例

```ts
import {
	createMakoo,
	inject,
	type ResolvableMountAdapter
} from '@makoojs/core';

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

const makoo = createMakoo({
	defaults: {
		alive: true,
		scope: 'local',
		timeout: 5000
	},
	adapters: [textAdapter]
});

makoo.start([
	inject('#app', {
		kind: 'text',
		text: 'Hello from Makoo core'
	})
]);
```

## 运行时基础

`inject()` 和 `listen()` 是声明 helper。它们不会触碰 DOM，也不会自己注册任务。`makoo.start([...])` 会注册传入批次里的声明，并立即调度这些任务。

`inject()` 有两种写法。参数形式比较简洁：

```ts
inject('#toolbar', toolbarArtifact, {
	alive: true
});
```

对象形式会把声明字段放在一起。里面可选的 `id` 会作为任务 ID，适合后续需要查找或控制这个任务的场景：

```ts
inject({
	id: 'settings-panel',
	injectAt: '#settings',
	artifact: settingsArtifact,
	options: {
		alive: true
	}
});
```

没有传 `id` 时，Makoo 会根据 artifact 和目标 selector 推导任务 ID。

```ts
import { createMakoo, inject, listen } from '@makoojs/core';

const makoo = createMakoo({
	defaults: {
		alive: false,
		scope: 'local',
		timeout: 5000
	},
	adapters: [myAdapter],
	hooks: {
		'start:requested': (event) => {
			console.log(event.name);
		}
	}
});

const started = makoo.start([
	inject('#toolbar', toolbarArtifact, {
		alive: true
	}),
	inject({
		id: 'settings-panel',
		injectAt: '#settings',
		artifact: settingsArtifact,
		options: {
			alive: true
		}
	}),
	inject('#save-tip', saveTipArtifact, {
		on: listen('#save', 'click', () => {
			console.log('save clicked');
		})
	}),
	listen('#escape', 'keydown', onEscape)
]);
```

`start()` 返回 `StartedTasks`，用于控制本批次任务：

```ts
const toolbar = started.get('Toolbar@#toolbar');

if (toolbar?.kind === 'component') {
	toolbar.disableAlive();
	toolbar.enableAlive();
}

started.destroyAll();
```

`started.destroyAll()` 只影响本次启动产生的任务。`makoo.destroyAll()` 会影响整个运行时中的全部任务。

## Adapter 协议

core 不关心 artifact 是 Vue 组件、React 组件还是其他对象。它只要求 adapter 实现统一挂载协议。

```ts
import type { ResolvableMountAdapter } from '@makoojs/core';

const adapter: ResolvableMountAdapter<MyArtifact, MyHandle, MyInstance> = {
	name: 'my-adapter',
	matches(artifact): artifact is MyArtifact {
		return isMyArtifact(artifact);
	},
	mount(input) {
		return {
			handle,
			instance
		};
	},
	unmount(input) {
		// 根据 input.reason 清理资源。
	}
};
```

`mount(input)` 会收到目标宿主节点、生成的挂载点、artifact、taskId、selector，以及任务级 `makoo` 上下文。

## Listener 和 activity signal

独立监听任务通过 `listen()` 声明。

```ts
import { createActivityStore, createMakoo, listen } from '@makoojs/core';

const enabled = createActivityStore(true);
const makoo = createMakoo();

makoo.start([
	listen(
		'#save',
		'click',
		() => {
			console.log('save clicked');
		},
		{
			activitySignal: () => enabled
		}
	)
]);

enabled.set(false);
enabled.set(true);
```

## 观察事件

core 会在声明注册、启动、挂载、监听、alive 模式、DOM 观察和任务状态变化时发出观察事件。

```ts
const off = makoo.on('artifact:mountSuccess', (event) => {
	console.log(event.taskId, event.injectAt);
});

makoo.onAny((event, ctrl) => {
	if (event.name === 'artifact:mountFail') {
		ctrl.stopPropagation();
	}
});

off();
```

常见事件包括：

- `register:start`
- `register:success`
- `start:requested`
- `start:taskScheduled`
- `artifact:mountStart`
- `artifact:mountSuccess`
- `artifact:mountFail`
- `listener:attached`
- `alive:enabled`
- `alive:observerStarted`
- `task:statusChange`
- `dom:targetFound`
- `dom:targetTimeout`

完整事件名列表可从 `OBSERVE_EVENT_NAMES` 获取。

## DOMWatcher

`DOMWatcher` 是 core 的底层 DOM 观察工具。通常你不需要直接使用它，因为 `makoo.start()` 和 alive 模式已经封装了目标等待和恢复逻辑。

## 日志和错误

core 默认使用 `Logger`，并用 `[Makoo]` 前缀打印日志。你可以通过 `createMakoo({ logger })` 传入自定义 logger。

core 也导出这些错误相关类型：

- `MakooError`
- `AdapterError`
- `TaskError`
- `ErrorCode`
- `MakooIssue`

## Public Exports 概览

| 分类 | 代表导出 |
| --- | --- |
| 运行时 API | `createMakoo`, `inject`, `listen`, `MakooRuntime`, `StartedTasks` |
| Adapter 协议 | `MountAdapter`, `ResolvableMountAdapter`, `AdapterMountInput`, `AdapterUnmountInput`, `MakooContext` |
| 生命周期观察 | `ObserverHub`, `OBSERVE_EVENT_NAMES`, `ObserveEvent`, `ObserveHook`, `LifecycleHookMap` |
| DOM 观察 | `DOMWatcher` |
| 监听 signal | `createActivityStore`, `ActivitySignalSource` |
| 日志 | `Logger`, `ILogger`, `LoggerLevel` |
| 错误 | `MakooError`, `AdapterError`, `TaskError`, `ErrorCode` |
