import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readUserscript } from '@makoojs/test';
import { expect, it } from 'vitest';
import '@makoojs/test/vitest';
import { buildConsumerFixture } from '../consumer/buildFixture';

it('builds a userscript from an installed core tarball with no source aliases', async () => {
	const temporary = await mkdtemp(resolve(tmpdir(), 'makoo-tarball-'));
	try {
		const path = await buildConsumerFixture(
			'http://127.0.0.1:4173',
			resolve(temporary, 'dist')
		);
		const artifact = await readUserscript(path);
		expect(artifact).toHaveMetadata('name', 'makoo-tarball-consumer');
		expect(artifact).toHaveMetadataValues('match', ['http://127.0.0.1:4173/*']);
		expect(artifact).toHaveGrant('none');
		expect(artifact).toHaveClassicScriptSyntax();
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}, 90_000);
