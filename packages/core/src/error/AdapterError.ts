import { ErrorCode } from './ErrorCode';
import type { MakooIssue } from './MakooError';
import { MakooError } from './MakooError';

export class AdapterError extends MakooError {
	constructor(message: string, issues?: MakooIssue[], code: string = ErrorCode.ADAPTER_NOT_FOUND, cause?: Error) {
		super(message, issues, code, cause);
		this.name = 'AdapterError';
	}
}
