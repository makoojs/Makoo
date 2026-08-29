import { z } from 'zod';
import { ConfigValidationError, toMakooIssue } from './errors';

const AppConfigSchema = z.strictObject({
	name: z.string().min(1, 'app.name is required'),
	version: z.string().min(1, 'app.version is required'),
	description: z.string().optional()
});

const MonkeyConfigSchema = z.object({}).loose();

export const CliConfigSchema = z.strictObject({
	entry: z.string().min(1, 'entry is required'),
	app: AppConfigSchema,
	monkey: MonkeyConfigSchema
});

export function validateCliConfig(data: unknown): asserts data is z.infer<typeof CliConfigSchema> {
	const result = CliConfigSchema.safeParse(data);
	if (!result.success) {
		throw new ConfigValidationError(result.error.issues.map(toMakooIssue));
	}
}
