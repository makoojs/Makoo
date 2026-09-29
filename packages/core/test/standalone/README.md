# 独立 userscript 接入示例

本例只依赖 `@makoojs/test` 的公开入口。`demo.user.js` 是普通用户脚本，不依赖 Makoo 构建链；产物测试使用专用 matcher，E2E 直接使用套件准备好的 `userscriptPage`。

将本目录复制到仓库以外的新目录，并把构建后的 `@makoojs/test` tarball 放到该目录。创建以下 `package.json`：

```json
{
  "name": "standalone-userscript-example",
  "private": true,
  "type": "module",
  "scripts": {
    "test:artifacts": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

在新目录中执行：

```sh
npm install --save-dev ./makoojs-test-0.0.0.tgz vitest@4.1.7 @playwright/test@1.63.0
npm run test:artifacts
npx playwright install chromium
npm run test:e2e
```

`vitest.config.ts` 只收集 `artifact.case.ts`，`playwright.config.ts` 只收集 `browser.case.ts`。页面由套件内置服务器提供，管理器首次运行时自动下载；无需自行实现服务启动或安装逻辑。脚本的 `@match` 使用本机地址，适用于套件的随机端口。

仓库中的 `../artifacts/standalone.spec.ts` 自动在系统临时目录创建独立项目：

1. 打包、安装测试包 tarball，关闭自动 peer 安装和全局 `NODE_PATH`，验证未安装两个 runner 和 core 时，读取/解析的 ESM 与 CommonJS 入口仍可用。
2. 显式链接仓库已安装的固定工具链，运行本例产物测试、发现 E2E 用例，并用 NodeNext 与 Bundler 检查产物、matcher、页面配置类型。测试包始终来自 tarball，没有源码 alias。
3. 无论成功或失败都删除临时目录。

该自动化检查需要已缓存的包依赖，复用本地工具链，不证明新机器联网安装成功。真实浏览器交互尚未验收；`--list` 仅验证 runner 能加载用例。此目录和自动化检查均留在 core 测试范围内，不加入默认测试命令。
