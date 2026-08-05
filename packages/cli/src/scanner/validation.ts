import { type ActivitySignalSource, OBSERVE_EVENT_NAMES, type ObserveHook } from '@makoojs/core';
import { z } from 'zod';
import { ManifestValidationError, UnsupportedSelectorTargetError } from '../error/MakooCliError';

// --- Hook validation ---

export const ObserveEventNameSchema = z.enum(OBSERVE_EVENT_NAMES);

const ObserveHookSchema = z.custom<ObserveHook>((value) => typeof value === 'function');
const HookSchema = z.union([ObserveHookSchema, z.array(ObserveHookSchema)]);

export const LifecycleHookMapSchema = z
	.record(z.string(), HookSchema)
	.refine((obj) => Object.keys(obj).every((k) => ObserveEventNameSchema.safeParse(k).success), {
		message: 'Invalid hook event name'
	});

// --- Injection defaults config ---

export const InjectionDefaultsSchema = z.object({
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

const EventListenerSchema = z.custom<EventListener>((value) => typeof value === 'function');
const ActivitySignalSchema = z.custom<() => ActivitySignalSource<boolean>>(
	(value) => typeof value === 'function'
);

export const InjectionModuleListenerSchema = z.object({
	listenAt: z.string(),
	type: z.string(),
	callback: EventListenerSchema,
	capture: z.boolean().optional(),
	activitySignal: ActivitySignalSchema.optional()
});

export const InjectionModuleSchema = z.object({
	name: z.string().optional(),
	injectAt: z.string(),
	component: z.string(),
	framework: z.enum(['auto', 'Vue', 'React']).optional(),
	enabled: z.boolean().optional(),
	match: InjectionMatchSchema.optional(),
	alive: z.boolean().optional(),
	scope: z.enum(['local', 'global']).optional(),
	timeout: z.number().optional(),
	hooks: LifecycleHookMapSchema.optional(),
	on: InjectionModuleListenerSchema.optional()
});

export const InjectionListenerSchema = InjectionModuleListenerSchema.extend({
	name: z.string().optional(),
	enabled: z.boolean().optional(),
	match: InjectionMatchSchema.optional()
});

// --- Top-level manifest ---

export const InjectionManifestSchema = z
	.object({
		injectionDefaults: InjectionDefaultsSchema.optional(),
		injections: z
			.union([
				z.array(InjectionModuleSchema),
				z.record(z.string(), InjectionModuleSchema.omit({ name: true }))
			])
			.optional(),
		listeners: z
			.union([
				z.array(InjectionListenerSchema),
				z.record(z.string(), InjectionListenerSchema.omit({ name: true }))
			])
			.optional()
	})
	.strict()
	.refine((manifest) => manifest.injections || manifest.listeners, {
		message: 'Manifest must define injections or listeners'
	});

// --- Validate helpers ---

export function validateManifest(
	data: unknown,
	file: string
): z.infer<typeof InjectionManifestSchema> {
	const result = InjectionManifestSchema.safeParse(data);
	if (!result.success) {
		throw new ManifestValidationError(file, result.error.issues);
	}
	assertManifestSelectorTargets(result.data, file);
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
	assertSelectorTarget(result.data.injectAt, file, 'injectAt');
	assertSelectorTarget(result.data.on?.listenAt, file, 'on.listenAt');
	return result.data;
}

function assertManifestSelectorTargets(
	manifest: z.infer<typeof InjectionManifestSchema>,
	file: string
): void {
	if (Array.isArray(manifest.injections)) {
		manifest.injections.forEach((injection, index) => {
			assertSelectorTarget(injection.injectAt, file, `injections[${index}].injectAt`);
			assertSelectorTarget(injection.on?.listenAt, file, `injections[${index}].on.listenAt`);
		});
	} else if (manifest.injections) {
		Object.entries(manifest.injections).forEach(([id, injection]) => {
			assertSelectorTarget(injection.injectAt, file, `injections.${id}.injectAt`);
			assertSelectorTarget(injection.on?.listenAt, file, `injections.${id}.on.listenAt`);
		});
	}

	if (Array.isArray(manifest.listeners)) {
		manifest.listeners.forEach((listener, index) => {
			assertSelectorTarget(listener.listenAt, file, `listeners[${index}].listenAt`);
		});
	} else if (manifest.listeners) {
		Object.entries(manifest.listeners).forEach(([id, listener]) => {
			assertSelectorTarget(listener.listenAt, file, `listeners.${id}.listenAt`);
		});
	}
}

function assertSelectorTarget(target: string | undefined, file: string, path: string): void {
	if (target === 'document' || target === 'window') {
		throw new UnsupportedSelectorTargetError(file, path, target);
	}
}
