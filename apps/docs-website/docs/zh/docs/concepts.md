# 核心概念

一个 Makoo 项目有两段流程：工具链负责把应用交给脚本管理器；浏览器中的 Runtime 负责运行任务。

```text
vite.config.ts → Vite / Monkey → 开发脚本或构建产物
                                     ↓ 脚本管理器在匹配页面加载
src/main.ts → createMakoo() → start([...]) → 等待目标 → 挂载或绑定事件
```

## 配置：脚本在哪里运行

`monkey.userscript.match` 决定脚本管理器在哪些 URL 加载脚本；`entry` 指向应用入口。端口、产物目录、脚本元信息都属于工具链配置，见[项目配置](./configuration.md)。

`@match` 匹配页面地址，`injectAt` 匹配页面里的 DOM 元素，它们是两个不同的条件。

## 声明：有哪些任务

- `inject({ ... })` 描述要挂载的组件和目标选择器。
- `listen({ ... })` 描述事件目标、事件类型和回调。

两者返回普通任务声明。只有把声明传给 `start()`，Runtime 才会注册并运行它们。

## Runtime：谁管理任务

`createMakoo()` 返回一个 Runtime。它持有任务、默认选项、Adapter 和生命周期事件订阅。一个页面可以创建多个 Runtime；任务 ID 在各自的 Runtime 内标识任务。

`start()` 返回本次启动的任务句柄集合 `StartedTasks`。集合上的 `destroyAll()` 只清理这一次启动的任务；Runtime 上的 `destroyAll()` 清理整个 Runtime 的任务。

## Adapter：谁挂载组件

Core 创建挂载点，Vue 或 React Adapter 把组件挂载进去，并在任务清理时卸载组件。组件通过 `makoo` prop 接收当前任务的 Context。

具体写法见[组件注入](./injection.md)。

## 状态：任务现在进行到哪一步

| 状态 | 含义 |
| --- | --- |
| `idle` | 当前没有等待、挂载或已启用的监听行为 |
| `pending` | 正在等待目标元素 |
| `active` | 组件已挂载或监听器已绑定 |

状态说明当前阶段，不是完整的失败原因。排查时结合浏览器错误和生命周期事件，见[常见问题](./troubleshooting.md)。

## 下一步

先用[组件注入](./injection.md)或[事件监听](./listeners.md)实现一个功能，再根据宿主页面是否替换节点，决定是否开启 [alive](./lifecycle.md)。
