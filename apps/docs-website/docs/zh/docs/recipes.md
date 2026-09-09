# 案例：元素选择器

在已[接入 Makoo](./installation.md)的 React 项目中，创建一个浮动面板：点击“选择元素”，悬停时高亮目标，点击后显示元素的标签名和 ID。

## 启动面板

在应用入口注册组件任务：

`src/main.ts`

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createReactAdapter } from '@makoojs/react';
import Picker from './injections/picker/Picker.tsx';

createMakoo({ adapters: [createReactAdapter()] }).start([
  inject({ id: 'element-picker', injectAt: 'body', artifact: Picker })
]);
```

## 选择元素

`picking` 控制选择模式。开启时注册页面事件并创建高亮框；选中目标、取消选择或关闭面板时，effect 的清理函数移除事件和高亮框。`data-makoo-picker` 用来排除面板自身。

`src/injections/picker/Picker.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { ReactMountProps } from '@makoojs/react';
import './style.css';

export default function Picker({ makoo }: ReactMountProps) {
  const [picking, setPicking] = useState(false);
  const [targetLabel, setTargetLabel] = useState('尚未选择元素');

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
        {picking ? '取消' : '选择元素'}
      </button>
      <button onClick={() => makoo.destroy()}>关闭</button>
    </aside>
  );
}
```

## 设置样式

面板固定在右下角。高亮框使用视口坐标定位，`pointer-events: none` 让鼠标事件继续落在目标元素上。

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

## 在网页中使用

运行 `pnpm dev`，安装开发脚本并打开匹配网页。点击“选择元素”，移动鼠标观察高亮，再点击目标；面板会显示类似 `div#toolbar` 的结果。点击“关闭”会通过 `makoo.destroy()` 卸载面板。

这个任务挂载到 `body`，选择过程中的事件和高亮框由 React effect 管理。组件卸载时，React 会运行同一份清理函数。任务销毁方法见 [MakooContext](../api/adapters.md#makoocontext)。
