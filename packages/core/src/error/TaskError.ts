import { ErrorCode } from './ErrorCode';
import type { MakooIssue } from './MakooError';
import { MakooError } from './MakooError';

export class TaskError extends MakooError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code ?? ErrorCode.TASK_ERROR, cause);
		this.name = 'TaskError';
	}
}
