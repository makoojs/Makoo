# @makoojs/test

Userscript 专用测试套件。当前为 workspace 内私有原型，尚未发布。

接入时按需求选择入口：产物测试使用 `readUserscript` 和 `/vitest` matcher；浏览器测试使用 `/playwright` 的 `test`、`expect` 和 `userscriptPage`。也可以单独使用 `/metadata` 解析字符串。

## 安装与最小项目

先在仓库根目录执行 `pnpm --filter @makoojs/test build`，再用 `npm pack ./packages/test --ignore-scripts` 生成 tarball。将 tarball 放到自己的项目中，按需安装：

```sh
# 产物读取与字符串解析
npm install --save-dev ./makoojs-test-0.0.0.tgz
# 专用产物断言
npm install --save-dev vitest@4.1.7
# 真实管理器测试
npm install --save-dev @playwright/test@1.63.0
npx playwright install chromium
```

只读取产物时可以省略两个 runner。执行 Vitest 测试时使用 `vitest run`，执行 E2E 时使用 `playwright test`。两个 runner 应通过各自配置限定测试文件，避免相互收集。

完整的独立项目示例位于 `packages/core/test/standalone`，包含普通 `.user.js`、产物 matcher 用例和页面交互用例，不需要安装 Makoo core 或 CLI。

## 产物断言

```ts
import { readUserscript } from '@makoojs/test';
import '@makoojs/test/vitest';
import { expect, test } from 'vitest';

test('构建输出正确', async () => {
 const artifact = await readUserscript('./dist/demo.user.js');
 expect(artifact).toHaveMetadata('name', 'demo');
 expect(artifact).toHaveClassicScriptSyntax();
 expect(artifact).toHaveMetadataValues('match', ['https://example.com/*']);
 expect(artifact).toHaveGrant('GM_getValue');
 expect(artifact).not.toHaveGrant('unsafeWindow');
 expect(artifact).toHaveResource('data', 'https://assets.example.com/data.json');
 const meta = await readUserscript('./dist/demo.meta.js');
 expect(artifact).toHaveSameMetadataAs(meta);
});
```

`/vitest` 自动注册 matcher 并提供 TypeScript 类型，使用 Vitest 原有的 `.not`、`.resolves` 和报告机制。失败信息包含文件路径、相关字段行号或 metadata 偏移，以及实际值和预期值。

| matcher | 语义 |
| --- | --- |
| `toHaveClassicScriptSyntax()` | 用当前 Node/V8 编译器检查经典脚本语法，不执行代码；不保证目标浏览器版本兼容或运行成功 |
| `toHaveMetadata(key)` | 字段存在，包括无值字段 |
| `toHaveMetadata(key, value)` | 字段的多个值中包含指定值 |
| `toHaveMetadataValues(key, values)` | 值数组完全相等，保留顺序和重复项；缺失字段不等于空数组 |
| `toHaveGrant(name)` | grant 声明包含指定值 |
| `toHaveResource(name, url)` | resource 声明包含指定名称和 URL，忽略两者间的对齐空白 |
| `toHaveSameMetadataAs(otherArtifact)` | 全部字段及其值一致，忽略不同字段间的排列顺序，保留同一字段的值顺序 |

这些断言检查产物声明；`toHaveGrant` 不表示 GM API 已运行，match 字符串断言不模拟管理器匹配语义。

## 真实管理器 E2E

```ts
import { test, expect } from '@makoojs/test/playwright';

test.use({
 manager: 'violentmonkey',
 userscript: './dist/demo.user.js',
 baseURL: 'http://localhost:3000'
});

test('点击更新计数', async ({ userscriptPage: page }) => {
 await page.goto('/counter');
 await page.getByRole('button', { name: '增加' }).click();
 await expect(page.getByText('计数：1')).toBeVisible();
});
```

套件负责隔离 profile、加载管理器、自动安装最终文件、创建页面、关闭浏览器、清理临时资源并保存日志和 trace。使用者定义页面行为。`userscriptPage` 是标准 Playwright Page，只有安装确认成功后才提供给用例；脚本实际执行结果由用例断言。

| 配置 | 默认值与语义 |
| --- | --- |
| `userscript` | 必填；文件路径相对测试进程 cwd 解析，或传入 `{ build }` |
| `manager` | `'violentmonkey'`；当前唯一实现的管理器 |
| `managerPath` | 可选；准备好的固定版本扩展目录，省略时自动下载 |
| `testPages` | 默认 `{}`；内置服务器提供的 HTML 路径与内容 |
| `baseURL` | 可选；省略时页面使用内置服务器地址，提供时页面访问外部应用 |
| `headless` | 继承 Playwright 配置，传给套件创建的 Chromium context |

`UserscriptBuildContext`、`UserscriptInput`、`UserscriptOptions` 和 `UserscriptFixtures` 可从 `/playwright` 导入。内部资源 fixture 不属于公开配置。用例应使用 `userscriptPage`；Playwright 原生 `page` fixture 使用另一套 context，不包含套件安装的脚本。

现有应用可以通过 Playwright `webServer` 启动，配合 `baseURL` 使用。简单静态页面也可交给套件准备；需要将随机端口写进构建配置时，提供可选的 build 配置：

```ts
 test.use({
  testPages: { '/counter': '<button id="increment">增加</button>' },
  userscript: {
   build: async ({ baseURL, outputDir }) => {
    // 调用项目自己的构建函数，构建前配置 match，并输出到 outputDir。
    return buildMyUserscript({ baseURL, outputDir }); // 返回最终文件路径
   }
  }
 });
```

`testPages` 的值为完整 HTML；不包装框架或插件。提供外部 `baseURL` 时，页面访问该应用，内置 HTTP 服务提供安装文件、产物资源和显式静态页面。`/install`、`/userscript.user.js` 为套件保留路径。build 回调应将临时输出写进给定目录，套件在成功、异常和构建超时后清理该目录并关闭服务。

最终脚本所在目录作为资源根目录，支持 `@require ./helper.js`、`@resource data ./assets/data.json` 等相对 URL；脚本内容保持原样。资源文件须位于该目录或其子目录内，越界路径及指向目录外的符号链接会被拒绝。请使用专用产物目录，该目录内的文件均可被本地测试服务读取。保留路径优先，其次为 `testPages`，最后为产物资源；需要测试页面与资源使用不同路径。

默认使用 Violentmonkey 2.49.0 MV3，自动下载官方固定压缩包并校验 SHA-256。浏览器需由使用者预先执行 `playwright install chromium` 安装；当前固定 Playwright 1.63.0。支持 Playwright 的 `headless` 选项，其他普通 `use` 选项暂不保证传递到自建 context。

可提前调用 `prepareManager(directory)` 准备专用扩展目录，再设置 `managerPath` 复用；该目录供管理器独占，准备过程会替换其内容。提供 `managerPath` 时校验 manifest 版本，调用者负责该目录来源。未提供时每次测试独立下载到临时目录，目前没有共享下载缓存。

已在 Ubuntu 24.04、Node 24、Playwright 1.63.0 对应 Chromium 与 Violentmonkey 2.49.0 MV3 上验证真实安装、点击更新、销毁重建、alive 重挂载、匹配排除和 GM 存储隔离，包含 Vue + Pinia、React 与 core tarball 消费。运行环境必须允许 Chromium 启动和进程通信；其他浏览器、管理器版本及操作系统尚无验收结论。运行证据与重复执行记录见 `packages/core/test/STAGES.md`。

## 入口与依赖

| 入口 | 内容 | 依赖 |
| --- | --- | --- |
| `@makoojs/test` | `readUserscript`、解析函数和类型 | Node 内置文件 API |
| `@makoojs/test/metadata` | `parseMetadata`、结构错误及类型 | 无文件系统/runner 依赖 |
| `@makoojs/test/vitest` | 自动注册 matcher；亦导出 `userscriptMatchers` | 可选 peer：Vitest 4.1.7 系列，ESM 使用 |
| `@makoojs/test/playwright` | `test`、`expect`、`prepareManager` 及配置类型 | 可选 peer：Playwright Test 1.63.0；fflate 用于解压 |

导入读取或解析入口不会加载浏览器、注册 matcher 或下载管理器。

已验证 Node 24、TypeScript 5.9.3 下的 ESM 类型消费，覆盖 `moduleResolution: NodeNext` 和 `Bundler`，无需源码 alias 或 `skipLibCheck`。独立 tarball 项目还检查了 `.cts` 文件通过 NodeNext 消费根入口、`/metadata` 和 `/playwright` 的类型，并验证错误参数会被拒绝。读取/解析入口同时验证了 CommonJS 运行时导出；`/vitest` 使用 ESM。上述类型结论限于已验证的 TypeScript 版本和解析模式。`fflate` 是包的安装依赖，但只被管理器入口加载。

解析器读取文件开头的 metadata comment block，允许 BOM 与前置空白，支持 LF/CRLF/CR。重复字段保留为数组，未知字段和本地化名称保留。首尾空白去除，值内部空白保留。解析到结束标记即停止，不扫描后面的 JavaScript。

`MetadataParseError` 提供 `code`、从 1 开始的 `line` 和 UTF-16 `offset`。code 包括 `MISSING_METADATA`、`UNCLOSED_METADATA`、`INVALID_METADATA_LINE`。读取错误保留 Node 原始错误。

## 失败排查

E2E 报告附件中的 `run.log` 记录 `Last stage`。按最后阶段定位准备或行为失败：

| 阶段 | 优先检查 |
| --- | --- |
| `server` | 本机是否允许监听 TCP 端口 |
| `artifact` | 产物路径、metadata、build 回调是否返回；构建耗时是否超过测试 timeout |
| `manager preparation` | GitHub 下载连接、压缩包校验、`managerPath` 中的版本和 MV3 manifest |
| `browser` | Chromium 是否已安装，系统库与进程通信权限是否满足启动条件 |
| `manager permissions` | 扩展是否加载、Chromium 用户脚本开关是否可以操作 |
| `install` | 管理器确认页、产物相对资源请求与 trace |
| `behavior` | 用例预期、页面地址、metadata 匹配规则与页面日志 |

`userscript` 附件保留最终脚本；浏览器 trace 启动后保存 `trace` 附件。`environment.json` 在权限准备成功后记录浏览器、管理器版本与脚本 SHA-256；此前失败时没有该附件。`cleanup.json` 在服务关闭、临时目录删除后产生。可用 `playwright show-trace <trace.zip>` 查看交互过程。

浏览器启动前失败的报告没有页面 trace，重复启动也不能解决环境权限限制。请在具备所需权限的本机或 CI 执行同一入口，再判断管理器安装与行为结果。

## 仓库内验证

```sh
pnpm install --frozen-lockfile
pnpm build:core
pnpm --filter @makoojs/test build
pnpm -C packages/core/test/frameworks install --frozen-lockfile
pnpm store add fflate@0.8.2
pnpm exec vitest run --config packages/core/test/artifacts/vitest.config.ts
pnpm exec tsc --project packages/core/test/artifacts/tsconfig.types.json
```

产物案例消费新包的 dist 入口。E2E 的独立安装、命令及验证边界见 `packages/core/test/e2e/README.md`。测试案例均留在 core 范围内，默认 Vitest 入口不包含这两组 `.spec.ts`。
