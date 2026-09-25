import { z } from 'zod';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MakooListenerDeclaration, MakooListenerInput } from './types';

const nonEmptyString = z
	.string({ error: 'Expected a non-empty string' })
	.refine((value) => value.trim().length > 0, 'Expected a non-empty string');

const timeoutMessage = 'Expected a positive finite duration up to 2147483647 milliseconds';

const listenerSchema = z.object(
	{
		kind: z.literal('listener', { error: 'Expected listener' }),
		name: nonEmptyString,
		listenAt: nonEmptyString.refine((selector) => {
			try {
				// Validate syntax without resolving a live host before the batch is accepted.
				document.createDocumentFragment().querySelector(selector);
				return true;
			} catch {
				return false;
			}
		}, 'Invalid CSS selector'),
		type: nonEmptyString,
		callback: z.custom<(this: Element, event: Event) => unknown>(
			(value) => typeof value === 'function',
			'Expected an event handler'
		),
		capture: z.boolean({ error: 'Expected a boolean' }).optional(),
		timeout: z
			.number({ error: timeoutMessage })
			.gt(0, timeoutMessage)
			.max(2147483647, timeoutMessage)
			.optional(),
		reinject: z.boolean({ error: 'Expected a boolean' }).optional()
	},
	{
		error: (issue) =>
			issue.code === 'invalid_type' ? 'Expected a listener declaration' : undefined
	}
);

export function listen(input: MakooListenerInput): MakooListenerDeclaration {
	return { ...input, kind: 'listener' };
}

export function validateListener(input: unknown): MakooListenerDeclaration {
	const parsed = listenerSchema.safeParse(input);
	if (!parsed.success) {
		throw new MakooError(
			'Invalid listener declaration',
			parsed.error.issues.map((issue) => ({
				path: issue.path.length ? issue.path.join('.') : '(root)',
				message: issue.message
			})),
			ErrorCode.INVALID_DECLARATION
		);
	}
	return Object.freeze(parsed.data);
}
