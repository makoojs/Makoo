import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

function isWithin(root: string, path: string) {
	const child = relative(root, path);
	return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

const contentTypes: Record<string, string> = {
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.html': 'text/html; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png'
};

export function createArtifactServer(
	artifact: { source: string; directory?: string },
	testPages: Record<string, string>
) {
	return createServer((request, response) => {
		void (async () => {
			response.setHeader('Cache-Control', 'no-store');
			const path = decodeURIComponent(
				new URL(request.url ?? '/', 'http://localhost').pathname
			);
			if (path === '/userscript.user.js') {
				response.setHeader('Content-Type', contentTypes['.js']);
				response.end(artifact.source);
			} else if (path === '/install') {
				response.setHeader('Content-Type', contentTypes['.html']);
				response.end('<a href="/userscript.user.js">Install userscript</a>');
			} else if (Object.hasOwn(testPages, path)) {
				response.setHeader('Content-Type', contentTypes['.html']);
				response.end(testPages[path]);
			} else if (artifact.directory) {
				const root = await realpath(artifact.directory);
				const candidate = resolve(root, `.${path}`);
				if (!isWithin(root, candidate)) {
					response.writeHead(403).end();
					return;
				}
				const file = await realpath(candidate);
				if (!isWithin(root, file)) {
					response.writeHead(403).end();
					return;
				}
				if (!(await stat(file)).isFile()) {
					response.writeHead(404).end();
					return;
				}
				const body = await readFile(file);
				response.setHeader(
					'Content-Type',
					contentTypes[extname(file)] ?? 'application/octet-stream'
				);
				response.end(body);
			} else response.writeHead(404).end();
		})().catch((error: NodeJS.ErrnoException) => {
			const status =
				error instanceof URIError
					? 400
					: error.code === 'ENOENT' || error.code === 'ENOTDIR'
						? 404
						: 500;
			response.writeHead(status).end();
		});
	});
}
