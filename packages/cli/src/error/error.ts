import { relative } from 'node:path';
import process from 'node:process';
import { ErrorCode, MakooError, type MakooIssue } from '@makoo/core';

export interface ValidationIssue {
	code: string;
	path: PropertyKey[];
	message: string;
}

export class ModuleAlreadyExistsError extends MakooError {
	constructor(
		message: string,
		code: string = ErrorCode.CLI_MODULE_ALREADY_EXISTS,
		cause?: Error
	) {
		super(message, undefined, code, cause);
		this.name = 'ModuleAlreadyExistsError';
	}
}

export class LoadViteMakooConfigError extends MakooError {
	constructor(message: string, code: string, cause?: Error) {
		super(message, undefined, code, cause);
		this.name = 'LoadViteMakooConfigError';
	}
}

export class RuntimeSetupNotFoundError extends MakooError {
	constructor(file: string, code: string = ErrorCode.CLI_RUNTIME_SETUP_NOT_FOUND, cause?: Error) {
		super(
			`Runtime setup file not found at ${file}`,
			[{ path: 'runtime.setup', message: file }],
			code,
			cause
		);
		this.name = 'RuntimeSetupNotFoundError';
	}
}

// --- Manifest validation error (CLI-specific) ---

export class ManifestValidationError extends MakooError {
	constructor(
		file: string,
		zodIssues: ValidationIssue[],
		code: string = ErrorCode.CLI_MANIFEST_VALIDATION_FAIL,
		cause?: Error
	) {
		const issues = zodIssues.map(toMakooIssue);
		const rel = relative(process.cwd(), file);
		super(`Invalid manifest at ${rel}`, issues, code, cause);
		this.name = 'ManifestValidationError';
	}
}

// --- Config errors ---

export class ConfigValidationError extends MakooError {
	constructor(issues: MakooIssue[], code: string = ErrorCode.CLI_CONFIG_INVALID, cause?: Error) {
		super('Invalid CliConfig', issues, code, cause);
		this.name = 'ConfigValidationError';
	}
}

export class UnknownFrameworkError extends MakooError {
	constructor(
		componentPath: string,
		code: string = ErrorCode.CLI_UNKNOWN_FRAMEWORK,
		cause?: Error
	) {
		super(
			`Cannot infer framework from "${componentPath}". Set "framework" explicitly ("Vue" or "React") in the module manifest.`,
			[{ path: 'framework', message: `cannot infer from "${componentPath}"` }],
			code,
			cause
		);
		this.name = 'UnknownFrameworkError';
	}
}

export class ComponentNotFoundError extends MakooError {
	constructor(
		injectionName: string,
		code: string = ErrorCode.CLI_COMPONENT_NOT_FOUND,
		cause?: Error
	) {
		super(
			`Missing component path for injection "${injectionName}"`,
			[{ path: 'component', message: 'could not resolve component path' }],
			code,
			cause
		);
		this.name = 'ComponentNotFoundError';
	}
}

// --- Scanner errors ---

export class UnsupportedFrameworkGenerationError extends MakooError {
	constructor(ext: string, code: string = ErrorCode.CLI_UNSUPPORTED_FRAMEWORK, cause?: Error) {
		super(`Unsupported framework for template generation: ${ext}`, undefined, code, cause);
		this.name = 'UnsupportedFrameworkError';
	}
}

export class SourceDirNotFoundError extends MakooError {
	constructor(dir: string, code: string = ErrorCode.CLI_SOURCE_DIR_NOT_FOUND, cause?: Error) {
		super(`Source directory not found at ${dir}`, undefined, code, cause);
		this.name = 'SourceDirNotFoundError';
	}
}

export class ManifestNotFoundError extends MakooError {
	constructor(dir: string, code: string = ErrorCode.CLI_MANIFEST_NOT_FOUND, cause?: Error) {
		super(`No manifest found in source directory at ${dir}`, undefined, code, cause);
		this.name = 'ManifestNotFoundError';
	}
}

export class ManifestLoadError extends MakooError {
	constructor(path: string, code: string = ErrorCode.CLI_MANIFEST_LOAD_FAIL, cause?: Error) {
		super(
			`Failed to load manifest at ${path}`,
			[{ path: '(load)', message: cause instanceof Error ? cause.message : String(cause) }],
			code,
			cause
		);
		this.name = 'ManifestLoadError';
	}
}

export class ModuleManifestLoadError extends MakooError {
	constructor(
		path: string,
		code: string = ErrorCode.CLI_MODULE_MANIFEST_LOAD_FAIL,
		cause?: Error
	) {
		super(
			`Failed to load module manifest at ${path}`,
			[{ path: '(load)', message: cause instanceof Error ? cause.message : String(cause) }],
			code,
			cause
		);
		this.name = 'ModuleManifestLoadError';
	}
}

export class NoEnabledInjectionsError extends MakooError {
	constructor(code: string = ErrorCode.CLI_NO_ENABLED_INJECTIONS, cause?: Error) {
		super(
			'No enabled injections — all injections are disabled or filtered out',
			undefined,
			code,
			cause
		);
		this.name = 'NoEnabledInjectionsError';
	}
}

// --- Zod issue → MakooIssue translation ---

function formatZodPath(path: PropertyKey[]): string {
	if (path.length === 0) return '(root)';
	return path
		.filter((p) => typeof p !== 'symbol')
		.map((p) => (typeof p === 'number' ? `[${p}]` : p))
		.join('.');
}

function formatZodMessage(issue: ValidationIssue): string {
	if (issue.code === 'invalid_type' && issue.message.endsWith('received undefined')) {
		return 'is required';
	}
	return issue.message;
}

export function toMakooIssue(issue: ValidationIssue): MakooIssue {
	return {
		path: formatZodPath(issue.path),
		message: formatZodMessage(issue)
	};
}
