import type { RiteIssue } from '@rite/core';
import { AdapterError, ErrorCode } from '@rite/core';

export class ReactAdapterError extends AdapterError {
	constructor(message: string, issues?: RiteIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_MOUNT_FAIL, cause);
		this.name = 'ReactAdapterError';
	}
}
