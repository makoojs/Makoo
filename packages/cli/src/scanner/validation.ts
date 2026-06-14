import { OBSERVE_EVENT_NAMES } from '@makoojs/core';
import { z } from 'zod';
import { ManifestValidationError } from '../error/error';

// --- Hook validation ---

export const ObserveEventNameSchema = z.enum(OBSERVE_EVENT_NAMES);

const HookSchema = z.union([z.function(), z.array(z.function())]);

export const LifecycleHookMapSchema = z
	.record(z.string(), HookSchema)
	.refine((obj) => Object.keys(obj).every((k) => ObserveEventNameSchema.safeParse(k).success), {
		message: 'Invalid hook event name'
	});

// --- Injector config ---

export const InjectorConfigSchema = z.object({
	alive: z.boolean().optional(),
	scope: z.enum(['local', 'global']).optional(),
	timeout: z.number().optional(),
	hooks: LifecycleHookMapSchema.optional()
});

// --- Injection module config ---

export const InjectionMatchSchema = z.union([
	z.array(z.string()),
	z.object({
		include: z.array(z.string()).optional(),
		exclude: z.array(z.string()).optional()
	})
]);

export const InjectionModuleSchema = z.object({
	name: z.string().optional(),
	injectAt: z.string(),
	component: z.string(),
	framework: z.enum(['auto', 'Vue', 'React']).optional(),
	enabled: z.boolean().optional(),
	match: InjectionMatchSchema.optional(),
	alive: z.boolean().optional(),
	scope: z.enum(['local', 'global']).optional(),
	timeout: z.number().optional()
});

// --- Top-level manifest ---

export const InjectionManifestSchema = z
	.object({
		injectionDefaults: InjectorConfigSchema.optional(),
		injections: z.union([
			z.array(InjectionModuleSchema),
			z.record(z.string(), InjectionModuleSchema.omit({ name: true }))
		])
	})
	.strict();

// --- Validate helpers ---

export function validateManifest(
	data: unknown,
	file: string
): z.infer<typeof InjectionManifestSchema> {
	const result = InjectionManifestSchema.safeParse(data);
	if (!result.success) {
		throw new ManifestValidationError(file, result.error.issues);
	}
	return result.data;
}

export function validateModuleMeta(
	data: unknown,
	file: string
): z.infer<typeof InjectionModuleSchema> {
	const result = InjectionModuleSchema.safeParse(data);
	if (!result.success) {
		throw new ManifestValidationError(file, result.error.issues);
	}
	return result.data;
}
