# Recipes

This chapter uses a complete small-tool example to show how a Makoo project can be split in a real userscript scenario.

The example is a generic **DOM Selector Picker**. The script runs on regular web pages and injects a small panel in the bottom-right corner. When picking mode is enabled, hovering an element shows a highlight outline. Clicking an element locks the current target and shows its CSS selector, DOM path, tag, size, classes, and text preview.

This example shows how a small frontend tool uses Makoo to compose tasks and organize component code.

## Final Behavior

The tool supports these interactions:

- Click `Pick` to enter picking mode
- Hover page elements to show a blue outline
- Click a page element to lock the result and exit picking mode
- Copy the selector or DOM path
- Click `Hide` to keep a draggable mini toolbar
- Click `Open` to restore the full panel

The same pattern also works for page debugging panels, selection tools, reading aids, form fillers, annotation tools, and similar utilities.

## Project Structure

This example uses React and keeps the related code in one feature directory:

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

Each part has a narrow responsibility:

| Location | Responsibility |
| --- | --- |
| `App.tsx` | Imports styles, owns top-level collapsed state, and composes components |
| `components/` | React UI such as the panel, fields, and header |
| `hooks/` | Browser interaction logic such as element picking and panel dragging |
| `utils/` | Pure utility functions such as selector generation and clipboard copying |
| `constants.ts` | Shared DOM ids, ignored selectors, and other feature constants |
| `style.css` | Styles for this feature |

With this split, the module does not become one large file that mixes DOM calculation, event listeners, drag state, copy behavior, and TSX.

## Declare the Task

Application code creates the Makoo runtime, registers the React adapter, and declares the `selector-picker` task:

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

Important details:

- `selector-picker` is the stable task id.
- `injectAt: 'body'` mounts the floating tool at a page-level target.
- `createReactAdapter()` mounts and unmounts the React component.
- This floating tool uses `body` as its host and does not need `alive`.

The userscript pages are controlled by `monkey.userscript.match` in `vite.config.ts`. If the component instead mounts under a host-page node that can be removed and recreated, enable `alive` under the task's `options`.

## Root Component

`App.tsx` imports styles, owns the top-level collapsed state, and renders the tool component:

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

This layer does not calculate selectors, listen to page events, or implement dragging. Panel UI changes do not require changes to the task declaration.

## Constants

`constants.ts` stores shared fixed values:

```ts
export const TOOL_ROOT_ID = 'makoo-devtools-panel-root';
export const IGNORED_SELECTOR = '#makoo-devtools-panel-root, #makoo-devtools-panel-root *';
```

`IGNORED_SELECTOR` matters because the picker listens to page elements. It must not select its own panel when the user moves over tool buttons.

## DOM Snapshot Utility

`utils/domSnapshot.ts` converts a real DOM element into data the panel can render:

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

This is the core business logic of the tool. It does not know about React state and does not update the UI. It receives an `Element` and returns structured data.

In this example:

- `id` is preferred for stable selectors
- stable classes are used when there is no `id`
- `:nth-of-type()` is used when classes are not enough
- DOM path gives a short parent chain to help users understand the element location
- text preview compresses whitespace and limits the preview length

This logic can be tested independently or replaced with another selector strategy.

## Element Picking Hook

`hooks/useElementPicker.ts` owns picking mode:

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

The listeners run in the capture phase to behave more like browser developer tools. When the user clicks a page element, the tool locks the target before the host page's own click logic can run.

The hook does not manage panel UI directly. It only exposes two moments:

- `onPreview`: live preview while hovering
- `onLock`: final selection when the user clicks

The component decides how those moments affect state.

## Draggable Panel Hook

`hooks/useDraggablePanel.ts` manages panel dragging:

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

Keeping drag logic separate from picking logic prevents one component from filling up with `pointermove`, `pointerdown`, bounds calculations, and UI rendering all at once.

Implementation notes:

- Clicking buttons should not start dragging, so the hook ignores `event.target.closest('button')`.
- Dragged position should be clamped to the viewport so the tool cannot be dragged off-screen.

## Main Component

`components/SelectorPicker.tsx` composes state, hooks, and UI:

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

The main component keeps only tool-level state:

- `enabled`: whether picking mode is active
- `snapshot`: the current element snapshot
- `collapsed`: whether the panel is collapsed
- `dragging`: whether the panel is being dragged

UI details are delegated to `PickerHeader` and `CopyField`.

## Field Component

`components/CopyField.tsx` renders long copyable text fields:

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

Selectors and DOM paths can both be long, so they share the same field component. The content area has a stable height and scrolls internally. That prevents long selectors from pushing `Element`, `Classes`, or `Text` out of the panel.

## Styles

This example keeps styles in the feature's `style.css` and scopes the selectors to avoid affecting the host page:

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

Style guidelines:

- Prefix all classes for the module, such as `makoo-picker-*`
- Use a high `z-index` so the panel stays above the host page
- Keep the highlight outline `pointer-events: none` so it never blocks picking
- Give long text fields stable height and internal scrolling
- Use single-line ellipsis for text previews and put the full value in `title`

## Summary

In this example, Makoo is responsible for:

- declaring the task, target node, and React artifact through `inject()`
- waiting for the target DOM and mounting the React component
- unmounting the component and releasing runtime resources when the task is destroyed

The feature code owns the product logic:

- how a DOM selector is generated
- how picking mode listens to page events
- how the panel is dragged
- how fields are copied and displayed

Application code composes tasks, Makoo schedules them at runtime, and React components own the tool's interactions and UI.
