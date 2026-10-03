import type { MakooIssue } from '@makoojs/core';
import { ErrorCode, MakooError } from '@makoojs/core';

export class VueAdapterError extends MakooError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_MOUNT_FAIL, cause);
		this.name = 'VueAdapterError';
	}
}

export function causeError(cause: unknown): Error {
	return cause instanceof Error ? cause : new Error(String(cause), { cause });
}
