import { describe, expect, it } from 'vitest';
import { renderInjectionsTable } from '../../src/tui/renderInjections';
import { ansi } from '../../src/tui/terminalColor';
import type { RuntimeSnapshot } from '../../src/vite/session';

function removeColor(value: string): string {
	for (const code of Object.values(ansi)) value = value.replaceAll(code, '');
	return value;
}

function runtime(snapshot: Partial<RuntimeSnapshot>): RuntimeSnapshot {
	return { clientId: 1, runtimeId: 1, injections: [], diagnostics: [], ...snapshot };
}

describe('renderInjectionsTable', () => {
	it('renders top-level Injections with attached listeners indented beneath their component', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					injections: [
						{
							name: 'panel',
							kind: 'component',
							status: 'mounted',
							attachedListeners: [{ name: 'hover', status: 'waiting' }]
						},
						{ name: 'play-click', kind: 'standalone-listener', status: 'bound' }
					]
				})
			])
		);

		expect(plain).toContain('STATUS');
		expect(plain).toContain('NAME');
		expect(plain).toContain('KIND');
		expect(plain).not.toMatch(/[┌┐│├┤┬┴┼]/);
		const rows = plain.split('\n').filter((line) => line.includes('●'));
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatch(/^● mounted\s+panel\s+component$/);
		expect(rows[1]).toMatch(/^ {2}● waiting\s+└ hover\s+attached listener$/);
		expect(rows[2]).toMatch(/^● bound\s+play-click\s+standalone listener$/);
		expect(plain).toContain('2 injections · 1 mounted · 1 bound');
	});

	it('truncates long injection and attached listener names for display only', () => {
		const longName = `very-long-injection-name-${'x'.repeat(80)}`;
		const longAttached = `very-long-attached-listener-${'y'.repeat(80)}`;
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					injections: [
						{
							name: longName,
							kind: 'component',
							status: 'mounted',
							attachedListeners: [{ name: longAttached, status: 'bound' }]
						},
						{ name: 'short', kind: 'standalone-listener', status: 'idle' }
					]
				})
			])
		);

		expect(plain).not.toContain(longName);
		expect(plain).not.toContain(longAttached);
		expect(plain).toContain(`${longName.slice(0, 39)}…`);
		expect(plain).toContain(`└ ${longAttached.slice(0, 39)}…`);
		const nameCells = plain
			.split('\n')
			.filter((line) => line.includes('●'))
			.map((line) =>
				line
					.replace(/^ {0,2}● \w+\s+/, '')
					.replace(/\s+(component|standalone listener|attached listener)$/, '')
			);
		expect(nameCells[0]).toHaveLength(40);
		expect(nameCells[1].replace(/^└ /, '')).toHaveLength(40);
		expect(plain).toContain('2 injections · 1 mounted · 1 idle');
	});

	it('aligns sibling attached listeners so └ starts at the same column', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					injections: [
						{
							name: 'panel',
							kind: 'component',
							status: 'mounted',
							attachedListeners: [
								{ name: 'save', status: 'bound' },
								{ name: 'hover', status: 'waiting' }
							]
						}
					]
				})
			])
		);

		const attached = plain.split('\n').filter((line) => line.includes('└'));
		expect(attached).toHaveLength(2);
		const nameColumn = attached.map((line) => line.indexOf('└'));
		expect(nameColumn[0]).toBeGreaterThan(2);
		expect(nameColumn[0]).toBe(nameColumn[1]);
		expect(attached[0]).toMatch(/^ {2}● bound\s+└ save\s+attached listener$/);
		expect(attached[1]).toMatch(/^ {2}● waiting\s+└ hover\s+attached listener$/);
	});

	it('shows lastError code, message and cause under a failed row, truncated to one line', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					injections: [
						{
							name: 'broken',
							kind: 'component',
							status: 'failed',
							lastError: {
								code: 'MAKOO_MOUNT_FAILED',
								message: 'Failed to mount "broken"',
								cause: 'adapter exploded'
							},
							attachedListeners: []
						},
						{
							name: 'cleanup',
							kind: 'standalone-listener',
							status: 'failed',
							lastError: {
								code: 'MAKOO_INJECTION_CLEANUP_FAILED',
								message: `Cleanup failed for "cleanup"\n${'x'.repeat(200)}`
							}
						}
					]
				})
			])
		);

		expect(plain).toContain(
			'MAKOO_MOUNT_FAILED: Failed to mount "broken" (cause: adapter exploded)'
		);
		const cleanupError = plain
			.split('\n')
			.find((line) => line.includes('MAKOO_INJECTION_CLEANUP_FAILED'));
		expect(cleanupError?.trim()).toMatch(
			/^MAKOO_INJECTION_CLEANUP_FAILED: Cleanup failed for "cleanup" · x+…$/
		);
		expect(cleanupError?.trim()).toHaveLength(120);
		expect(plain).toContain('2 injections · 2 failed');
	});

	it('lists diagnostics in their own section without changing Injection statuses', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					injections: [
						{ name: 'play-click', kind: 'standalone-listener', status: 'bound' }
					],
					diagnostics: [
						{
							type: 'diagnostic',
							name: 'play-click',
							error: {
								code: 'MAKOO_STATE_SUBSCRIBER_FAILED',
								message: 'State subscriber of "play-click" failed',
								cause: 'subscriber exploded'
							}
						},
						{
							type: 'diagnostic',
							error: {
								code: 'MAKOO_INSTANCE_OBSERVER_FAILED',
								message: 'Instance observe handler failed'
							}
						}
					]
				})
			])
		);

		expect(plain).toMatch(/^● bound\s+play-click\s+standalone listener$/m);
		expect(plain).toContain(
			'Diagnostics\n  play-click  MAKOO_STATE_SUBSCRIBER_FAILED: State subscriber of "play-click" failed (cause: subscriber exploded)\n  MAKOO_INSTANCE_OBSERVER_FAILED: Instance observe handler failed'
		);
		expect(plain).toContain('1 injection · 1 bound');
	});

	it('labels each runtime when several are connected', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					runtimeId: 1,
					injections: [{ name: 'first', kind: 'standalone-listener', status: 'idle' }]
				}),
				runtime({
					clientId: 2,
					runtimeId: 3,
					injections: [{ name: 'second', kind: 'standalone-listener', status: 'waiting' }]
				})
			])
		);

		expect(plain).toContain('Client 1 · Makoo1');
		expect(plain).toContain('Client 2 · Makoo3');
		expect(plain).toContain('2 injections · 1 waiting · 1 idle');
	});

	it('labels runtimes of one client without a client prefix and shows diagnostics-only runtimes', () => {
		const plain = removeColor(
			renderInjectionsTable([
				runtime({
					runtimeId: 1,
					diagnostics: [
						{
							type: 'diagnostic',
							error: { code: 'MAKOO_X_FAILED', message: 'x failed' }
						}
					]
				}),
				runtime({
					runtimeId: 2,
					injections: [{ name: 'second', kind: 'standalone-listener', status: 'bound' }]
				})
			])
		);

		expect(plain).toMatch(
			/^Makoo Injections\n\nMakoo1\n\nDiagnostics\n {2}MAKOO_X_FAILED: x failed\n\nMakoo2\n\nSTATUS/
		);
		expect(plain).not.toContain('Client');
		expect(plain).toMatch(/\n\n1 injection · 1 bound$/);
	});

	it('waits for the Runtime Session to reconnect', () => {
		expect(removeColor(renderInjectionsTable([]))).toBe(
			'Makoo Injections\n\n● Runtime Session disconnected.\n\nWaiting for reconnection.'
		);
	});

	it('prints a useful empty state', () => {
		expect(removeColor(renderInjectionsTable([runtime({})]))).toBe(
			'Makoo Injections\n\nNo injections registered.'
		);
	});
});
