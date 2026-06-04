# @makoo/create-makoo

`@makoo/create-makoo` 是 Makoo 的项目脚手架。它通过交互式命令生成一个可以直接运行的 userscript 项目，并根据选择创建 Vue 或 React 模板。

生成后的项目会使用 `@makoo/cli` 作为开发和构建入口，通过 `makoo dev` 启动开发服务，通过 `makoo build` 构建最终 userscript。

## 适用场景

- 快速创建一个新的 Makoo userscript 项目。
- 在 Vue 和 React 模板之间选择起点。
- 选择 TypeScript 或 JavaScript 项目结构。
- 生成包含 manifest、Vite 配置、示例 injection 和基础资源的项目。

## 使用

推荐通过包管理器的临时执行能力运行脚手架：

```bash
pnpm dlx @makoo/create-makoo
```

也可以使用 npm 或 yarn：

```bash
npx @makoo/create-makoo
yarn dlx @makoo/create-makoo
```

脚手架会询问：

| 问题 | 说明 |
| --- | --- |
| Project name | 生成的项目目录名，默认 `makoo-project` |
| Userscript name | userscript 头部中的 `@name` |
| Version | 项目版本和 userscript 版本 |
| Namespace | userscript 头部中的 `@namespace` |
| Match URL(s) | userscript 匹配页面，支持逗号分隔多个 URL |
| Variant | 选择 TypeScript 或 JavaScript |
| Framework | 选择 Vue 或 React |
| Install with package manager | 是否立即安装依赖；安装完成后会提示运行 dev 命令 |

如果目标目录已经存在且不为空，脚手架会让你选择取消、删除原有文件继续，或忽略已有文件继续。

## 生成内容

Vue 模板会生成：

```txt
package.json
vite.config.ts/js
injections/manifest.ts/js
injections/hello-world/app.vue
assets/vue.svg
assets/makoo-icon-transparent.png
.gitignore
```

React 模板会生成：

```txt
package.json
vite.config.ts/js
injections/manifest.ts/js
injections/hello-world/app.tsx/jsx
injections/hello-world/style.css
assets/react.svg
assets/makoo-icon-transparent.png
.gitignore
```

选择 TypeScript 时，还会生成：

```txt
tsconfig.json
tsconfig.app.json
tsconfig.node.json
```

## 项目脚本

生成项目的 `package.json` 会包含：

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "vue-tsc -b && makoo build",
		"typecheck": "vue-tsc -b"
	}
}
```

React TypeScript 模板会使用 `tsc -b`：

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "tsc -b && makoo build",
		"typecheck": "tsc -b"
	}
}
```

JavaScript 模板不会生成 typecheck 脚本，build 会直接执行：

```bash
makoo build
```

## 模板说明

生成的 `injections/manifest.ts/js` 会注册一个 `hello-world` injection，默认注入到 `body`。

Vue 模板会配置 `@vitejs/plugin-vue`，并在 userscript 构建中把 Vue 作为外部全局依赖加载。

React 模板会配置 `@vitejs/plugin-react`。由于 React 19 相关包不再提供官方 UMD 构建，模板会使用第三方 `umd-react` CDN，并把 `react`、`react-dom` 和 `react-dom/client` 配置为外部全局依赖。

## 与其他包的关系

| 包 | 职责 |
| --- | --- |
| `@makoo/create-makoo` | 交互式创建 Makoo 项目 |
| `@makoo/cli` | 生成项目中的 dev/build 命令入口 |
| `@makoo/core` | 注入调度 runtime |
| `@makoo/vue` | Vue 模板使用的挂载适配器 |
| `@makoo/react` | React 模板使用的挂载适配器 |

`@makoo/create-makoo` 只负责创建项目。后续开发、扫描 manifest、生成虚拟入口和构建 userscript 都由生成项目中的 `@makoo/cli` 完成。
