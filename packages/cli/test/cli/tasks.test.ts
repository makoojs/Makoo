import { describe, expect, it } from 'vitest';
import { renderTasksTable } from '../../src/cli/tasks/renderTasks';
import { ansi } from '../../src/cli/terminalColor';

function removeColor(value: string): string {
	for (const code of Object.values(ansi)) value = value.replaceAll(code, '');
	return value;
}

describe('renderTasksTable', () => {
	it('waits for the Runtime Session to reconnect', () => {
		expect(removeColor(renderTasksTable([]))).toBe(
			'Makoo Tasks\n\n● Runtime Session disconnected.\n\nWaiting for reconnection.'
		);
	});

	it('prints a useful empty state', () => {
		expect(removeColor(renderTasksTable([{ clientId: 1, runtimeId: 1, tasks: [] }]))).toBe(
			'Makoo Tasks\n\nNo tasks registered.'
		);
	});

	it('renders registered tasks', () => {
		const plain = removeColor(
			renderTasksTable([
				{
					clientId: 1,
					runtimeId: 1,
					tasks: [
						{
							taskId: 'danmaku-panel',
							kind: 'component',
							status: 'active',
							injectAt: '#app'
						}
					]
				}
			])
		);

		expect(plain).toMatch(/│ STATUS\s+│ ID/);
		expect(plain).toMatch(/│ ● active\s+│ danmaku-panel/);
		expect(plain).toContain('→ #app');
	});
});
