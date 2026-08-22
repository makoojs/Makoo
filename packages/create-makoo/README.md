# @makoojs/create-makoo

`@makoojs/create-makoo` is Makoo's project scaffolding tool. It creates a ready-to-run userscript project through an interactive command and generates either a Vue or React template based on your choices.

The generated project uses the development and build commands from `@makoojs/cli`. Use `makoo dev` to start the development server and `makoo build` to build the final userscript.

## Use Cases

- Quickly create a new Makoo userscript project.
- Choose between Vue and React templates.
- Choose a TypeScript or JavaScript project structure.
- Generate a project with Vite config, an example injection, and basic assets.

## Usage

Run the scaffolder through your package manager's temporary execution command:

```bash
pnpm dlx @makoojs/create-makoo
```

You can also use npm or yarn:

```bash
npx @makoojs/create-makoo
yarn dlx @makoojs/create-makoo
```

The scaffolder asks for:

| Prompt | Description |
| --- | --- |
| Project name | Generated project directory name, defaulting to `makoo-project` |
| Userscript name | The `@name` value in the userscript header |
| Version | Project version and userscript version |
| Namespace | The `@namespace` value in the userscript header |
| Match URL(s) | Userscript match pages, supporting comma-separated URLs |
| Variant | TypeScript or JavaScript |
| Framework | Vue or React |
| Install with package manager | Whether to install dependencies immediately; after installation, it prints the dev command |

If the target directory already exists and is not empty, the scaffolder asks whether to cancel, remove existing files and continue, or ignore existing files and continue.

## Generated Files

The Vue template generates:

```txt
package.json
vite.config.ts/js
src/main.ts/js
src/injections/hello-world/App.vue
assets/vue.svg
assets/makoo-icon-transparent.png
.gitignore
```

The React template generates:

```txt
package.json
vite.config.ts/js
src/main.ts/js
src/injections/hello-world/App.tsx/jsx
src/injections/hello-world/style.css
assets/react.svg
assets/makoo-icon-transparent.png
.gitignore
```

When TypeScript is selected, it also generates:

```txt
tsconfig.json
tsconfig.app.json
tsconfig.node.json
env.d.ts
```

## Project Scripts

The generated `package.json` includes:

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "vue-tsc -b && makoo build",
		"typecheck": "vue-tsc -b"
	}
}
```

The React TypeScript template uses `tsc -b`:

```json
{
	"scripts": {
		"dev": "makoo dev",
		"build": "tsc -b && makoo build",
		"typecheck": "tsc -b"
	}
}
```

JavaScript templates do not include a typecheck script, and build runs:

```bash
makoo build
```

## Template Notes

The generated application code starts Makoo and registers a `hello-world` injection that targets `body` by default.

The Vue template configures `@vitejs/plugin-vue` and loads Vue as an external global dependency during userscript builds.

The React template configures `@vitejs/plugin-react`. Because React 19 related packages no longer provide official UMD builds, the template uses the third-party `umd-react` CDN and configures `react`, `react-dom`, and `react-dom/client` as external global dependencies.

## Relationship With Other Packages

| Package | Responsibility |
| --- | --- |
| `@makoojs/create-makoo` | Interactive project creation |
| `@makoojs/cli` | Development and build capabilities for Makoo projects |
| `@makoojs/core` | Injection task scheduling |
| `@makoojs/vue` | Vue component mounting |
| `@makoojs/react` | React component mounting |

`@makoojs/create-makoo` provides project creation, `@makoojs/cli` provides development and build capabilities, and `@makoojs/core` provides runtime task composition.
