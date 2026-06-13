# @makoojs/cli

`@makoojs/cli` provides Makoo's Vite plugin, manifest type helpers, and selected re-exports from `vite-plugin-monkey`. It resolves config, scans `injections/`, generates the runtime entry, and delegates userscript output to `vite-plugin-monkey`.

## Exports

```ts
import { makoo, defineInjections, defineInjection, cdn } from '@makoojs/cli';
```

Common types:

```ts
import type {
	MakooOptions,
	AppConfig,
	CliConfig,
	SourceConfig,
	RuntimeConfig,
	InjectorConfig,
	MonkeyConfig,
	MonkeyBuildConfig,
	MonkeyServerConfig,
	InjectionManifest,
	InjectionModuleConfig,
	InjectionFramework
} from '@makoojs/cli';
```

## makoo()

`makoo()` is the Vite plugin entry. It returns a plugin array containing Makoo's scanner/virtual-entry plugin and `vite-plugin-monkey`.

```ts
import { defineConfig } from 'vite';
import { makoo } from '@makoojs/cli';

export default defineConfig({
	plugins: [
		makoo({
			app: {
				name: 'selector-picker',
				version: '0.0.1'
			},
			monkey: {
				userscript: {
					namespace: 'npm/makoo',
					match: ['https://example.com/*']
				}
			}
		})
	]
});
```

Signature:

```ts
function makoo(options: MakooOptions): Plugin[];
```

`MakooOptions` extends `CliConfig` with an optional `root`:

```ts
type MakooOptions = CliConfig & {
	root?: string;
};
```

## Config Shape

```ts
type CliConfig = {
	app: AppConfig;
	monkey?: MonkeyConfig;
	source?: SourceConfig;
	runtime?: RuntimeConfig;
};
```

### app

`app` contains Makoo-level app metadata.

```ts
type AppConfig = {
	name: string;
	version: string;
	description?: string;
};
```

`name` and `version` participate in generated userscript metadata. `description` can describe the script.

### monkey

Most `monkey` options are passed through to `vite-plugin-monkey`.

```ts
type MonkeyConfig = {
	userscript?: MonkeyUserScript;
	align?: number | false;
	generate?: (options: MonkeyGenerateContext) => Thenable<string>;
	styleImport?: boolean;
	server?: MonkeyServerConfig;
	build?: MonkeyBuildConfig;
};
```

Example:

```ts
makoo({
	app: {
		name: 'my-tool',
		version: '0.0.1'
	},
	monkey: {
		userscript: {
			namespace: 'npm/makoo',
			match: ['https://example.com/*'],
			grant: ['GM_setValue', 'GM_getValue']
		},
		server: {
			open: false,
			prefix: 'server:'
		},
		build: {
			fileName: 'my-tool.user.js',
			metaFileName: false
		}
	}
});
```

Makoo manages `clientAlias` and `server.mountGmApi` internally. Users should not configure these two options.

### source

`source` controls which injection modules Makoo scans.

```ts
type SourceConfig = {
	include?: string[];
	exclude?: string[];
};
```

By default, Makoo scans first-level directories under `injections/`:

```ts
source: {
	include: ['*'],
	exclude: []
}
```

These `include` / `exclude` rules filter module directories, not URLs.

### runtime

`runtime.setup` imports side-effect files before Makoo creates and runs the injector.

```ts
type RuntimeConfig = {
	setup?: string | string[];
};
```

Example:

```ts
makoo({
	app: {
		name: 'my-tool',
		version: '0.0.1'
	},
	runtime: {
		setup: ['./injections/setup.js']
	}
});
```

Use it for project-level runtime preparation, such as creating a dedicated host node, installing global services, or loading side-effect polyfills.

## defineInjections()

`defineInjections()` is a type helper for top-level manifests. It does not transform the runtime value.

`injectionDefaults` defines shared injection runtime defaults for the current manifest. Modules inherit `alive`, `scope`, `timeout`, and `hooks` from it unless they override those fields themselves.

```ts
import { defineInjections } from '@makoojs/cli';

export default defineInjections({
	injectionDefaults: {
		alive: true,
		scope: 'global'
	},
	injections: {
		'selector-picker': {
			injectAt: 'body',
			component: './devtools/app.jsx',
			framework: 'React'
		}
	}
});
```

Signature:

```ts
function defineInjections<T extends InjectionManifest>(manifest: T): T;
```

## defineInjection()

`defineInjection()` is a type helper for a single module config, usually used in module-level manifests.

```ts
import { defineInjection } from '@makoojs/cli';

export default defineInjection({
	injectAt: '#toolbar',
	component: './app.vue',
	framework: 'Vue',
	alive: true
});
```

Signature:

```ts
function defineInjection<T extends InjectionModuleConfig>(config: T): T;
```

## Manifest Types

Top-level manifest:

```ts
type InjectionManifest = {
	injectionDefaults?: InjectorConfig;
	injections: InjectionModuleConfig[] | Record<string, Omit<InjectionModuleConfig, 'name'>>;
};
```

Module config:

```ts
type InjectionModuleConfig = ArtifactOptions & {
	name?: string;
	injectAt: string;
	component: string;
	framework?: 'auto' | 'Vue' | 'React';
	enabled?: boolean;
	match?: string[] | {
		include?: string[];
		exclude?: string[];
	};
};
```

Common fields:

| Field | Description |
| --- | --- |
| `name` | Stable module id for array-form manifests |
| `injectAt` | Target DOM CSS selector |
| `component` | Component path relative to the current manifest |
| `framework` | `'auto'`, `'Vue'`, or `'React'` |
| `enabled` | Whether the module is enabled; defaults to `true` |
| `match` | Module-level URL match rules |
| `alive` | Whether reinjection is enabled |
| `scope` | Alive observer scope, `'local'` or `'global'` |
| `timeout` | Milliseconds to wait for the target node |
| `hooks` | Module-level lifecycle hooks |
| `on` | External listener bound together with the component task |

## cdn

`cdn` is re-exported from `vite-plugin-monkey` and can be used to configure CDN URLs for external dependencies.

```ts
import { cdn } from '@makoojs/cli';
```

Its exact usage follows `vite-plugin-monkey`.

## CLI Commands

Generated projects usually define:

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "makoo build"
	}
}
```

Commands:

| Command | Description |
| --- | --- |
| `makoo dev` | Start the Vite dev server and generate the development userscript |
| `makoo build` | Build the production userscript |
| `makoo inspect` | Inspect resolved config and scan results |
| `makoo add` | Add an injection module config to the manifest |
