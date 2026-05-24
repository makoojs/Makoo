import { ErrorCode } from './ErrorCode';
import type { MakooIssue } from './MakooError';
import { MakooError } from './MakooError';

export class AdapterError extends MakooError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.ADAPTER_ERROR, cause);
		this.name = 'AdapterError';
	}
}
