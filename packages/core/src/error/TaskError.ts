import type { MakooIssue } from './MakooError';
import { MakooError } from './MakooError';

export class TaskError extends MakooError {
	constructor(message: string, issues?: MakooIssue[], code?: string, cause?: Error) {
		super(message, issues, code, cause);
		this.name = 'TaskError';
	}
}
