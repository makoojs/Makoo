import { readUserscript } from '@makoojs/test';
import '@makoojs/test/vitest';
import { expect, test } from 'vitest';

test('checks a userscript without a Makoo build', async () => {
	const artifact = await readUserscript('./demo.user.js');
	expect(artifact).toHaveMetadata('name', 'standalone-counter');
	expect(artifact).toHaveMetadataValues('match', ['http://127.0.0.1/*']);
	expect(artifact).toHaveGrant('none');
	expect(artifact).not.toHaveGrant('GM_getValue');
	expect(artifact).toHaveClassicScriptSyntax();
	expect(() => expect(artifact).toHaveGrant('GM_getValue')).toThrow(/@grant/);
});
