# Userscript API

从浏览器应用代码中导入 `@makoojs/cli/monkey`。这些 API 依赖脚本管理器提供的 GM 环境，不要在 `vite.config.ts` 中调用。

## GM API

以下值从 `@makoojs/cli/monkey` 导出。

| 导出 | 方法或值 |
| --- | --- |
| `GMapi` | 包含 `raw`、`info`、`log`、`storage`、`style`、`request`、`menu`、`clipboard`、`notification`、`tab`、`download` 和 `resource` |
| `gm` | 原始 `GM` 对象 |
| `gmInfo` | `GM_info` |
| `gmLog` | `GM_log` |
| `monkeyWindow` | userscript window |
| `unsafeWindow` | 页面 window |
| `gmClipboard` | `set(data, type?, callback?)` |
| `gmDownload` | `start` |
| `gmMenu` | `register`、`unregister` |
| `gmNotification` | `show` |
| `gmRequest` | `send`、`get`、`post` |
| `gmResource` | `text`、`url` |
| `gmStorage` | `get`、`getMany`、`set`、`setMany`、`remove`、`removeMany`、`keys`、`watch`、`unwatch` |
| `gmStyle` | `add`、`element` |
| `gmTab` | `open`、`get`、`getAll`、`save` |

## 保存数据

`gmStorage` 读写脚本管理器中的持久化数据。例如记录脚本运行次数：

```ts
import { gmStorage } from '@makoojs/cli/monkey';

const runs = gmStorage.get<number>('runs', 0) + 1;
gmStorage.set('runs', runs);
console.log('Script runs:', runs);
```

## `gmRequest.get()` / `gmRequest.post()`

```ts
declare const gmRequest: {
	get<R extends GmResponseType = 'text', C = unknown>(
		url: string,
		options?: GmRequestOptions<R, C>
	): GmAbortHandle;

	post<R extends GmResponseType = 'text', C = unknown>(
		url: string,
		options?: GmRequestOptions<R, C>
	): GmAbortHandle;
};
```

`get()` 和 `post()` 分别固定请求方法为 `GET` 和 `POST`。

请求结果通过回调接收，返回的句柄可调用 `abort()` 取消请求：

```ts
import { gmRequest } from '@makoojs/cli/monkey';

gmRequest.get('https://example.com/', {
  onload(response) {
    console.log(response.status, response.responseText);
  },
  onerror(error) {
    console.error(error);
  }
});
```

跨域请求的目标域名通过 `monkey.userscript.connect` 配置。

## GM 类型

```ts
type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;
```

`@makoojs/cli/monkey` 还重新导出以下 `vite-plugin-monkey` 类型：

- `GmAbortHandle`
- `GmAddElementAttributes`
- `GmDownloadOptions`
- `GmInfoType`
- `GmMenuCommandOptions`
- `GmNotificationOptions`
- `GmOpenInTabOptions`
- `GmResponseEvent`
- `GmResponseType`
- `GmTabControl`
- `GmType`
- `GmValueListenerId`
- `GmXmlhttpRequestOption`
- `MonkeyWindow`
