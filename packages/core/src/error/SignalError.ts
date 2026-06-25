import { ErrorCode } from './ErrorCode';
import type { MakooIssue } from './MakooError';
import { MakooError } from './MakooError';

export class SignalError extends MakooError {
	constructor(
		message: string,
		issues?: MakooIssue[],
		code: string = ErrorCode.TASK_SIGNAL_INVALID,
		cause?: Error
	) {
		super(message, issues, code, cause);
		this.name = 'SignalError';
	}
}
