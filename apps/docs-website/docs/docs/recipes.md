# Case Study: Element Picker

In a React project with [Makoo installed](./installation.md), build a floating panel that highlights elements as you hover and shows the selected element’s tag and ID when you click.

## Start the panel

Register a component task in the application entry:

`src/main.ts`

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Picker from './injections/picker/Picker.tsx';

createMakoo({ adapters: [createReactAdapter()] }).start([
  inject({ id: 'element-picker', injectAt: 'body', artifact: Picker })
]);
```

## Pick an element

`picking` controls selection mode. Enabling it registers page events and creates an outline. Selecting an element, cancelling, or closing the panel runs the effect cleanup to remove the events and outline. `data-makoo-picker` excludes the panel itself from selection.

`src/injections/picker/Picker.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { ReactMountProps } from '@makoojs/react';
import './style.css';

export default function Picker({ makoo }: ReactMountProps) {
  const [picking, setPicking] = useState(false);
  const [targetLabel, setTargetLabel] = useState('No element selected');

  useEffect(() => {
    if (!picking) return;

    const outline = document.createElement('div');
    outline.className = 'makoo-picker-outline';
    document.body.appendChild(outline);

    function preview(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-makoo-picker]')) {
        outline.style.display = 'none';
        return;
      }

      const rect = target.getBoundingClientRect();
      Object.assign(outline.style, {
        display: 'block',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    }

    function select(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-makoo-picker]')) return;

      event.preventDefault();
      event.stopPropagation();
      const tag = target.tagName.toLowerCase();
      setTargetLabel(target.id ? `${tag}#${target.id}` : tag);
      setPicking(false);
    }

    document.addEventListener('pointermove', preview, true);
    document.addEventListener('click', select, true);
    return () => {
      document.removeEventListener('pointermove', preview, true);
      document.removeEventListener('click', select, true);
      outline.remove();
    };
  }, [picking]);

  return (
    <aside data-makoo-picker>
      <p>{targetLabel}</p>
      <button onClick={() => setPicking((value) => !value)}>
        {picking ? 'Cancel' : 'Pick element'}
      </button>
      <button onClick={() => makoo.destroy()}>Close</button>
    </aside>
  );
}
```

## Style the panel

The panel sits in the bottom-right corner. The outline uses viewport coordinates, with `pointer-events: none` so mouse events reach the element underneath.

`src/injections/picker/style.css`

```css
[data-makoo-picker] {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  padding: 16px;
  background: white;
  color: #222;
  border: 1px solid #ccc;
  border-radius: 8px;
  font: 14px/1.5 sans-serif;
}

.makoo-picker-outline {
  display: none;
  position: fixed;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 2147483646;
  border: 2px solid #2563eb;
  background: rgb(37 99 235 / 10%);
}
```

## Use it on a page

Run `pnpm dev`, install the development script, and open a matching page. Click “Pick element”, move the pointer to see the outline, then click a target. The panel shows a result such as `div#toolbar`. “Close” calls `makoo.destroy()` to unmount the panel.

The task mounts on `body`; its React effect manages selection events and the outline. React runs the same cleanup when the component unmounts. See [MakooContext](../api/adapters.md#makoocontext) for task controls.
