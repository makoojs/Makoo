import { defineMakooErrors, type MakooErrorsFor, type MakooErrorTable } from '@makoojs/core';

const vueErrorTable = {
	// configuration：hook 调用环境错误，抛出
	MAKOO_VUE_HOOK_OUTSIDE_COMPONENT: {
		category: 'configuration',
		message: () =>
			'useMakooComponent() must be called inside a component mounted by the Makoo Vue adapter'
	},
	MAKOO_VUE_HOOK_OUTSIDE_SCOPE: {
		category: 'configuration',
		message: () => 'useMakooComponent() must be called inside a component setup or effect scope'
	},

	// control：当前状态下不允许的调用，抛出
	MAKOO_VUE_LISTENER_NOT_FOUND: {
		category: 'control',
		message: (d: { name: string; injection: string }) =>
			`Unknown listener "${d.name}" in "${d.injection}"`
	},

	// cleanup：挂载失败后的清理结果，聚合进 MOUNT_CLEANUP_FAILED
	MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED: {
		category: 'cleanup',
		message: () => 'Cannot confirm Vue component cleanup after mount failed; reload the page'
	}
} satisfies MakooErrorTable;

/** The Vue adapter error table: each code's category and message defined exactly once. */
export const vueErrors = defineMakooErrors(vueErrorTable);

export type VueErrorCode = Extract<keyof typeof vueErrorTable, string>;

/** A `MakooError` narrowed by Vue adapter code; `details` follows the code. */
export type VueError<C extends VueErrorCode = VueErrorCode> = MakooErrorsFor<
	typeof vueErrorTable,
	C
>;

/** Legacy code constants kept during the expand phase; the table keys are the source of truth. */
export const VueErrorCode = {
	VUE_HOOK_OUTSIDE_COMPONENT: 'MAKOO_VUE_HOOK_OUTSIDE_COMPONENT',
	VUE_HOOK_OUTSIDE_SCOPE: 'MAKOO_VUE_HOOK_OUTSIDE_SCOPE',
	VUE_PARTIAL_MOUNT_UNCONFIRMED: 'MAKOO_VUE_PARTIAL_MOUNT_UNCONFIRMED'
} as const;
