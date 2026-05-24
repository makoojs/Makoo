import type { MakooIssue } from '@makoo/core';
import { AdapterError, ErrorCode } from '@makoo/core';

export class VueAdapterError extends AdapterError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_MOUNT_FAIL, cause);
		this.name = 'VueAdapterError';
	}
}
