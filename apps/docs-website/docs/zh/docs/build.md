# 构建与预览

本页从已经能运行的 Makoo 项目出发，生成可安装的 userscript，并在真实目标网页检查构建结果。

## 构建脚本

```sh
pnpm build
```

项目脚本应执行 `makoo build`。产物目录由 Vite 的 `build.outDir` 控制，未配置时通常为 `dist`；脚本文件名默认是 `${app.name}.user.js`，可通过 `monkey.build.fileName` 设置。

例如 `app.name: 'my-script'` 对应 `dist/my-script.user.js`。只有配置生成 metadata 文件时，才会同时产生 `.meta.js`。

## 检查元信息

打开产物头部的 userscript metadata，确认：

- `@name`、`@version` 与预期一致。
- `@match` 覆盖实际使用页面。
- `@grant`、`@connect`、`@require` 和 `@resource` 与所用能力一致。

配置含义见[项目配置](./configuration.md)。自动推导的权限应以实际产物为准。

## 预览并安装

```sh
pnpm preview
```

`makoo preview` 启动构建目录的预览服务，使用上一步生成的产物。打开输出地址，通过页面提供的 userscript 安装入口安装构建产物，再访问匹配网页验证功能。

测试正式脚本时，先在管理器中停用同功能的开发脚本，避免两份脚本重复挂载。正式产物不依赖本地 dev 服务。

## 自定义目录与调试构建

```sh
pnpm exec makoo build --outDir release
pnpm exec makoo preview --outDir release
```

build 和 preview 应使用同一产物目录。仅修改源码而未重新构建时，preview 展示的仍是之前的产物。

排查构建后才出现的问题，可以先关闭压缩并生成 source map：

```sh
pnpm exec makoo build --sourcemap --no-minify
```

全部参数见[CLI 命令](../api/cli.md)。

## 分发

把构建完成的 `.user.js` 提供给使用者安装。通过网站分发时，用户可以打开 `.user.js` 链接，在脚本管理器中安装。
