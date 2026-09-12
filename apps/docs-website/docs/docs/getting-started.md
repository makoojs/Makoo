# Getting Started

Create a project, install its development script in your browser, and see the first component on a target page.

## 1. Prepare your environment

- Node.js 20.19+ (20.x) or 22.12+, and pnpm.
- Install and enable a browser script manager such as Tampermonkey or ScriptCat.
- Choose a page for testing. This example uses `https://example.com/`.

For an existing Vite project, see [Manual Installation](./installation.md).

## 2. Create a project

```sh
pnpm dlx @makoojs/create-makoo
```

The prompts ask for a project name, script name, version, namespace, matching URLs, language, and framework. Use `makoo-project` as the project name, `https://example.com/*` as the match rule, and TypeScript with Vue or React.

Enter the generated directory. If you skipped dependency installation during creation, run `pnpm install` first:

```sh
cd makoo-project
pnpm install
pnpm dev
```

## 3. Install the development script

Open the local URL printed in the terminal and confirm installation in your script manager. Then visit `https://example.com/`. The template’s Hello World component should appear on the page.

The installation entry and the target page serve different purposes: one installs the script; the other runs your component. Keep `pnpm dev` running during development.

If the component does not appear, check that the current URL matches `monkey.userscript.match` in `vite.config.ts`, then inspect the browser console. See [Troubleshooting](./troubleshooting.md) for the full checklist.

## 4. Find the application entry

The main template files are:

```text
vite.config.ts                 # Userscript metadata and build configuration
src/main.ts                    # Create the Runtime and start tasks
src/injections/hello-world/    # Vue or React component and styles
assets/                        # Example assets
```

Edit the text in `src/injections/hello-world/App.vue` or `App.tsx`, then return to the target page to see the change.

## 5. Understand the first task

The Vue template uses this combination:

```ts
import { createMakoo, inject } from '@makoojs/core';
import { createVueAdapter } from '@makoojs/vue';
import App from './injections/hello-world/App.vue';

createMakoo({ adapters: [createVueAdapter()] }).start([
  inject({ id: 'hello-world', injectAt: 'body', artifact: App })
]);
```

`inject()` declares a task; `start()` registers and runs it. `injectAt: 'body'` selects the host element and `artifact` is the component to mount. React projects use `createReactAdapter()` and `App.tsx`; see [Component Injection](./injection.md) for both examples.

## Next steps

- [Core Concepts](./concepts.md): distinguish configuration, declarations, Runtime, and components.
- [Local Development](./development.md): add `makooDev()` and use task inspection and terminal actions.
- [Build and Preview](./build.md): produce and inspect a release userscript.
