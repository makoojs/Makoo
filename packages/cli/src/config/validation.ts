import { z } from 'zod';
import { ConfigValidationError, toMakooIssue } from '../error/MakooCliError';

const AppConfigSchema = z.strictObject({
	name: z.string().min(1, 'app.name is required'),
	version: z.string().min(1, 'app.version is required'),
	description: z.string().optional()
});

const MonkeyConfigSchema = z.object({}).loose();

export const CliConfigSchema = z.strictObject({
	entry: z.string().min(1, 'entry is required'),
	app: AppConfigSchema,
	monkey: MonkeyConfigSchema.optional()
});

export function validateCliConfig(data: unknown): asserts data is z.infer<typeof CliConfigSchema> {
	const result = CliConfigSchema.safeParse(data);
	if (!result.success) {
		throw new ConfigValidationError(result.error.issues.map(toMakooIssue));
	}
}
