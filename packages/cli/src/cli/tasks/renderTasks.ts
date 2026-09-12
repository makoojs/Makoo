import Table from 'cli-table3';
import type { RuntimeSnapshot, TaskSnapshot } from '../../session/types';
import { ansi, colorize } from '../terminalColor';

function renderTaskStatus(status: TaskSnapshot['status']): string {
	switch (status) {
		case 'active':
			return colorize('● active', ansi.green);
		case 'pending':
			return colorize('● pending', ansi.yellow);
		case 'idle':
			return colorize('● idle', ansi.dim);
	}
}

export function renderTasksTable(sanpshots: RuntimeSnapshot[]): string {
	const tasks = sanpshots.flatMap((runtime) => runtime.tasks);
	const lines = [colorize('Makoo Tasks', ansi.bold, ansi.deepPink), ''];

	if (sanpshots.length === 0) {
		lines.push(
			colorize('● Runtime Session disconnected.', ansi.yellow),
			'',
			colorize('Waiting for reconnection.', ansi.dim)
		);
		return lines.join('\n');
	}

	if (tasks.length === 0) {
		lines.push('No tasks registered.');
		return lines.join('\n');
	}

	const showLabel = sanpshots.length > 1;
	const showClient = new Set(sanpshots.map((runtime) => runtime.clientId)).size > 1;
	for (const [index, runtime] of sanpshots.entries()) {
		if (runtime.tasks.length === 0) continue;
		if (showLabel) {
			let label = `Makoo${runtime.runtimeId}`;
			if (showClient) {
				label = `Client ${runtime.clientId} · ${label}`;
			}
			lines.push(colorize(label, ansi.bold), '');
		}
		const table = new Table({
			head: ['STATUS', 'ID', 'KIND', 'TARGET'].map((heading) => colorize(heading, ansi.bold)),
			style: { border: [], head: [] }
		});
		for (const task of runtime.tasks) {
			table.push([
				renderTaskStatus(task.status),
				colorize(task.taskId, ansi.bold, ansi.cyan),
				colorize(task.kind, ansi.deepPink),
				colorize(`→ ${task.injectAt}`, ansi.dim)
			]);
		}
		lines.push(table.toString());
		if (index < sanpshots.length - 1) lines.push('');
	}

	const active = tasks.filter((task) => task.status === 'active').length;
	const pending = tasks.filter((task) => task.status === 'pending').length;
	const idle = tasks.filter((task) => task.status === 'idle').length;
	let total = `${tasks.length} tasks`;
	if (tasks.length === 1) total = '1 task';
	lines.push(
		'',
		`${total} · ${colorize(`${active} active`, ansi.green)} · ${colorize(`${pending} pending`, ansi.yellow)} · ${colorize(`${idle} idle`, ansi.dim)}`
	);

	return lines.join('\n');
}
