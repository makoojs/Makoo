# HMR 行为

组件、样式和 task 声明由 Vite 及对应的框架插件更新。

把 runtime 清理放在 task 启动代码附近，避免模块替换后留下重复 task：

```ts
const tasks = makoo.start([...]);

if (import.meta.hot) {
	import.meta.hot.dispose(() => tasks.destroyAll());
}
```

## 组件更新

Vue 组件由 `@vitejs/plugin-vue` 更新，React 组件由 `@vitejs/plugin-react` 更新。样式文件由 Vite 更新。

## 什么时候需要重启

修改组件和应用模块时不需要重启。以下工具链与依赖变化建议重启开发服务：

- 安装或升级依赖
- 修改 Vite 插件
- 修改 `vite-plugin-monkey` 的 server 或 build 集成
- 修改依赖解析或 alias
