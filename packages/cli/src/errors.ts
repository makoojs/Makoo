import { defineMakooErrors, type MakooErrorsFor, type MakooErrorTable } from '@makoojs/core';

const cliErrorTable = {
	// configuration：dev 选项校验失败，抛出
	MAKOO_DEV_HOST_INVALID: {
		category: 'configuration',
		message: (d: { host: unknown }) =>
			`makooDev: invalid host ${JSON.stringify(d.host)}; expected an IPv4/IPv6 literal or 'localhost'.`
	},
	MAKOO_DEV_PORT_INVALID: {
		category: 'configuration',
		message: (d: { port: unknown }) =>
			`makooDev: invalid port ${String(d.port)}; expected an integer between 1 and 65535.`
	}
} satisfies MakooErrorTable;

/** The CLI error table: each code's category and message defined exactly once. */
export const cliErrors = defineMakooErrors(cliErrorTable);

export type CliErrorCode = Extract<keyof typeof cliErrorTable, string>;

/** A `MakooError` narrowed by CLI code; `details` follows the code. */
export type CliError<C extends CliErrorCode = CliErrorCode> = MakooErrorsFor<
	typeof cliErrorTable,
	C
>;
