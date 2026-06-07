# 实践示例

这一章通过一个完整的小工具示例，展示 Makoo 项目在真实 userscript 场景里应该如何拆分。

示例目标是做一个通用的 **DOM Selector Picker**：脚本运行在任意网页上，右下角注入一个小面板。开启选择模式后，鼠标悬停页面元素会显示高亮框；点击某个元素后锁定当前目标，并展示这个元素的 CSS selector、DOM path、标签、尺寸、class 和文本预览。

这个例子不是为了展示复杂业务，而是展示 userscript 项目变成“小型前端工具”之后，如何用 Makoo 维持清晰边界。

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

推荐把一个注入工具作为独立模块放在 `injections/<module-name>/` 下。这个例子使用 React：

```txt
injections
├─ manifest.js
└─ devtools
   ├─ app.jsx
   ├─ constants.js
   ├─ style.css
   ├─ components
   │  ├─ CopyField.jsx
   │  ├─ PickerHeader.jsx
   │  └─ SelectorPicker.jsx
   ├─ hooks
   │  ├─ useDraggablePanel.js
   │  └─ useElementPicker.js
   └─ utils
      ├─ clipboard.js
      └─ domSnapshot.js
```

这几个目录的职责如下：

| 位置 | 职责 |
| --- | --- |
| `app.jsx` | 注入模块入口，只做顶层状态和组件组装 |
| `components/` | 面板、字段、头部等 React UI |
| `hooks/` | 选择元素、拖动面板等浏览器交互逻辑 |
| `utils/` | DOM selector 生成、复制文本等纯工具函数 |
| `constants.js` | 模块内共享的 DOM id、忽略选择器等常量 |
| `style.css` | 当前注入模块的样式 |

这样拆分后，模块不会变成一个同时处理 DOM 计算、事件监听、拖动状态、复制逻辑和 JSX 的大文件。

## Manifest 配置

顶层 `injections/manifest.js` 声明这个注入模块：

```js
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	globalInjector: {
		alive: true,
		scope: 'global',
		timeout: 10000
	},
	injections: {
		'selector-picker': {
			injectAt: 'body',
			component: './devtools/app.jsx',
			framework: 'React',
			alive: true,
			match: {
				include: ['http://*/*', 'https://*/*']
			}
		}
	}
});
```

这里有几个关键点：

- `selector-picker` 是模块 id，建议用能描述功能的稳定名称。
- `injectAt: 'body'` 表示把工具挂到页面级容器上，适合浮窗类工具。
- `framework: 'React'` 显式声明组件框架，避免从路径推断时产生歧义。
- `alive: true` 让工具在宿主页面重绘后仍有机会重新挂载。
- 模块级 `match` 使用通配规则，让这个工具可以在普通网页上运行。

如果你的工具只服务某个网站，可以把 `match.include` 收窄到对应域名。模块级 `match` 是 Makoo 运行时判断，脚本管理器自己的 `monkey.userscript.match` 仍然需要覆盖目标页面。

> [!NOTE]
> 浮窗类工具虽然经常注入到 `body`，但如果宿主页面本身使用 React、Turbo 或其他复杂运行时，实际项目里更推荐先创建一个独立 host 节点，再把 React 组件挂到这个 host。这样可以避免和宿主页面的 DOM 结构互相影响。

## 入口文件

`app.jsx` 应该尽量薄，只负责引入样式、维护顶层展开状态，并渲染真正的工具组件：

```jsx
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
			<SelectorPicker collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
		</div>
	);
}
```

入口层不直接写 selector 计算、事件监听或拖动细节。这样后续即使面板 UI 改版，也不会影响模块入口。

## 常量

`constants.js` 保存跨文件共享的固定值：

```js
export const TOOL_ROOT_ID = 'makoo-devtools-panel-root';
export const IGNORED_SELECTOR = '#makoo-devtools-panel-root, #makoo-devtools-panel-root *';
```

`IGNORED_SELECTOR` 很重要。选择器工具在监听页面元素时，不能把自己的面板也当成目标元素，否则用户移动到工具按钮上时会不断选中工具自身。

## DOM 快照工具

`utils/domSnapshot.js` 负责把一个真实 DOM 元素转换成面板可展示的数据：

```js
export function getElementSnapshot(element) {
	const rect = element.getBoundingClientRect();

	return {
		selector: buildSelector(element),
		path: getDomPath(element),
		tag: element.tagName.toLowerCase(),
		classes: Array.from(element.classList).slice(0, 8),
		text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
		size: Math.round(rect.width) + ' x ' + Math.round(rect.height)
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

这类逻辑放在 `utils/` 中，方便后续单独测试或替换策略。

## 选择元素 Hook

`hooks/useElementPicker.js` 负责选择模式：

```js
export function useElementPicker({ enabled, onPreview, onLock }) {
	useEffect(() => {
		if (!enabled) return undefined;

		const overlay = document.createElement('div');
		overlay.className = 'makoo-picker-outline';
		document.body.appendChild(overlay);

		function onPointerMove(event) {
			const target = event.target;
			if (!(target instanceof Element) || target.matches(IGNORED_SELECTOR)) return;

			moveOverlay(overlay, target);
			onPreview(getElementSnapshot(target));
		}

		function onPointerDown(event) {
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

`hooks/useDraggablePanel.js` 管理窗口拖动：

```js
export function useDraggablePanel(panelRef) {
	const [position, setPosition] = useState(null);
	const [dragging, setDragging] = useState(false);
	const dragRef = useRef(null);

	function startDrag(event) {
		if (event.target.closest('button') || !panelRef.current) return;

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
		style
	};
}
```

拖动逻辑和选择逻辑分开，可以避免一个组件里同时出现大量 `pointermove`、`pointerdown`、边界计算和 UI 渲染代码。

实现时要注意两点：

- 点击按钮时不能触发拖动，所以要排除 `event.target.closest('button')`。
- 拖动位置要限制在视口内，避免工具被拖到屏幕外。

## 主组件

`components/SelectorPicker.jsx` 负责把状态、hook 和 UI 拼起来：

```jsx
export function SelectorPicker({ collapsed, onToggleCollapsed }) {
	const [enabled, setEnabled] = useState(true);
	const [snapshot, setSnapshot] = useState(null);
	const pickerRef = useRef(null);
	const { dragging, startDrag, style } = useDraggablePanel(pickerRef);

	const previewElement = useCallback((nextSnapshot) => {
		setSnapshot(nextSnapshot);
	}, []);

	const lockElement = useCallback((nextSnapshot) => {
		setSnapshot(nextSnapshot);
		setEnabled(false);
	}, []);

	useElementPicker({
		enabled,
		onPreview: previewElement,
		onLock: lockElement
	});

	return (
		<div ref={pickerRef} className={pickerClassName} style={style}>
			<PickerHeader />
			{/* detail fields */}
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

`components/CopyField.jsx` 用来渲染可复制的长文本字段：

```jsx
export function CopyField({ label, value, placeholder, copyLabel }) {
	const text = value || placeholder;

	return (
		<div className="makoo-selector-field">
			<div className="makoo-field-header">
				<label>{label}</label>
				<button disabled={!value} onClick={() => safeCopy(value)}>
					Copy
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

这个例子把样式放在模块内的 `style.css`。重点不是做复杂视觉，而是避免和宿主页面互相污染：

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

这个示例里，Makoo 负责的是 userscript 项目的结构入口：

- 通过 manifest 声明模块和 URL 规则
- 等待目标 DOM 并挂载 React 组件
- 在页面重绘后按 `alive` 策略保持工具可用
- 让注入模块像普通前端组件一样开发和拆分

而具体业务逻辑仍然属于模块内部：

- DOM selector 如何生成
- 选择模式如何监听页面事件
- 面板如何拖动
- 字段如何复制和展示

这也是 Makoo 推荐的实践方式：把注入规则交给 manifest，把运行时协调交给 Makoo，把真正的产品逻辑放回清晰的模块目录中。
