import type { MakooIssue } from '@makoojs/core';
import { AdapterError, ErrorCode } from '@makoojs/core';

export class ReactAdapterError extends AdapterError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_MOUNT_FAIL, cause);
		this.name = 'ReactAdapterError';
	}
}
