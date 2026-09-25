import { z } from 'zod';
import { ErrorCode } from '../error/ErrorCode';
import { MakooError } from '../error/MakooError';
import type { MakooInjectionDeclaration, MakooInjectionInput } from './types';

const nonEmptyString = z
	.string({ error: 'Expected a non-empty string' })
	.refine((value) => value.trim().length > 0, 'Expected a non-empty string');

const timeoutMessage = 'Expected a positive finite duration up to 2147483647 milliseconds';

const injectionSchema = z.object(
	{
		kind: z.literal('injection', { error: 'Expected injection' }),
		name: nonEmptyString,
		injectAt: nonEmptyString.refine((selector) => {
			try {
				document.createDocumentFragment().querySelector(selector);
				return true;
			} catch {
				return false;
			}
		}, 'Invalid CSS selector'),
		adapter: nonEmptyString,
		component: z.custom<unknown>(() => true),
		props: z.unknown().optional(),
		timeout: z
			.number({ error: timeoutMessage })
			.gt(0, timeoutMessage)
			.max(2147483647, timeoutMessage)
			.optional()
	},
	{
		error: (issue) =>
			issue.code === 'invalid_type' ? 'Expected an injection declaration' : undefined
	}
);

export function inject<TComponent = unknown, TProps = unknown>(
	input: MakooInjectionInput<TComponent, TProps>
): MakooInjectionDeclaration<TComponent, TProps> {
	return { ...input, kind: 'injection' };
}

export function validateInjection(input: unknown): MakooInjectionDeclaration {
	const parsed = injectionSchema.safeParse(input);
	if (!parsed.success) {
		throw new MakooError(
			'Invalid injection declaration',
			parsed.error.issues.map((issue) => ({
				path: issue.path.length ? issue.path.join('.') : '(root)',
				message: issue.message
			})),
			ErrorCode.INVALID_DECLARATION
		);
	}
	return Object.freeze(parsed.data);
}
