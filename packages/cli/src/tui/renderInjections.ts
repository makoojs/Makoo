import { stripVTControlCharacters } from 'node:util';
import type { ComponentStatus, ListenerStatus } from '@makoojs/core';
import type {
	InjectionSnapshot,
	RuntimeSnapshot,
	SerializedDiagnostic,
	SerializedMakooError
} from '../vite/session';
import { ansi, colorize } from './terminalColor';

type InjectionStatus = ComponentStatus | ListenerStatus;

const MAX_ERROR_LENGTH = 120;
const MAX_NAME_LENGTH = 40;
const COLUMN_GAP = 2;
const ATTACHED_INDENT = '  ';
const STATUS_ORDER: readonly InjectionStatus[] = ['mounted', 'bound', 'waiting', 'failed', 'idle'];
const STATUS_COLORS: Record<InjectionStatus, string> = {
	mounted: ansi.green,
	bound: ansi.green,
	waiting: ansi.yellow,
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
	return injection.kind === 'component' ? 'component' : 'standalone listener';
}

type ColumnWidths = { status: number; name: number; attachedName: number };

function columnWidths(injections: InjectionSnapshot[]): ColumnWidths {
	let status = visibleLength('STATUS');
	let name = visibleLength('NAME');
	let attachedName = 0;
	for (const injection of injections) {
		status = Math.max(status, visibleLength(renderStatus(injection.status)));
		name = Math.max(name, visibleLength(truncateDisplayName(injection.name)));
		if (injection.kind !== 'component') continue;
		for (const listener of injection.attachedListeners) {
			status = Math.max(status, visibleLength(renderStatus(listener.status)));
			attachedName = Math.max(
				attachedName,
				visibleLength(attachedDisplayName(listener.name))
			);
		}
	}
	return { status, name, attachedName };
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

function renderAttachedRow(
	listener: { name: string; status: ListenerStatus },
	widths: ColumnWidths
): string {
	const status = padEndVisible(renderStatus(listener.status), widths.status);
	const name = padEndVisible(attachedDisplayName(listener.name), widths.attachedName);
	const kind = colorize('attached listener', ansi.dim);
	const gap = ' '.repeat(COLUMN_GAP);
	return `${ATTACHED_INDENT}${status}${gap}${name}${gap}${kind}`;
}

function renderInjectionBlock(injection: InjectionSnapshot, widths: ColumnWidths): string[] {
	const lines = [renderTopLevelRow(injection, widths)];
	if (injection.status === 'failed' && injection.lastError) {
		lines.push(colorize(`${ATTACHED_INDENT}${renderError(injection.lastError)}`, ansi.red));
	}
	if (injection.kind !== 'component') return lines;
	for (const listener of injection.attachedListeners) {
		lines.push(renderAttachedRow(listener, widths));
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
	const total = injections.length === 1 ? '1 injection' : `${injections.length} injections`;
	const counts = STATUS_ORDER.flatMap((status) => {
		const count = injections.filter((injection) => injection.status === status).length;
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
