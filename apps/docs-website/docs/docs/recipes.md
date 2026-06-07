# Recipes

This chapter uses a complete small-tool example to show how a Makoo project can be split in a real userscript scenario.

The example is a generic **DOM Selector Picker**. The script runs on regular web pages and injects a small panel in the bottom-right corner. When picking mode is enabled, hovering an element shows a highlight outline. Clicking an element locks the current target and shows its CSS selector, DOM path, tag, size, classes, and text preview.

The point of this example is not complex business logic. It is meant to show how Makoo helps keep clear boundaries once a userscript becomes a small frontend tool.

## Final Behavior

The tool supports these interactions:

- Click `Pick` to enter picking mode
- Hover page elements to show a blue outline
- Click a page element to lock the result and exit picking mode
- Copy the selector or DOM path
- Click `Hide` to keep a draggable mini toolbar
- Click `Open` to restore the full panel

The same pattern also works for page debugging panels, selection tools, reading helpers, form fillers, annotation tools, and similar utilities.

## Project Structure

Put one injected tool in its own module under `injections/<module-name>/`. This example uses React:

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

Each part has a narrow responsibility:

| Location | Responsibility |
| --- | --- |
| `app.jsx` | Injection module entry; only top-level state and composition |
| `components/` | React UI such as the panel, fields, and header |
| `hooks/` | Browser interaction logic such as element picking and panel dragging |
| `utils/` | Pure helpers such as selector generation and clipboard copying |
| `constants.js` | Shared DOM ids, ignored selectors, and other module constants |
| `style.css` | Styles for this injection module |

With this split, the module does not become one large file that mixes DOM calculation, event listeners, drag state, copy behavior, and JSX.

## Manifest Config

The top-level `injections/manifest.js` declares the module:

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

Important details:

- `selector-picker` is the module id. Use a stable name that describes the feature.
- `injectAt: 'body'` mounts the tool at the page level, which fits floating tools.
- `framework: 'React'` makes the adapter explicit and avoids path inference ambiguity.
- `alive: true` lets the tool recover when the host page redraws large parts of the DOM.
- The module-level `match` uses broad patterns so the tool can run on normal web pages.

If the tool only targets one site, narrow `match.include` to that domain. Module-level `match` is evaluated by Makoo at runtime. The userscript manager still needs `monkey.userscript.match` to cover the target pages.

> [!NOTE]
> Floating tools often inject into `body`, but on pages that already use React, Turbo, or another complex runtime, production projects should create a dedicated host node first and mount the React component into that host. This avoids interfering with the host page's DOM structure.

## Entry File

`app.jsx` should stay thin. It imports styles, owns the top-level collapsed state, and renders the actual tool component:

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

The entry layer does not calculate selectors, listen to page events, or implement dragging. That keeps the module entry stable even if the panel UI changes later.

## Constants

`constants.js` stores shared fixed values:

```js
export const TOOL_ROOT_ID = 'makoo-devtools-panel-root';
export const IGNORED_SELECTOR = '#makoo-devtools-panel-root, #makoo-devtools-panel-root *';
```

`IGNORED_SELECTOR` matters because the picker listens to page elements. It must not select its own panel when the user moves over tool buttons.

## DOM Snapshot Utility

`utils/domSnapshot.js` converts a real DOM element into data the panel can render:

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

This is the core business logic of the tool. It does not know about React state and does not update the UI. It receives an `Element` and returns structured data.

In this example:

- `id` is preferred for stable selectors
- stable classes are used when there is no `id`
- `:nth-of-type()` is used when classes are not enough
- DOM path gives a short parent chain to help users understand the element location
- text preview compresses whitespace and limits the preview length

Keeping this logic in `utils/` makes it easier to test or replace the selector strategy later.

## Element Picking Hook

`hooks/useElementPicker.js` owns picking mode:

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

The listeners run in the capture phase to behave more like browser developer tools. When the user clicks a page element, the tool locks the target before the host page's own click logic can run.

The hook does not manage panel UI directly. It only exposes two moments:

- `onPreview`: live preview while hovering
- `onLock`: final selection when the user clicks

The component decides how those moments affect state.

## Draggable Panel Hook

`hooks/useDraggablePanel.js` manages panel dragging:

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

Keeping drag logic separate from picking logic prevents one component from filling up with `pointermove`, `pointerdown`, bounds calculations, and UI rendering all at once.

Implementation notes:

- Clicking buttons should not start dragging, so the hook ignores `event.target.closest('button')`.
- Dragged position should be clamped to the viewport so the tool cannot be dragged off-screen.

## Main Component

`components/SelectorPicker.jsx` composes state, hooks, and UI:

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

The main component keeps only tool-level state:

- `enabled`: whether picking mode is active
- `snapshot`: the current element snapshot
- `collapsed`: whether the panel is collapsed
- `dragging`: whether the panel is being dragged

UI details are delegated to `PickerHeader` and `CopyField`.

## Field Component

`components/CopyField.jsx` renders long copyable text fields:

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

Selectors and DOM paths can both be long, so they share the same field component. The content area has a stable height and scrolls internally. That prevents long selectors from pushing `Element`, `Classes`, or `Text` out of the panel.

## Styles

This example keeps styles inside the module's `style.css`. The goal is not elaborate visuals, but avoiding conflicts with the host page:

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

In this example, Makoo owns the userscript project structure:

- manifest declares the module and URL rules
- Makoo waits for the target DOM and mounts the React component
- `alive` helps the tool recover after host page redraws
- the injected module can be developed and split like a regular frontend feature

The module itself owns the product logic:

- how a DOM selector is generated
- how picking mode listens to page events
- how the panel is dragged
- how fields are copied and displayed

This is the recommended Makoo workflow: put injection rules in the manifest, let Makoo coordinate runtime behavior, and keep product logic inside a clearly structured module directory.
