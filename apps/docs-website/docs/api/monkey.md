# Userscript APIs

Import `@makoojs/cli/monkey` in browser application code. These APIs require the script manager’s GM environment; do not call them in `vite.config.ts`.

## GM APIs

The following values are exported from `@makoojs/cli/monkey`.

| Export | Methods or value |
| --- | --- |
| `GMapi` | Contains `raw`, `info`, `log`, `storage`, `style`, `request`, `menu`, `clipboard`, `notification`, `tab`, `download`, and `resource` |
| `gm` | Original `GM` object |
| `gmInfo` | `GM_info` |
| `gmLog` | `GM_log` |
| `monkeyWindow` | Userscript window |
| `unsafeWindow` | Page window |
| `gmClipboard` | `set(data, type?, callback?)` |
| `gmDownload` | `start` |
| `gmMenu` | `register`, `unregister` |
| `gmNotification` | `show` |
| `gmRequest` | `send`, `get`, `post` |
| `gmResource` | `text`, `url` |
| `gmStorage` | `get`, `getMany`, `set`, `setMany`, `remove`, `removeMany`, `keys`, `watch`, `unwatch` |
| `gmStyle` | `add`, `element` |
| `gmTab` | `open`, `get`, `getAll`, `save` |

## Store data

`gmStorage` reads and writes persistent data in the script manager. For example, count how many times the script has run:

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

`get()` and `post()` set the request method to `GET` and `POST`, respectively.

Receive the response through callbacks. The returned handle provides `abort()` to cancel the request:

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

Configure cross-origin request domains through `monkey.userscript.connect`.

## GM types

```ts
type GmRequestOptions<R extends GmResponseType = 'text', C = unknown> = Omit<
	GmXmlhttpRequestOption<R, C>,
	'url' | 'method'
>;
```

`@makoojs/cli/monkey` also re-exports these types from `vite-plugin-monkey`:

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
