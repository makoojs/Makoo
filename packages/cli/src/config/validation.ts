import { MakooError } from '@makoojs/core';
import { z } from 'zod';
import { CliErrorCode } from './errors';

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
	if (!result.success) throw invalidConfig(result.error);
}

function invalidConfig(error: z.ZodError): MakooError {
	const lines = error.issues.map((issue) => {
		const path = issue.path.map(String).join('.');
		return `${path || '(root)'}: ${issue.message}`;
	});
	return new MakooError(lines.join('\n'), {
		code: CliErrorCode.CLI_CONFIG_INVALID,
		cause: error
	});
}
