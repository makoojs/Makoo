import { z } from 'zod';
import { MakooErrorCode } from '../error/ErrorCode';
import { declaredName, MakooError, validationError } from '../error/MakooError';
import { validateListener } from '../listener/declaration';
import type { MakooComponentDeclaration, MakooComponentInput } from './types';

const nonEmptyString = z
	.string({ error: 'Expected a non-empty string' })
	.refine((value) => value.trim().length > 0, 'Expected a non-empty string');

const timeoutMessage = 'Expected a positive finite duration up to 2147483647 milliseconds';

const componentSchema = z.object(
	{
		kind: z.literal('component', { error: 'Expected component' }),
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
		component: z.unknown(),
		props: z.unknown().optional(),
		timeout: z
			.number({ error: timeoutMessage })
			.gt(0, timeoutMessage)
			.max(2147483647, timeoutMessage)
			.optional(),
		reinject: z.boolean({ error: 'Expected a boolean' }).optional(),
		listeners: z.array(z.unknown()).optional()
	},
	{
		error: (issue) =>
			issue.code === 'invalid_type' ? 'Expected a component declaration' : undefined
	}
);

export function inject<TComponent = unknown, TProps = unknown>(
	input: MakooComponentInput<TComponent, TProps>
): MakooComponentDeclaration<TComponent, TProps> {
	return { ...input, kind: 'component' };
}

export function validateComponent(input: unknown): MakooComponentDeclaration {
	const injectInput = componentSchema.safeParse(input);
	if (!injectInput.success) {
		const name = declaredName(input);
		throw validationError(
			name ? `Invalid component declaration "${name}"` : 'Invalid component declaration',
			MakooErrorCode.DECLARATION_INVALID,
			injectInput.error
		);
	}
	const names = new Set<string>();
	const listeners = injectInput.data.listeners?.map((input, index) => {
		let listener: ReturnType<typeof validateListener>;
		try {
			listener = validateListener(input);
		} catch (error) {
			if (!(error instanceof MakooError)) throw error;
			throw new MakooError(`Invalid attached listener at listeners[${index}]`, {
				code: MakooErrorCode.DECLARATION_INVALID,
				cause: error
			});
		}
		if (names.has(listener.name)) {
			throw new MakooError(
				`Duplicate attached listener "${listener.name}" at listeners[${index}]`,
				{
					code: MakooErrorCode.INJECTION_NAME_CONFLICT
				}
			);
		}
		if (listener.reinject !== undefined) {
			throw new MakooError(
				`Attached listeners inherit the component recovery setting (listeners[${index}].reinject)`,
				{ code: MakooErrorCode.DECLARATION_INVALID }
			);
		}
		names.add(listener.name);
		return listener;
	});
	return Object.freeze({ ...injectInput.data, listeners: listeners && Object.freeze(listeners) });
}
