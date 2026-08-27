# @makoojs/cli

`@makoojs/cli` provides Makoo's Vite plugin and CLI commands, with userscript development and build capabilities powered by [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).

Application code composes runtime behavior through `createMakoo()`, `inject()`, and `listen()` from `@makoojs/core`. `@makoojs/cli` handles the Vite and userscript build integration.

## Use Cases

- Develop Makoo userscript projects with Vite.
- Generate userscript metadata, dev entries, and build output through [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey).
- Use the `makoo dev` and `makoo build` commands.
- Use Makoo's stable GM API entry through `@makoojs/cli/monkey`.

## Installation

```bash
# npm install @makoojs/cli
# yarn add @makoojs/cli
pnpm add @makoojs/cli
```

If you create a project with `@makoojs/create-makoo`, `@makoojs/cli` is usually configured for you.

## Minimal Vite Config

Use `makoo()` in the Vite configuration:

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		vue(),
		makoo({
			entry: './src/app.ts',
			app: {
				name: 'my-userscript',
				version: '0.0.1',
				description: 'My first Makoo script'
			},
			monkey: {
				userscript: {
					namespace: 'https://example.com',
					// This is only an example. Replace it with the pages supported by the userscript.
					match: ['https://www.google.com/']
				}
			}
		})
	]
});
```

`makoo()` passes the configuration to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) for userscript development and builds.

## Configuration Overview

`makoo()` has three main configuration areas:

```ts
makoo({
	entry: './src/app.ts',
	app: {
		name: 'my-script',
		version: '0.0.1',
		description: 'demo script'
	},
	monkey: {
		userscript: {
			match: ['https://www.google.com/']
		}
	}
});
```

| Config | Description |
| --- | --- |
| `entry` | Application module passed to Vite for building |
| `app` | Generates userscript `name`, `version`, and `description` |
| `monkey` | Most options are passed through to [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) |

By default, `monkey.build.autoGrant` is `true`, so [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) generates `@grant` from the final code.

## CLI Commands

After installation, you can use the `makoo` command:

| Command | Description |
| --- | --- |
| `makoo dev` | Starts the Vite dev server and prints the local URL |
| `makoo build` | Runs Vite build and generates userscript output |
| `makoo preview` | Previews the built userscript with the Vite preview server |

## Use GM APIs

`@makoojs/cli` provides the `@makoojs/cli/monkey` subpath as Makoo's stable wrapper around [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) GM APIs.

```ts
import { gmStorage, gmStyle } from '@makoojs/cli/monkey';

gmStyle.add('.makoo-panel { z-index: 999999; }');
gmStorage.set('enabled', true);
```

You can also use the grouped entry:

```ts
import { GMapi } from '@makoojs/cli/monkey';

GMapi.storage.set('enabled', true);
```

Use capability-level imports when you want the generated `@grant` surface to stay as small as possible. See the CLI API documentation for the complete GM API.

## Reduce Build Size

`@makoojs/cli` re-exports `cdn` from [lisonge/vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey). Use it with `monkey.build.externalGlobals` to load external dependencies from a CDN and reduce userscript bundle size.

```ts
import { defineConfig } from 'vite';
import { cdn, makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			entry: './src/app.ts',
			app: {
				name: 'my-script',
				version: '0.0.1'
			},
			monkey: {
				build: {
					externalGlobals: {
						vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js')
					}
				}
			}
		})
	]
});
```

## Relationship To Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/cli` | Vite plugin, CLI commands, and userscript build integration |
| `@makoojs/core` | Framework-agnostic injection runtime core |
| `@makoojs/vue` | Vue adapter and Vue plugin registration |
| `@makoojs/react` | React adapter |
| `@makoojs/create-makoo` | Project scaffold |

Application code composes runtime behavior through `@makoojs/core`.
