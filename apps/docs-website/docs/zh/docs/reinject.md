# 应对节点替换

单页应用切换视图、重新渲染列表时，常常把你挂载组件的元素整个移除，再创建一个新的。本页说明如何让组件和监听跟着新元素恢复。机制见[注入的生命周期](./lifecycle.md#整体重注入与局部恢复)。

## 确认是不是节点替换

出现「组件一开始在，过一会儿消失了」时：

1. 读取状态：`core.injection('toolbar').statusHandle.lastError?.code`。
2. 如果是 `MAKOO_MOUNT_TARGET_DETACHED`，说明挂载目标离开了页面，或组件容器被移除、被移出挂载目标。
3. 如果是 `MAKOO_ATTACHED_LISTENER_FAILED`，展开 `cause`，查看是哪个附属监听的目标失效了。

也可以在开发者工具的 Elements 面板中观察：元素被替换时，整段节点会闪烁高亮。

## 让组件重新挂载

在声明中开启 `reinject`：

```ts
inject({
  name: 'toolbar',
  injectAt: '#header .actions',
  adapter: 'vue',
  component: Toolbar,
  reinject: true
})
```

挂载目标失效后，Core 先完整清理旧的组件和容器，状态变为 `waiting`，再按 `injectAt` 查找新的挂载目标并重新挂载。

重新挂载会创建新的组件实例，组件内部的状态（例如 Vue 的 `ref`、React 的 `useState`）会回到初始值。需要跨重挂载保留的数据，请放在组件外部，例如模块级的 `ref`、Pinia store，或作为 `props` 属性传入的 `reactive()` 对象。

## 让监听重新绑定

附属监听沿用所属组件的 `reinject`，声明中不能自己设置（会以 `MAKOO_DECLARATION_INVALID` 拒绝）。组件开启 `reinject` 后，某个附属监听的目标被替换时，只有这个监听会重新查找并绑定，组件本身和其他监听保持不变：

```ts
inject({
  name: 'player-panel',
  injectAt: 'body',
  adapter: 'react',
  component: PlayerPanel,
  reinject: true,
  listeners: [
    listen({ name: 'video-play', listenAt: 'video', type: 'play', callback: onPlay })
  ]
})
```

恢复期间该监听的状态是 `waiting`，组件可以据此提示「等待播放器」。

独立监听用自己的 `reinject`：

```ts
listen({ name: 'shortcut', listenAt: '#editor', type: 'keydown', callback: onKey, reinject: true })
```

## 新元素迟迟不出现时

每次重新查找都有独立的等待预算（`timeout`，默认 15 秒）。超时后注入以 `MAKOO_TARGET_WAIT_TIMEOUT` 失败，不会继续等待。附属监听恢复超时时，整个组件以 `MAKOO_ATTACHED_LISTENER_FAILED` 结束，不会再整体重注入。

用户切换到一个没有目标元素的页面，过一段时间再回来，就会遇到这种情况。Makoo 不跟踪网址变化，可以按需选择：

- 调大 `timeout`，覆盖通常的停留时间。
- 在你能感知页面切换的地方（例如监听网站自己的导航按钮），对处于 `failed` 的注入调用 `start()`：

```ts
const status = core.injection('toolbar').statusHandle;
if (status.getSnapshot() === 'failed') core.injection('toolbar').command.start();
```

## 不会触发重新挂载的变化

以下变化不算失效，组件保持原样：

- 挂载目标的文字、属性或 class 改变，即使它已不再匹配 `injectAt`。
- 挂载目标在同一批 DOM 变化中被移走又插回页面，组件容器仍在它内部。

如果网站只是复用同一个元素展示另一条数据（例如虚拟列表），Makoo 无法察觉，请在组件内根据数据自行刷新。

## 参考

- [`reinject` 字段](../api/declarations.md#makoocomponentinput)
- [状态值](../api/status.md#状态值)
