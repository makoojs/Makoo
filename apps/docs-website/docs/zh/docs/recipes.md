# 实践示例

这一章通过一个完整的小工具示例，展示 Makoo 项目在真实 userscript 场景里应该如何拆分。

示例目标是做一个通用的 **DOM Selector Picker**：脚本运行在任意网页上，右下角注入一个小面板。开启选择模式后，鼠标悬停页面元素会显示高亮框；点击某个元素后锁定当前目标，并展示这个元素的 CSS selector、DOM path、标签、尺寸、class 和文本预览。

这个例子展示一个小型前端工具如何用 Makoo 编排任务并组织组件代码。

## 最终效果

这个小工具包含几类交互：

- 点击 `Pick` 进入选择模式
- 悬停页面元素时显示蓝色高亮框
- 点击页面元素后锁定结果，并退出选择模式
- 复制 selector 或 DOM path
- `Hide` 后保留一个可拖动的小工具条
- `Open` 后恢复完整面板

适合这个模式的工具还有：网页调试面板、划词工具、阅读辅助、表单填充器、页面批注工具等。

## 项目结构

这个例子使用 React，并把相关代码放在同一个功能目录下：

```txt
src
├─ main.ts
└─ injections
   └─ devtools
      ├─ App.tsx
      ├─ constants.ts
      ├─ style.css
      ├─ components
      │  ├─ CopyField.tsx
      │  ├─ PickerHeader.tsx
      │  └─ SelectorPicker.tsx
      ├─ hooks
      │  ├─ useDraggablePanel.ts
      │  └─ useElementPicker.ts
      └─ utils
         ├─ clipboard.ts
         └─ domSnapshot.ts
```

这几个目录的职责如下：

| 位置 | 职责 |
| --- | --- |
| `App.tsx` | 引入样式、维护顶层展开状态并组装组件 |
| `components/` | 面板、字段、头部等 React UI |
| `hooks/` | 选择元素、拖动面板等浏览器交互逻辑 |
| `utils/` | DOM selector 生成、复制文本等纯工具函数 |
| `constants.ts` | 功能内共享的 DOM id、忽略选择器等常量 |
| `style.css` | 当前功能的样式 |

这样拆分后，模块不会变成一个同时处理 DOM 计算、事件监听、拖动状态、复制逻辑和 TSX 的大文件。

## 声明任务

应用代码创建 Makoo runtime、注册 React adapter，并声明 `selector-picker` task：

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import DevtoolsPanel from './injections/devtools/App.tsx';

const tasks = createMakoo({ adapters: [createReactAdapter()] }).start([
	inject({
		id: 'selector-picker',
		injectAt: 'body',
		artifact: DevtoolsPanel
	})
]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

这里有几个关键点：

- `selector-picker` 是稳定的 task id。
- `injectAt: 'body'` 把浮窗挂载到页面级目标。
- `createReactAdapter()` 负责挂载和卸载 React 组件。
- 这个浮窗以 `body` 为宿主，不需要开启 `alive`。

脚本在哪些页面加载，由 `vite.config.ts` 中的 `monkey.userscript.match` 决定。如果组件改为挂载到可能被宿主页面移除并重新创建的节点，可以在 task 的 `options` 中开启 `alive`。

## 根组件

`App.tsx` 引入样式、维护顶层展开状态，并渲染工具组件：

```tsx
import { useEffect, useState } from 'react';
import { TOOL_ROOT_ID } from './constants';
import { SelectorPicker } from './components/SelectorPicker';
import './style.css';

export default function DevtoolsPanel() {
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		document.documentElement.dataset.makooDevtools = 'active';

		return () => {
			delete document.documentElement.dataset.makooDevtools;
		};
	}, []);

	return (
		<div id={TOOL_ROOT_ID}>
			<SelectorPicker
				collapsed={collapsed}
				onToggleCollapsed={() => setCollapsed((value) => !value)}
			/>
		</div>
	);
}
```

这一层不处理 selector 计算、事件监听或拖动细节。面板 UI 调整时，不需要改动 task 声明。

## 常量

`constants.ts` 保存跨文件共享的固定值：

```ts
export const TOOL_ROOT_ID = 'makoo-devtools-panel-root';
export const IGNORED_SELECTOR = '#makoo-devtools-panel-root, #makoo-devtools-panel-root *';
```

`IGNORED_SELECTOR` 很重要。选择器工具在监听页面元素时，不能把自己的面板也当成目标元素，否则用户移动到工具按钮上时会不断选中工具自身。

## DOM 快照工具

`utils/domSnapshot.ts` 负责把一个真实 DOM 元素转换成面板可展示的数据：

```ts
export type ElementSnapshot = {
	selector: string;
	path: string;
	tag: string;
	classes: string[];
	text: string;
	size: string;
};

export function getElementSnapshot(element: Element): ElementSnapshot {
	const rect = element.getBoundingClientRect();

	return {
		selector: buildSelector(element),
		path: getDomPath(element),
		tag: element.tagName.toLowerCase(),
		classes: Array.from(element.classList).slice(0, 8),
		text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
		size: `${Math.round(rect.width)} x ${Math.round(rect.height)}`
	};
}
```

这个函数是工具的核心业务逻辑。它不关心 React 状态，也不操作 UI，只接收一个 `Element`，返回结构化数据。

在这个示例里：

- 优先使用 `id` 生成稳定 selector
- 没有 `id` 时尝试使用稳定 class
- class 不够明确时使用 `:nth-of-type()`
- DOM path 用较短的父级链路帮助用户理解元素位置
- 文本预览会压缩空白，并限制最大长度

这部分逻辑可以单独测试或替换生成策略。

## 选择元素 Hook

`hooks/useElementPicker.ts` 负责选择模式：

```ts
import { useEffect } from 'react';
import { IGNORED_SELECTOR } from '../constants';
import { getElementSnapshot, type ElementSnapshot } from '../utils/domSnapshot';

type UseElementPickerOptions = {
	enabled: boolean;
	onPreview: (snapshot: ElementSnapshot) => void;
	onLock: (snapshot: ElementSnapshot) => void;
};

export function useElementPicker({
	enabled,
	onPreview,
	onLock
}: UseElementPickerOptions): void {
	useEffect(() => {
		if (!enabled) return undefined;

		const overlay = document.createElement('div');
		overlay.className = 'makoo-picker-outline';
		document.body.appendChild(overlay);

		function onPointerMove(event: PointerEvent): void {
			const target = event.target;
			if (!(target instanceof Element) || target.matches(IGNORED_SELECTOR)) return;

			moveOverlay(overlay, target);
			onPreview(getElementSnapshot(target));
		}

		function onPointerDown(event: PointerEvent): void {
			const target = event.target;
			if (!(target instanceof Element) || target.matches(IGNORED_SELECTOR)) return;

			event.preventDefault();
			event.stopPropagation();
			onLock(getElementSnapshot(target));
		}

		document.addEventListener('pointermove', onPointerMove, true);
		document.addEventListener('pointerdown', onPointerDown, true);

		return () => {
			document.removeEventListener('pointermove', onPointerMove, true);
			document.removeEventListener('pointerdown', onPointerDown, true);
			overlay.remove();
		};
	}, [enabled, onLock, onPreview]);
}
```

这里把事件监听放在捕获阶段，是为了更接近浏览器开发者工具的行为：用户点击页面元素时，工具先锁定目标，避免宿主页面自己的点击逻辑抢先执行。

这个 hook 不直接管理面板 UI。它只暴露两个时机：

- `onPreview`：悬停时实时预览
- `onLock`：点击时锁定选择结果

组件层可以决定这些时机如何影响状态。

## 拖动面板 Hook

`hooks/useDraggablePanel.ts` 管理窗口拖动：

```ts
export function useDraggablePanel(panelRef: RefObject<HTMLDivElement | null>) {
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
	const [dragging, setDragging] = useState(false);
	const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

	function startDrag(event: ReactPointerEvent<HTMLDivElement>): void {
		if (event.target instanceof Element && event.target.closest('button')) return;
		if (!panelRef.current) return;

		const rect = panelRef.current.getBoundingClientRect();
		dragRef.current = {
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top
		};
		setPosition({ x: rect.left, y: rect.top });
		setDragging(true);
	}

	return {
		dragging,
		startDrag,
		style: position ? { left: position.x, top: position.y } : undefined
	};
}
```

拖动逻辑和选择逻辑分开，可以避免一个组件里同时出现大量 `pointermove`、`pointerdown`、边界计算和 UI 渲染代码。

实现时要注意两点：

- 点击按钮时不能触发拖动，所以要排除 `event.target.closest('button')`。
- 拖动位置要限制在视口内，避免工具被拖到屏幕外。

## 主组件

`components/SelectorPicker.tsx` 负责把状态、hook 和 UI 拼起来：

```tsx
type SelectorPickerProps = {
	collapsed: boolean;
	onToggleCollapsed: () => void;
};

export function SelectorPicker({ collapsed, onToggleCollapsed }: SelectorPickerProps) {
	const [enabled, setEnabled] = useState(true);
	const [snapshot, setSnapshot] = useState<ElementSnapshot | null>(null);
	const pickerRef = useRef<HTMLDivElement>(null);
	const { dragging, startDrag, style } = useDraggablePanel(pickerRef);

	const previewElement = useCallback((nextSnapshot: ElementSnapshot) => {
		setSnapshot(nextSnapshot);
	}, []);

	const lockElement = useCallback((nextSnapshot: ElementSnapshot) => {
		setSnapshot(nextSnapshot);
		setEnabled(false);
	}, []);

	useElementPicker({
		enabled,
		onPreview: previewElement,
		onLock: lockElement
	});

	return (
		<div ref={pickerRef} className="makoo-picker" style={style} onPointerDown={startDrag}>
			<PickerHeader collapsed={collapsed} onToggle={onToggleCollapsed} />
			{!collapsed && snapshot ? <div>{snapshot.selector}</div> : null}
			{dragging ? <span>Moving</span> : null}
		</div>
	);
}
```

主组件只保留工具级状态：

- `enabled`：是否处于选择模式
- `snapshot`：当前元素快照
- `collapsed`：是否收起
- `dragging`：是否正在拖动

UI 细节继续拆到 `PickerHeader` 和 `CopyField` 中。

## 字段组件

`components/CopyField.tsx` 用来渲染可复制的长文本字段：

```tsx
type CopyFieldProps = {
	label: string;
	value?: string;
	placeholder: string;
	copyLabel: string;
};

export function CopyField({ label, value, placeholder, copyLabel }: CopyFieldProps) {
	const text = value || placeholder;

	return (
		<div className="makoo-selector-field">
			<div className="makoo-field-header">
				<label>{label}</label>
				<button type="button" disabled={!value} onClick={() => value && safeCopy(value)}>
					{copyLabel}
				</button>
			</div>
			<div className="makoo-selector-box">
				<code>{text}</code>
			</div>
		</div>
	);
}
```

Selector 和 DOM path 都可能很长，所以它们用同一个字段组件，内容区域固定高度并允许滚动。这样长 selector 不会把下面的 `Element`、`Classes`、`Text` 挤出面板。

## 样式组织

这个例子把样式放在功能目录内的 `style.css`，并通过选择器限制样式范围，避免影响宿主页面：

```css
#makoo-devtools-panel-root,
#makoo-devtools-panel-root * {
	box-sizing: border-box;
}

.makoo-picker {
	position: fixed;
	right: 18px;
	bottom: 18px;
	z-index: 2147483646;
	width: min(360px, calc(100vw - 28px));
}

.makoo-picker-outline {
	position: fixed;
	pointer-events: none;
	border: 2px solid #0969da;
	background: rgba(9, 105, 218, 0.08);
}
```

样式建议遵循这些原则：

- 所有 class 都加模块前缀，例如 `makoo-picker-*`
- 面板使用高 `z-index`，避免被宿主页面遮挡
- 高亮框必须 `pointer-events: none`，否则会挡住页面元素选择
- 长文本区域要固定高度并滚动
- 文本预览可以用单行省略，完整内容放到 `title`

## 小结

这个示例里，Makoo 负责：

- 通过 `inject()` 声明 task、目标节点和 React artifact
- 等待目标 DOM 并挂载 React 组件
- 在 task 销毁时卸载组件并释放运行时资源

具体业务逻辑仍然属于功能代码：

- DOM selector 如何生成
- 选择模式如何监听页面事件
- 面板如何拖动
- 字段如何复制和展示

应用代码负责组合 task，Makoo 负责运行时调度，React 组件负责工具本身的交互和界面。
