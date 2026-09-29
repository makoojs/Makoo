import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readUserscript } from '@makoojs/test';
import '@makoojs/test/vitest';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { buildBehaviorFixture } from '../e2e/buildBehaviorFixture';

const baseURL = 'http://127.0.0.1:4173';

it.each([
	'alive',
	'matching',
	'storage'
] as const)('builds the %s manager fixture', async (behavior) => {
	const output = await mkdtemp(resolve(tmpdir(), 'makoo-behavior-'));
	try {
		const artifact = await readUserscript(
			await buildBehaviorFixture(behavior, baseURL, output)
		);
		expect(artifact).toHaveMetadata('name', `makoo-core-${behavior}`);
		expect(artifact).toHaveMetadata('run-at', 'document-end');
		expect(artifact).toHaveMetadataValues('match', [
			`${baseURL}/${behavior === 'matching' ? 'eligible/' : ''}*`
		]);
		expect(artifact).toHaveClassicScriptSyntax();
		if (behavior === 'storage') {
			expect(artifact).toHaveGrant('GM.getValue');
			expect(artifact).toHaveGrant('GM.setValue');
			expect(artifact).not.toHaveGrant('none');
		} else {
			expect(artifact).toHaveGrant('none');
		}
		if (behavior === 'matching') {
			expect(artifact).toHaveMetadataValues('exclude', [`${baseURL}/eligible/excluded`]);
			const faulty = await readUserscript(
				await buildBehaviorFixture(behavior, baseURL, output, 'remove-exclude')
			);
			expect(() =>
				expect(faulty).toHaveMetadata('exclude', `${baseURL}/eligible/excluded`)
			).toThrow('@exclude');
		}
	} finally {
		await rm(output, { recursive: true, force: true });
	}
});

it('executes the compiled alive artifact in jsdom and detects disabled remounting', async () => {
	const output = await mkdtemp(resolve(tmpdir(), 'makoo-alive-artifact-'));
	const html = await readFile(resolve(import.meta.dirname, '../e2e/behavior/alive.html'), 'utf8');
	try {
		for (const fault of [undefined, 'disable-alive'] as const) {
			const artifact = await readUserscript(
				await buildBehaviorFixture('alive', baseURL, output, fault)
			);
			const dom = new JSDOM(html, { url: baseURL, runScripts: 'dangerously' });
			try {
				dom.window.eval(artifact.source);
				const text = (selector: string) =>
					dom.window.document.querySelector(selector)?.textContent;
				const click = (selector: string) => {
					const target = dom.window.document.querySelector<HTMLElement>(selector);
					if (!target) throw new Error(`Missing fixture element: ${selector}`);
					target.click();
				};
				await vi.waitFor(() => expect(text('#mounts')).toBe('1'));
				click('#alive-button');
				expect(text('#count')).toBe('1');
				click('#replace');
				const restored = () => expect(text('#mounts')).toBe('2');
				if (fault) {
					await expect(vi.waitFor(restored, { timeout: 250 })).rejects.toThrow();
					continue;
				}
				await vi.waitFor(restored);
				expect(text('#unmounts')).toBe('1');
				click('#probe');
				expect(text('#probes')).toBe('1');
				expect(text('#count')).toBe('1');
				click('#alive-button');
				expect(text('#count')).toBe('2');
				click('#replace');
				await vi.waitFor(() => expect(text('#mounts')).toBe('3'));
				expect(dom.window.document.querySelectorAll('#alive-button')).toHaveLength(1);
				expect(text('#unmounts')).toBe('2');
				click('#probe');
				expect(text('#probes')).toBe('2');
				expect(text('#count')).toBe('2');
				click('#alive-button');
				expect(text('#count')).toBe('3');
			} finally {
				dom.window.close();
			}
		}
	} finally {
		await rm(output, { recursive: true, force: true });
	}
});
