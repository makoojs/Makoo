# @makoojs/create-makoo

<p>
  <a href="https://www.npmjs.com/package/@makoojs/create-makoo"><img alt="npm" src="https://img.shields.io/npm/v/@makoojs/create-makoo?style=flat-square"></a>
  <a href="https://github.com/makoojs/Makoo/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square"></a>
</p>

<p>
  <a href="https://makoojs.github.io/Makoo/docs/getting-started">Quick Start</a> •
  <a href="https://github.com/makoojs/Makoo">Makoo</a> •
  <a href="https://github.com/makoojs/Makoo/blob/main/packages/create-makoo/README.CN.md">中文</a>
</p>

The project scaffold for Makoo. Answer a few questions and you get a userscript project that runs right away: the Vite config, dev commands, and an example component are all ready.

## Usage

```sh
pnpm dlx @makoojs/create-makoo
```

You can also use `npx @makoojs/create-makoo` or `yarn dlx @makoojs/create-makoo`.

The scaffold asks, in order, for the project name, userscript name, version, namespace, and match URLs, then lets you choose TypeScript or JavaScript and Vue or React, and finally asks whether to install dependencies right away.

After it finishes:

```sh
cd makoo-project
pnpm dev
```

Open the address printed in the terminal in your browser and install the dev script, then visit a matching page, and you'll see the example component.

> [!NOTE]
> When the target directory already exists and isn't empty, the scaffold lets you cancel, remove the existing files and continue, or keep the existing files and continue.

## Documentation

- [Quick Start](https://makoojs.github.io/Makoo/docs/getting-started): from creating a project to seeing your first component on a web page.
- [Tutorial: A Toggleable Tool Panel](https://makoojs.github.io/Makoo/docs/tutorial): build a complete small feature on top of the generated project.
