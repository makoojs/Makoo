import { z } from 'zod';
import { ConfigValidationError, toMakooIssue } from '../error/error';

const AppConfigSchema = z.object({
	name: z.string().min(1, 'app.name is required'),
	version: z.string().min(1, 'app.version is required'),
	description: z.string().optional()
});

export const CliConfigSchema = z.object({
	app: AppConfigSchema,
	monkey: z.object({}).passthrough().optional(),
	source: z.object({}).passthrough().optional(),
	injector: z.object({}).passthrough().optional()
});

export function validateCliConfig(data: unknown): asserts data is z.infer<typeof CliConfigSchema> {
	const result = CliConfigSchema.safeParse(data);
	if (!result.success) {
		throw new ConfigValidationError(result.error.issues.map(toMakooIssue));
	}
}
