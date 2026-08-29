# Configuration

Makoo is configured through the `makoo()` Vite plugin. This file selects the application
module, defines project metadata, and passes userscript options to `vite-plugin-monkey`.

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1',
				description: 'Enhance example.com with injected UI'
			},
			monkey: {
				userscript: {
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

Use `vite.config.ts` for settings that affect the whole project. Declare `injectAt`,
components, listeners, and lifecycle behavior in application code.

## Option Groups

| Group | Purpose |
| --- | --- |
| `entry` | Application module loaded by Vite and the userscript build |
| `app` | Makoo app metadata and default userscript name/version |
| `monkey` | `vite-plugin-monkey` userscript, server, and build options |

## `app`

`app` is required.

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1',
				description: 'Optional script description'
			},
			monkey: {}
		})
	]
});
```

| Field | Description |
| --- | --- |
| `name` | Required app name. Also becomes the default userscript `name` |
| `version` | Required version. Also becomes the default userscript `version` |
| `description` | Optional description. Also becomes the default userscript `description` |

Values in `monkey.userscript` can still override the generated userscript metadata when you
need more control.

## `monkey`

Most `monkey` options are passed to `vite-plugin-monkey`.

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/main.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					namespace: 'npm/makoo',
					match: ['https://example.com/*'],
					grant: ['GM_getValue', 'GM_setValue']
				},
				server: {
					open: true,
					prefix: 'server:'
				},
				build: {
					fileName: 'my-script.user.js',
					metaFileName: true,
					autoGrant: true
				}
			}
		})
	]
});
```

## Defaults

Defaults:

| Option | Default |
| --- | --- |
| `monkey.align` | `2` |
| `monkey.styleImport` | `true` |
| `monkey.server.prefix` | `'server:'` |
| `monkey.build.fileName` | `${app.name}.user.js` |
| `monkey.build.metaFileName` | `false` |
| `monkey.build.autoGrant` | `true` |

## Configuration Boundary

Keep this split in mind:

| File | Owns |
| --- | --- |
| `vite.config.ts` | Application module, project metadata, userscript build/dev options |
| Application code | Runtime setup, adapters, tasks, targets, and lifecycle options |
| Feature modules | Component code and styles |

This boundary keeps Makoo projects understandable as they grow.
