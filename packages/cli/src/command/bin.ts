#!/usr/bin/env node
import { MakooError } from '@makoojs/core';
import cac from 'cac';
import { buildCommand } from './build';
import { devCommand } from './dev';
import { loadCliVersion } from './util';

const cli = cac('makoo');

cli.command('build', 'Build the userscript').action(async () => {
	await buildCommand();
});

cli.command('dev', 'Start the dev server').action(async () => {
	await devCommand();
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
