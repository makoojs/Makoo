# 常见问题

脚本没有按预期工作时，按「开发服务 → 脚本安装 → 网址匹配 → 入口执行 → 注入状态 → 页面表现」的顺序排查，先确定问题出在哪一步。

## 读取错误

多数运行期问题都可以从注入的状态入口找到原因。在入口中临时加入：

```ts
const status = core.injection('panel').statusHandle;
status.subscribe(() => console.log('panel:', status.getSnapshot(), status.lastError));
```

或者添加 `makooDev()`，在开发终端的注入页直接查看每个注入的状态和错误，见[本地开发](./development.md#在终端查看注入状态)。

浏览器控制台也会打印每次执行失败和清理失败的错误对象。展开它并沿 `cause` 往下看，可以找到原始代码行。各错误码的含义见[错误 API](../api/errors.md#makooerrorcode)。

## dev 启动失败

查看终端的第一条错误。确认依赖已安装、入口文件存在、在项目目录中运行命令。配置字段错误的错误码是 `MAKOO_CLI_CONFIG_INVALID`，消息每行一个 `字段路径: 原因`，按提示修改；端口被占用时换一个端口，或关闭占用它的进程。

## 安装页打开了，网页上却什么都没有

安装页只用于安装脚本。确认脚本管理器已完成安装并启用了脚本，然后打开 `@match` 匹配的目标网页。

修改 `@match` 后，检查脚本管理器中的元信息是否已更新。

## 脚本没有运行

- 打开脚本管理器的弹出菜单，确认当前网页上脚本处于运行状态。
- 查看浏览器控制台是否有模块加载失败或入口抛出的错误。
- 确认 `pnpm dev` 仍在运行，开发脚本需要从它加载代码。
- 添加了 `makooDev()` 时，终端首页显示 `Waiting for a browser runtime` 表示当前没有连接：页面未打开、脚本未安装或未匹配、入口在 `createMakoo()` 之前抛错，都会显示它。

## `apply()` 抛出错误

这是配置错误，整批声明都没有启动。按错误码处理：

| 错误码 | 处理 |
| --- | --- |
| `MAKOO_DECLARATION_INVALID` | 确认 `apply()` 收到非空的 `inject()` / `listen()` 声明批，且附属监听未设置 `reinject` |
| `MAKOO_INJECTION_NAME_CONFLICT` | 换一个名称，或先 `await` 已有同名注入的 `remove()`，名称在清理完成后才释放；清理失败的注入会一直占用名称，需要刷新页面 |
| `MAKOO_ADAPTER_NOT_FOUND` | 在 `apply()` 之前调用 `core.useAdapter()`，并核对 `adapter` 名称 |

## 组件没有出现

先看组件状态：

| 状态 | 含义与处理 |
| --- | --- |
| `waiting` | 还没找到挂载目标。在控制台运行 `document.querySelector('你的 injectAt')` 检查选择器 |
| `failed` + `MAKOO_TARGET_WAIT_TIMEOUT` | 等待超时（默认 15 秒）。检查选择器，或调大 `timeout` |
| `failed` + `MAKOO_MOUNT_FAILED` | 组件挂载时抛错。展开 `cause` 查看组件代码中的错误 |
| `failed` + `MAKOO_INJECTION_CLEANUP_FAILED` | 挂载失败后也没能清理干净，注入已关闭。Vue 组件在挂载中途（例如子组件 `setup`）抛错时，`errors` 中会有 `MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED`。修复组件后刷新页面 |
| `failed` + `MAKOO_ATTACHED_LISTENER_FAILED` | 某个附属监听失败导致组件结束。展开 `cause` 查看是哪个监听 |
| `mounted` | 组件已挂载。检查宿主 CSS 是否遮挡、隐藏了它，或它是否被挂到了意料之外的元素里 |

在开发者工具中搜索挂载目标末尾新增的 `div`，可以确认组件容器的位置。

## 组件出现后又消失了

挂载目标或组件容器被网站移除了，`lastError` 通常是 `MAKOO_MOUNT_TARGET_DETACHED`。开启 `reinject` 让组件跟着新元素重新挂载，见[应对节点替换](./reinject.md)。

## 监听没有触发

- 状态是 `waiting`：监听目标还没出现，检查 `listenAt`。
- 状态是 `failed`：`MAKOO_TARGET_WAIT_TIMEOUT` 表示等待超时；`MAKOO_LISTENER_TARGET_DETACHED` 表示目标被网站移除且未开启 `reinject`。
- 状态是 `bound` 但回调没有执行：确认事件确实发生在这个元素或其后代上；网站阻止了冒泡时，尝试 `capture: true`。
- 回调执行了但报错：控制台会有 `MAKOO_LISTENER_CALLBACK_FAILED`，监听仍保持绑定。
- 附属监听在组件挂载之后才开始查找目标，组件处于 `waiting` 时它不会绑定。

## `useMakooComponent()` 或 React hooks 抛错

| 错误码 | 原因 |
| --- | --- |
| `MAKOO_VUE_HOOK_OUTSIDE_COMPONENT` / `MAKOO_REACT_HOOK_OUTSIDE_COMPONENT` | 组件不是由 Makoo 挂载的，例如在普通的 `createApp()` 里使用；Vue 中放在事件处理函数或 `setTimeout` 里调用也会报这个错，应在 `setup` 顶层调用 |
| `MAKOO_VUE_HOOK_OUTSIDE_SCOPE` | 在没有 effect scope 的位置调用，例如插件里的 `app.runWithContext()` |
| `MAKOO_LISTENER_NOT_FOUND` | `attachedListener(name)` 的名称不在组件的 `listeners` 中 |
| `MAKOO_INJECTION_NOT_FOUND` | `listener(name)` 找不到这个独立监听；它可能还没有 `apply()`，或是一个组件 |

## `start()` 抛出 `MAKOO_INJECTION_CLOSED`

这个注入之前清理失败，已被关闭，名称也被占用。查看它的 `lastError`（一个 `MakooAggregateError`），根据 `errors` 修复卸载或清理中的问题，然后刷新页面。原因见[为什么清理失败会关闭注入](./lifecycle.md#为什么清理失败会关闭注入)。

## 组件挂载了两次或回调触发两次

- 在脚本管理器中只启用当前要测试的那一份脚本，例如同时装了开发脚本和构建产物时停用其中一个。
- 确认 `createMakoo()` 和 `apply()` 只在入口执行一次，没有写在组件内或会重复执行的回调中。
- 自己写了 `import.meta.hot.accept()` 时，需要在 `dispose` 中销毁旧实例，见[热更新](./hmr.md#自定义热更新边界)。

## GM API 不可用

从浏览器代码中导入 `@makoojs/cli/monkey`，不要在 `vite.config.ts` 中调用。确认脚本管理器在当前页面执行了脚本，以及构建产物的 metadata 声明了所需权限。开发脚本固定声明 `@grant *`，所以「开发时可用、构建后不可用」通常是产物缺少对应的 `@grant`。见 [Userscript API](../api/monkey.md)。

## preview 显示旧内容

preview 不会编译源码。先重新 `build` 再 `preview`，并确认两者使用相同的 `outDir`、脚本管理器运行的是新构建的脚本。见[构建与预览](./build.md)。
