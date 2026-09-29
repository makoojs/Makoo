import 'vitest';
import { Script } from 'node:vm';
import { expect } from 'vitest';
import type { UserscriptArtifact } from './readUserscript.js';

interface UserscriptMatchers<R = unknown> {
	toHaveClassicScriptSyntax(): R;
	toHaveMetadata(key: string, value?: string): R;
	toHaveMetadataValues(key: string, values: readonly string[]): R;
	toHaveGrant(grant: string): R;
	toHaveResource(name: string, url: string): R;
	toHaveSameMetadataAs(other: UserscriptArtifact): R;
}

declare module 'vitest' {
	// biome-ignore lint/suspicious/noExplicitAny: Match the upstream Vitest generic declaration.
	interface Assertion<T = any> extends UserscriptMatchers<void> {}
	interface AsymmetricMatchersContaining extends UserscriptMatchers {}
}

function artifact(value: unknown): UserscriptArtifact {
	if (
		!value ||
		typeof value !== 'object' ||
		!('source' in value) ||
		!('path' in value) ||
		!('metadata' in value) ||
		typeof value.source !== 'string' ||
		typeof value.path !== 'string' ||
		!value.metadata ||
		typeof value.metadata !== 'object' ||
		!('fields' in value.metadata) ||
		!('entries' in value.metadata)
	) {
		throw new TypeError('Userscript matchers expect an artifact returned by readUserscript()');
	}
	return value as UserscriptArtifact;
}

function location(value: UserscriptArtifact, key?: string) {
	const lines = key
		? value.metadata.entries.filter((entry) => entry.key === key).map((entry) => entry.line)
		: [];
	return `${value.path}${lines.length ? ` (lines ${lines.join(', ')})` : ` (metadata offset ${value.metadata.start})`}`;
}

export const userscriptMatchers = {
	toHaveClassicScriptSyntax(this: { isNot?: boolean }, received: unknown) {
		const file = artifact(received);
		let failure: string | undefined;
		try {
			// Compilation only: a syntax check must never execute the userscript.
			new Script(file.source, { filename: file.path });
		} catch (error) {
			if (!(error instanceof SyntaxError)) throw error;
			failure = error.message;
		}
		return {
			pass: failure === undefined,
			message: () =>
				`${file.path}: expected${this.isNot ? ' not' : ''} valid classic script syntax; ${failure ?? 'syntax is valid'}`
		};
	},
	toHaveMetadata(this: { isNot?: boolean }, received: unknown, key: string, value?: string) {
		const file = artifact(received);
		const actual = file.metadata.fields[key];
		return {
			pass: value === undefined ? actual !== undefined : actual?.includes(value) === true,
			actual,
			expected: value,
			message: () =>
				`${location(file, key)}: expected${this.isNot ? ' not' : ''} @${key} ${value === undefined ? 'to exist' : `to contain ${JSON.stringify(value)}`}; actual: ${JSON.stringify(actual)}`
		};
	},
	toHaveMetadataValues(
		this: { isNot?: boolean },
		received: unknown,
		key: string,
		values: readonly string[]
	) {
		const file = artifact(received);
		const actual = file.metadata.fields[key];
		return {
			pass:
				actual !== undefined &&
				actual.length === values.length &&
				actual.every((value, i) => value === values[i]),
			actual,
			expected: values,
			message: () =>
				`${location(file, key)}: expected${this.isNot ? ' not' : ''} @${key} values to equal ${JSON.stringify(values)} in order; actual: ${JSON.stringify(actual)}`
		};
	},
	toHaveGrant(this: { isNot?: boolean }, received: unknown, grant: string) {
		return userscriptMatchers.toHaveMetadata.call(this, received, 'grant', grant);
	},
	toHaveResource(this: { isNot?: boolean }, received: unknown, name: string, url: string) {
		const file = artifact(received);
		const actual = file.metadata.fields.resource;
		return {
			pass:
				actual?.some((value) => {
					const parts = value.split(/\s+/);
					return parts.length === 2 && parts[0] === name && parts[1] === url;
				}) === true,
			actual,
			expected: `${name} ${url}`,
			message: () =>
				`${location(file, 'resource')}: expected${this.isNot ? ' not' : ''} @resource ${name} ${url}; actual: ${JSON.stringify(actual)}`
		};
	},
	toHaveSameMetadataAs(this: { isNot?: boolean }, received: unknown, other: UserscriptArtifact) {
		const file = artifact(received);
		const expected = artifact(other);
		const keys = new Set([
			...Object.keys(file.metadata.fields),
			...Object.keys(expected.metadata.fields)
		]);
		const different = [...keys].filter(
			(key) =>
				JSON.stringify(file.metadata.fields[key]) !==
				JSON.stringify(expected.metadata.fields[key])
		);
		return {
			pass: different.length === 0,
			actual: file.metadata.fields,
			expected: expected.metadata.fields,
			message: () =>
				`${location(file)}: expected${this.isNot ? ' not' : ''} same metadata as ${expected.path}; differing fields: ${different.map((key) => `@${key}`).join(', ') || 'none'}`
		};
	}
};

expect.extend(userscriptMatchers);
