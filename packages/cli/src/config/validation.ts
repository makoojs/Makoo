import { z } from 'zod';
import { ConfigValidationError, toMakooIssue } from '../error/error';

const AppConfigSchema = z.object({
	name: z.string().min(1, 'app.name is required'),
	version: z.string().min(1, 'app.version is required'),
	description: z.string().optional()
});

const MonkeyConfigSchema = z
	.object({
		server: z.object({}).passthrough().optional()
	})
	.passthrough()
	.superRefine((value, context) => {
		if ('clientAlias' in value) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['clientAlias'],
				message: 'monkey.clientAlias is not supported by makoo'
			});
		}

		if (value.server && typeof value.server === 'object' && 'mountGmApi' in value.server) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['server', 'mountGmApi'],
				message: 'monkey.server.mountGmApi is not supported by makoo'
			});
		}
	});

export const CliConfigSchema = z
	.object({
		app: AppConfigSchema,
		monkey: MonkeyConfigSchema.optional(),
		source: z.object({}).passthrough().optional(),
		runtime: z.object({}).passthrough().optional()
	})
	.loose()
	.superRefine((value, context) => {
		if ('injector' in value) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['injector'],
				message:
					'injector is not supported in vite config; use manifest injectionDefaults instead'
			});
		}
	});

export function validateCliConfig(data: unknown): asserts data is z.infer<typeof CliConfigSchema> {
	const result = CliConfigSchema.safeParse(data);
	if (!result.success) {
		throw new ConfigValidationError(result.error.issues.map(toMakooIssue));
	}
}
