import type { InjectionSnapshot, SerializedDiagnostic } from '../vite/session';

/** Transport endpoint handed to the page runtime; token travels in the ws query. */
export type DevEndpoint = {
	host: string;
	port: number;
	token: string;
};

/** One Core instance's complete row inside a page submission. */
export type PageRuntimeRow = {
	runtimeId: number;
	injections: InjectionSnapshot[];
	diagnostics: SerializedDiagnostic[];
};

declare module 'devframe' {
	interface DevframeRpcServerFunctions {
		'makoo:submit-page': (rows: PageRuntimeRow[]) => Promise<void>;
	}
}
