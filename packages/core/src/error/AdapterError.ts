import { ErrorCode } from './ErrorCode';
import type { RiteIssue } from './RiteError';
import { RiteError } from './RiteError';

export class AdapterError extends RiteError {
	constructor(message: string, issues?: RiteIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_ERROR, cause);
		this.name = 'AdapterError';
	}
}
