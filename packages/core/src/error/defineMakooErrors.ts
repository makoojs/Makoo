import type { ErrorCategory } from './MakooError';
import { aggregateMessage, MakooError } from './MakooError';

type ErrorRow<Details> = {
	readonly category: ErrorCategory;
	readonly aggregate?: true;
	readonly message: (details: Details) => string;
};

/** The constraint every package error table satisfies. */
export type MakooErrorTable = Record<string, ErrorRow<never>>;

type DetailsOf<Row> = Row extends { readonly message: infer M }
	? M extends (...args: never[]) => string
		? Parameters<M>[0]
		: never
	: never;

type OptionsOf<Row> = Row extends { readonly aggregate: true }
	? { readonly cause?: unknown; readonly errors?: readonly unknown[] }
	: { readonly cause?: unknown; readonly errors?: never };

/**
 * Rows declared with a zero-parameter `message` take options directly; rows whose `message`
 * declares one details parameter require `details` first. Detected at call time via
 * `message.length`, matching how the rows are declared.
 */
type CreateArgs<Row> = [DetailsOf<Row>] extends [undefined]
	? [options?: OptionsOf<Row>]
	: [details: DetailsOf<Row>, options?: OptionsOf<Row>];

/** A `MakooError` narrowed to one code and its declared details. */
type MakooErrorFor<Code extends string, Details> = MakooError & {
	readonly code: Code;
	readonly details: Details;
};

/**
 * The `MakooError` union over a table's codes, discriminated by `code`; `details` follows the
 * code. Indexing with a single code gives that code's exact shape.
 */
export type MakooErrorsFor<
	Table,
	Code extends Extract<keyof Table, string> = Extract<keyof Table, string>
> = {
	[K in Extract<keyof Table, string>]: MakooErrorFor<K, DetailsOf<Table[K]>>;
}[Code];

/**
 * Defines one package's error table: each row pins a code's category and message once, so the
 * code is written in a single place. `create` covers every code; `createThrowable` is typed to
 * `configuration`/`control` codes and `createRecorded` to `execution`/`cleanup`, enforcing the
 * category boundaries of throw sites and status-write sites at compile time.
 */
export function defineMakooErrors<Table extends MakooErrorTable>(table: Table) {
	type Code = Extract<keyof Table, string>;
	type Details<C extends Code> = DetailsOf<Table[C]>;
	type Created<C extends Code> = MakooErrorFor<C, Details<C>>;

	function create<C extends Code>(code: C, ...args: CreateArgs<Table[C]>): Created<C> {
		const row = table[code] as unknown as {
			category: ErrorCategory;
			message: (d: unknown) => string;
		};
		const hasDetails = row.message.length > 0;
		const details = hasDetails ? args[0] : undefined;
		const options = (hasDetails ? args[1] : args[0]) as
			| { cause?: unknown; errors?: readonly unknown[] }
			| undefined;
		let message = row.message(details);
		if (options?.errors?.length) message = aggregateMessage(message, options.errors);
		return new MakooError(message, {
			category: row.category,
			cause: options?.cause,
			code,
			details,
			errors: options?.errors
		}) as Created<C>;
	}

	type CodesIn<Categories extends ErrorCategory> = {
		[C in Code]: Table[C]['category'] extends Categories ? C : never;
	}[Code];

	const createThrowable = create as <C extends CodesIn<'configuration' | 'control'>>(
		code: C,
		...args: CreateArgs<Table[C]>
	) => Created<C>;

	const createRecorded = create as <C extends CodesIn<'execution' | 'cleanup'>>(
		code: C,
		...args: CreateArgs<Table[C]>
	) => Created<C>;

	return { create, createThrowable, createRecorded };
}
