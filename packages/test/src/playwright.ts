import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { type BrowserContext, test as base, chromium, type Page } from '@playwright/test';
import { createArtifactServer } from './playwright/artifactServer';
import { prepareManager } from './playwright/prepareManager';
import { installUserscript, prepareViolentmonkey } from './playwright/violentmonkey';
import { readUserscript } from './readUserscript';

export { expect } from '@playwright/test';
export { prepareManager } from './playwright/prepareManager';
export type UserscriptInput =
	| string
	| {
			build: (input: { baseURL: string; outputDir: string }) => Promise<string>;
	  };
export type UserscriptOptions = {
	manager: 'violentmonkey';
	managerPath: string | undefined;
	userscript: UserscriptInput;
	/** Local HTML routes. Omit when using an existing baseURL/webServer. */
	testPages: Record<string, string>;
};

type UserscriptResources = {
	temporary: string;
	origin: string;
	artifact: { source: string; directory?: string };
	context?: BrowserContext;
	tracing: boolean;
	stage: string;
	logs: string[];
};

export const test = base.extend<
	UserscriptOptions & {
		userscriptPage: Page;
		_userscriptResources: UserscriptResources;
	}
>({
	manager: ['violentmonkey', { option: true }],
	managerPath: [undefined, { option: true }],
	userscript: ['', { option: true }],
	testPages: [{}, { option: true }],
	_userscriptResources: [
		async ({ testPages }, use, info) => {
			const temporary = await mkdtemp(resolve(tmpdir(), 'makoo-userscript-'));
			const resources: UserscriptResources = {
				temporary,
				origin: '',
				artifact: { source: '' },
				tracing: false,
				stage: 'server',
				logs: []
			};
			const server = createArtifactServer(resources.artifact, testPages);
			try {
				await new Promise<void>((accept, reject) => {
					server.once('error', reject);
					server.listen(0, '127.0.0.1', accept);
				});
				resources.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
				await use(resources);
			} finally {
				try {
					await info.attach('run.log', {
						body: `Last stage: ${resources.stage}\n${resources.logs.join('\n')}`,
						contentType: 'text/plain'
					});
					if (resources.context && resources.tracing) {
						const path = info.outputPath('userscript-trace.zip');
						await resources.context.tracing.stop({ path });
						await info.attach('trace', { path, contentType: 'application/zip' });
					}
				} finally {
					try {
						await resources.context?.close();
					} finally {
						server.closeAllConnections();
						await new Promise<void>((accept) => server.close(() => accept()));
						await rm(temporary, { recursive: true, force: true });
						await info.attach('cleanup.json', {
							body: JSON.stringify({ serverClosed: true, temporaryRemoved: true }),
							contentType: 'application/json'
						});
					}
				}
			}
		},
		{ timeout: 10_000 }
	],
	userscriptPage: async (
		{ manager, managerPath, userscript, baseURL, headless, _userscriptResources: resources },
		use,
		info
	) => {
		if (manager !== 'violentmonkey')
			throw new Error(`Unsupported userscript manager: ${manager}`);
		if (!userscript) throw new Error('Set test.use({ userscript: pathOrBuildOptions })');
		const { temporary, origin, logs } = resources;
		const pageOrigin = baseURL ?? origin;
		resources.stage = 'artifact';
		const path =
			typeof userscript === 'string'
				? userscript
				: await userscript.build({
						baseURL: pageOrigin,
						outputDir: resolve(temporary, 'dist')
					});
		const artifact = await readUserscript(path);
		const source = artifact.source;
		resources.artifact.source = source;
		resources.artifact.directory = dirname(artifact.path);
		await info.attach('userscript', { body: source, contentType: 'text/javascript' });
		resources.stage = 'manager preparation';
		const extension = managerPath
			? resolve(managerPath)
			: await prepareManager(resolve(temporary, 'extension'));
		const manifest = JSON.parse(await readFile(resolve(extension, 'manifest.json'), 'utf8'));
		if (manifest.version !== '2.49.0' || manifest.manifest_version !== 3)
			throw new Error('Expected Violentmonkey 2.49.0 MV3');
		resources.stage = 'browser';
		const context = await chromium.launchPersistentContext(resolve(temporary, 'profile'), {
			channel: 'chromium',
			headless,
			locale: 'en-US',
			baseURL: pageOrigin,
			ignoreDefaultArgs: ['--disable-extensions'],
			args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
		});
		resources.context = context;
		context.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
		context.on('weberror', (error) => logs.push(`pageerror: ${error.error().message}`));
		await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
		resources.tracing = true;
		resources.stage = 'manager permissions';
		const extensionId = await prepareViolentmonkey(context);
		await info.attach('environment.json', {
			body: JSON.stringify({
				browser: context.browser()?.version(),
				manager,
				version: manifest.version,
				extensionId,
				sha256: createHash('sha256').update(source).digest('hex')
			}),
			contentType: 'application/json'
		});
		resources.stage = 'install';
		await installUserscript(context, origin);
		resources.stage = 'behavior';
		await use(await context.newPage());
	}
});
