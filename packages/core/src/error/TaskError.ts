import { ErrorCode } from './ErrorCode';
import type { RiteIssue } from './RiteError';
import { RiteError } from './RiteError';

export class TaskError extends RiteError {
	constructor(message: string, issues?: RiteIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.TASK_ERROR, cause);
		this.name = 'TaskError';
	}
}
