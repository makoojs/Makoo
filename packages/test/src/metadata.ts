export type MetadataEntry = {
	key: string;
	value: string;
	/** One-based source line. */
	line: number;
	/** UTF-16 source offsets; end is exclusive and excludes the newline. */
	start: number;
	end: number;
};

export type UserscriptMetadata = {
	entries: MetadataEntry[];
	fields: Record<string, string[] | undefined>;
	start: number;
	end: number;
};

export type MetadataParseErrorCode =
	| 'MISSING_METADATA'
	| 'UNCLOSED_METADATA'
	| 'INVALID_METADATA_LINE';

export class MetadataParseError extends SyntaxError {
	readonly code: MetadataParseErrorCode;
	readonly line: number;
	readonly offset: number;

	constructor(code: MetadataParseErrorCode, message: string, line: number, offset: number) {
		super(`${message} (line ${line}, offset ${offset})`);
		this.name = 'MetadataParseError';
		this.code = code;
		this.line = line;
		this.offset = offset;
	}
}

/** Reads the leading metadata comment block; this does not validate manager-specific rules. */
export function parseMetadata(source: string): UserscriptMetadata {
	const entries: MetadataEntry[] = [];
	const fields: Record<string, string[] | undefined> = Object.create(null);
	let start: number | undefined;
	let openingLine = 1;
	let line = 0;
	for (const match of source.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
		line++;
		const text = match[1];
		const offset = match.index;
		const trimmed = text.trim();
		if (start === undefined) {
			if (!trimmed) continue;
			if (!/^\/\/[\t ]*==UserScript==$/.test(trimmed)) {
				throw new MetadataParseError(
					'MISSING_METADATA',
					'Expected a leading userscript metadata block',
					line,
					offset
				);
			}
			start = offset + text.indexOf('//');
			openingLine = line;
			continue;
		}
		if (/^\/\/[\t ]*==\/UserScript==$/.test(trimmed)) {
			return { entries, fields, start, end: offset + text.trimEnd().length };
		}
		if (!trimmed) continue;
		if (!trimmed.startsWith('//') || /^\/\/[\t ]*==UserScript==$/.test(trimmed)) {
			throw new MetadataParseError(
				'INVALID_METADATA_LINE',
				'Expected a metadata comment or closing marker',
				line,
				offset
			);
		}
		const field = /^\/\/[\t ]+@([^\s]+)(?:[\t ]+(.*))?$/.exec(trimmed);
		if (!field) continue;
		const key = field[1];
		const value = field[2] ?? '';
		entries.push({ key, value, line, start: offset, end: offset + text.length });
		const values = fields[key] ?? [];
		values.push(value);
		fields[key] = values;
	}
	if (start === undefined) {
		throw new MetadataParseError(
			'MISSING_METADATA',
			'Expected a leading userscript metadata block',
			1,
			0
		);
	}
	throw new MetadataParseError(
		'UNCLOSED_METADATA',
		'Missing userscript metadata closing marker',
		openingLine,
		start
	);
}
