#!/usr/bin/env node
import { MakooError } from '@makoo/core';
import cac from 'cac';
import { addCommand } from './add';
import { buildCommand } from './build';
import { devCommand } from './dev';
import { inspectCommand } from './inspect';

const cli = cac('makoo');

cli.command('build', 'Build the userscript').action(async () => {
	await buildCommand();
});

cli.command('dev', 'Start the dev server').action(async () => {
	await devCommand();
});

cli.command('add <name>', 'Add a new injection module')
	.option('--framework <framework>', 'Framework to use', { default: 'React' })
	.action(async (name, options) => {
		await addCommand(name, options.framework);
	});

cli.command('inspect', 'Inspect resolved makoo config').action(async () => {
	await inspectCommand();
});

cli.help();
cli.version('1.3.1');

process.on('unhandledRejection', (err) => {
	if (err instanceof MakooError) {
		console.error(err);
	} else {
		console.error('[makoo]', err);
	}
	process.exit(1);
});

cli.parse();
