import { defineMakooErrors, type MakooErrorsFor, type MakooErrorTable } from '@makoojs/core';

const reactErrorTable = {
	// configuration：hook 调用环境错误，抛出
	MAKOO_REACT_HOOK_OUTSIDE_COMPONENT: {
		category: 'configuration',
		message: () =>
			'Makoo hooks must be called inside a component tree mounted by the Makoo React adapter'
	},

	// control：当前状态下不允许的调用，抛出
	MAKOO_REACT_LISTENER_NOT_FOUND: {
		category: 'control',
		message: (d: { name: string; injection: string }) =>
			`Unknown listener "${d.name}" in "${d.injection}"`
	}
} satisfies MakooErrorTable;

/** The React adapter error table: each code's category and message defined exactly once. */
export const reactErrors = defineMakooErrors(reactErrorTable);

export type ReactErrorCode = Extract<keyof typeof reactErrorTable, string>;

/** A `MakooError` narrowed by React adapter code; `details` follows the code. */
export type ReactError<C extends ReactErrorCode = ReactErrorCode> = MakooErrorsFor<
	typeof reactErrorTable,
	C
>;
