import { defineErrors, type MakooErrorFor } from './defineErrors';
import type { ErrorCategory } from './MakooError';

export const coreErrorTable = {
	// configuration：声明、命名、adapter 配置错误，批处理开始前抛出
	MAKOO_ADAPTER_NAME_CONFLICT: {
		category: 'configuration',
		message: (d: { name: string }) => `Adapter "${d.name}" is already registered`
	},
	MAKOO_ADAPTER_NOT_FOUND: {
		category: 'configuration',
		message: (d: { name: string }) => `Unknown adapter "${d.name}"`
	},
	MAKOO_DECLARATION_INVALID: {
		category: 'configuration',
		message: (d: { reason: string }) => d.reason
	},
	MAKOO_INJECTION_NAME_CONFLICT: {
		category: 'configuration',
		message: (d: { name: string }) => `Injection name "${d.name}" is already occupied`
	},

	// control：当前状态下不允许的调用，抛出
	MAKOO_INJECTION_CLOSED: {
		category: 'control',
		message: (d: { name: string }) =>
			`Injection "${d.name}" cannot restart after cleanup failed`
	},
	MAKOO_INJECTION_NOT_FOUND: {
		category: 'control',
		message: (d: { name: string }) => `Unknown injection "${d.name}"`
	},
	MAKOO_INJECTION_REMOVED: {
		category: 'control',
		message: (d: { name: string }) => `Injection "${d.name}" was removed`
	},
	MAKOO_INSTANCE_DISPOSED: {
		category: 'control',
		message: () => 'Core instance is disposed'
	},
	MAKOO_LISTENER_NOT_FOUND: {
		category: 'control',
		message: (d: { name: string; injection: string }) =>
			`Unknown listener "${d.name}" in "${d.injection}"`
	},

	// execution：执行失败，写入注入的 lastError（Child 走 diagnostic）
	MAKOO_ATTACHED_LISTENER_FAILED: {
		category: 'execution',
		message: (d: { name: string; listener: string }) =>
			`"${d.name}" stopped because listener "${d.listener}" failed`
	},
	MAKOO_LISTENER_BIND_FAILED: {
		category: 'execution',
		message: (d: { name: string }) => `Failed to bind listener "${d.name}"`
	},
	MAKOO_LISTENER_TARGET_DETACHED: {
		category: 'execution',
		message: (d: { name: string }) => `Listener target "${d.name}" disconnected`
	},
	MAKOO_MOUNT_FAILED: {
		category: 'execution',
		message: (d: { name: string }) => `Failed to mount "${d.name}"`
	},
	MAKOO_MOUNT_TARGET_DETACHED: {
		category: 'execution',
		message: (d: { name: string }) => `Mount target "${d.name}" disconnected`
	},
	MAKOO_TARGET_WAIT_TIMEOUT: {
		category: 'execution',
		message: (d: { name: string; selector: string; timeout: number; lockedSkipped?: number }) =>
			`Timed out waiting for target "${d.selector}" of "${d.name}"`
	},

	// cleanup：清理失败，写入 lastError 或聚合
	MAKOO_CONTAINER_REMOVE_FAILED: {
		category: 'cleanup',
		message: (d: { name: string }) => `Failed to remove container of "${d.name}"`
	},
	MAKOO_INJECTION_CLEANUP_FAILED: {
		category: 'cleanup',
		aggregate: true,
		message: (d: { name: string }) => `Cleanup failed for "${d.name}"`
	},
	MAKOO_INSTANCE_CLEANUP_FAILED: {
		category: 'cleanup',
		aggregate: true,
		message: () => 'Failed to dispose core'
	},
	MAKOO_LISTENER_UNBIND_FAILED: {
		category: 'cleanup',
		message: (d: { name: string }) => `Failed to unbind listener "${d.name}"`
	},
	MAKOO_MOUNT_CLEANUP_FAILED: {
		category: 'cleanup',
		aggregate: true,
		message: (d: { name: string }) => `Cleanup after mount of "${d.name}" failed`
	},
	MAKOO_UNMOUNT_FAILED: {
		category: 'cleanup',
		message: (d: { name: string }) => `Failed to unmount "${d.name}"`
	},

	// callback：订阅者、观察者、事件处理函数错误，只发 diagnostic
	MAKOO_INSTANCE_OBSERVER_FAILED: {
		category: 'callback',
		message: () => 'Instance observe handler failed'
	},
	MAKOO_LISTENER_CALLBACK_FAILED: {
		category: 'callback',
		message: (d: { name: string }) => `Callback of listener "${d.name}" failed`
	},
	MAKOO_STATE_SUBSCRIBER_FAILED: {
		category: 'callback',
		message: (d: { owner: string }) => `State subscriber of ${d.owner} failed`
	}
} satisfies Record<
	string,
	{ category: ErrorCategory; aggregate?: true; message: (d: never) => string }
>;

/** The core error table: each code's category and message defined exactly once. */
export const coreErrors = defineErrors(coreErrorTable);

export type CoreErrorCode = Extract<keyof typeof coreErrorTable, string>;

type CoreDetails<C extends CoreErrorCode> = Parameters<(typeof coreErrorTable)[C]['message']>[0];

/** A `MakooError` narrowed by core code; `details` follows the code. */
export type CoreError<C extends CoreErrorCode = CoreErrorCode> = {
	[K in CoreErrorCode]: MakooErrorFor<K, CoreDetails<K>>;
}[C];
