#!/usr/bin/env node
import { MakooError } from '@makoojs/core';
import cac from 'cac';
import { buildCommand } from './commands/build';
import { devCommand } from './commands/dev';
import { previewCommand } from './commands/preview';
import { loadCliVersion } from './version';

const cli = cac('makoo');

cli.command('build', 'Build the userscript').action(async () => {
	await buildCommand();
});

cli.command('dev', 'Start the dev server').action(async () => {
	await devCommand();
});

cli.command('preview', 'Preview the built userscript').action(async () => {
	await previewCommand();
});

cli.help();
cli.version(await loadCliVersion(null));

process.on('unhandledRejection', (err) => {
	if (err instanceof MakooError) {
		console.error(err);
	} else {
		console.error('[makoo]', err);
	}
	process.exit(1);
});

cli.parse();
