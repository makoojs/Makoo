import { stripVTControlCharacters } from 'node:util';
import type { ComponentEachStatus, ComponentStatus, ListenerStatus } from '@makoojs/core';
import type {
	InjectionSnapshot,
	SerializedDiagnostic,
	SerializedMakooError
} from '../bridge/protocol';
import type { RuntimeSnapshot } from '../bridge/store';
import { ansi, colorize } from './terminalColor';

type InjectionStatus = ComponentStatus | ComponentEachStatus | ListenerStatus;

const MAX_ERROR_LENGTH = 120;
const MAX_NAME_LENGTH = 40;
const COLUMN_GAP = 2;
const ATTACHED_INDENT = '  ';
const CHILD_INDENT = `${ATTACHED_INDENT}${ATTACHED_INDENT}`;
const STATUS_ORDER: readonly InjectionStatus[] = [
	'mounted',
	'bound',
	'waiting',
	'collecting',
	'failed',
	'idle'
];
const STATUS_COLORS: Record<InjectionStatus, string> = {
	mounted: ansi.green,
	bound: ansi.green,
	waiting: ansi.yellow,
	collecting: ansi.yellow,
	failed: ansi.red,
	idle: ansi.dim
};

function visibleLength(value: string): number {
	return stripVTControlCharacters(value).length;
}

function padEndVisible(value: string, width: number): string {
	const pad = width - visibleLength(value);
	return pad > 0 ? `${value}${' '.repeat(pad)}` : value;
}

function truncateDisplayName(name: string): string {
	if (name.length <= MAX_NAME_LENGTH) return name;
	return `${name.slice(0, MAX_NAME_LENGTH - 1)}…`;
}

function attachedDisplayName(name: string): string {
	return `└ ${truncateDisplayName(name)}`;
}

function renderStatus(status: InjectionStatus): string {
	return colorize(`● ${status}`, STATUS_COLORS[status]);
}

function renderError(error: SerializedMakooError): string {
	let text = `${error.code}: ${error.message}`;
	if (error.cause !== undefined) text += ` (cause: ${error.cause})`;
	text = text.replaceAll('\n', ' · ');
	if (text.length > MAX_ERROR_LENGTH) text = `${text.slice(0, MAX_ERROR_LENGTH - 1)}…`;
	return text;
}

function kindLabel(injection: InjectionSnapshot): string {
	if (injection.kind === 'component') return 'component';
	if (injection.kind === 'component-each') return 'component each';
	return 'standalone listener';
}

function childDisplayName(index: number): string {
	return `└ child #${index + 1}`;
}

type ColumnWidths = { status: number; name: number; indentedName: number };

function columnWidths(injections: InjectionSnapshot[]): ColumnWidths {
	let status = visibleLength('STATUS');
	let name = visibleLength('NAME');
	let indentedName = 0;
	for (const injection of injections) {
		status = Math.max(status, visibleLength(renderStatus(injection.status)));
		name = Math.max(name, visibleLength(truncateDisplayName(injection.name)));
		if (injection.kind === 'component') {
			for (const listener of injection.attachedListeners) {
				status = Math.max(status, visibleLength(renderStatus(listener.status)));
				indentedName = Math.max(
					indentedName,
					visibleLength(attachedDisplayName(listener.name))
				);
			}
		}
		if (injection.kind === 'component-each') {
			for (const [index, child] of injection.children.entries()) {
				status = Math.max(status, visibleLength(renderStatus(child.status)));
				indentedName = Math.max(indentedName, visibleLength(childDisplayName(index)));
			}
		}
	}
	return { status, name, indentedName };
}

function renderTopLevelRow(injection: InjectionSnapshot, widths: ColumnWidths): string {
	const status = padEndVisible(renderStatus(injection.status), widths.status);
	const name = padEndVisible(
		colorize(truncateDisplayName(injection.name), ansi.bold, ansi.cyan),
		widths.name
	);
	const kind = colorize(kindLabel(injection), ansi.deepPink);
	const gap = ' '.repeat(COLUMN_GAP);
	return `${status}${gap}${name}${gap}${kind}`;
}

function renderIndentedRow(
	row: { name: string; status: InjectionStatus; kind: string },
	widths: ColumnWidths
): string {
	const status = padEndVisible(renderStatus(row.status), widths.status);
	const name = padEndVisible(row.name, widths.indentedName);
	const kind = colorize(row.kind, ansi.dim);
	const gap = ' '.repeat(COLUMN_GAP);
	return `${ATTACHED_INDENT}${status}${gap}${name}${gap}${kind}`;
}

function renderInjectionBlock(injection: InjectionSnapshot, widths: ColumnWidths): string[] {
	const lines = [renderTopLevelRow(injection, widths)];
	if (injection.status === 'failed' && injection.lastError) {
		lines.push(colorize(`${ATTACHED_INDENT}${renderError(injection.lastError)}`, ansi.red));
	}
	if (injection.kind === 'component') {
		for (const listener of injection.attachedListeners) {
			lines.push(
				renderIndentedRow(
					{
						name: attachedDisplayName(listener.name),
						status: listener.status,
						kind: 'attached listener'
					},
					widths
				)
			);
		}
	}
	if (injection.kind === 'component-each') {
		for (const [index, child] of injection.children.entries()) {
			lines.push(
				renderIndentedRow(
					{ name: childDisplayName(index), status: child.status, kind: 'child' },
					widths
				)
			);
			if (child.status === 'failed' && child.lastError) {
				lines.push(colorize(`${CHILD_INDENT}${renderError(child.lastError)}`, ansi.red));
			}
		}
	}
	return lines;
}

function renderHeader(widths: ColumnWidths): string {
	const gap = ' '.repeat(COLUMN_GAP);
	return [
		padEndVisible(colorize('STATUS', ansi.bold), widths.status),
		padEndVisible(colorize('NAME', ansi.bold), widths.name),
		colorize('KIND', ansi.bold)
	].join(gap);
}

function renderDiagnostic(diagnostic: SerializedDiagnostic): string {
	const error = colorize(renderError(diagnostic.error), ansi.red);
	if (diagnostic.name === undefined) return `  ${error}`;
	return `  ${colorize(diagnostic.name, ansi.bold, ansi.cyan)}  ${error}`;
}

function renderSummary(injections: InjectionSnapshot[]): string {
	// Children count as injections in the tallies; attached listeners do not.
	const statuses = injections.flatMap((injection) => [
		injection.status,
		...(injection.kind === 'component-each'
			? injection.children.map((child) => child.status)
			: [])
	]);
	const total = statuses.length === 1 ? '1 injection' : `${statuses.length} injections`;
	const counts = STATUS_ORDER.flatMap((status) => {
		const count = statuses.filter((value) => value === status).length;
		return count === 0 ? [] : [colorize(`${count} ${status}`, STATUS_COLORS[status])];
	});
	return [total, ...counts].join(' · ');
}

export function renderInjectionsTable(snapshots: RuntimeSnapshot[]): string {
	const lines = [colorize('Makoo Injections', ansi.bold, ansi.deepPink), ''];

	if (snapshots.length === 0) {
		lines.push(
			colorize('● Runtime Session disconnected.', ansi.yellow),
			'',
			colorize('Waiting for reconnection.', ansi.dim)
		);
		return lines.join('\n');
	}

	const visible = snapshots.filter(
		(runtime) => runtime.injections.length > 0 || runtime.diagnostics.length > 0
	);
	if (visible.length === 0) {
		lines.push('No injections registered.');
		return lines.join('\n');
	}

	const showLabel = snapshots.length > 1;
	const showClient = new Set(snapshots.map((runtime) => runtime.clientId)).size > 1;
	for (const [index, runtime] of visible.entries()) {
		if (showLabel) {
			let label = `Makoo${runtime.runtimeId}`;
			if (showClient) label = `Client ${runtime.clientId} · ${label}`;
			lines.push(colorize(label, ansi.bold), '');
		}
		if (runtime.injections.length > 0) {
			const widths = columnWidths(runtime.injections);
			lines.push(renderHeader(widths));
			for (const injection of runtime.injections) {
				lines.push(...renderInjectionBlock(injection, widths));
			}
		}
		if (runtime.diagnostics.length > 0) {
			if (runtime.injections.length > 0) lines.push('');
			lines.push(
				colorize('Diagnostics', ansi.bold),
				...runtime.diagnostics.map(renderDiagnostic)
			);
		}
		if (index < visible.length - 1) lines.push('');
	}

	const injections = visible.flatMap((runtime) => runtime.injections);
	if (injections.length > 0) lines.push('', renderSummary(injections));
	return lines.join('\n');
}
