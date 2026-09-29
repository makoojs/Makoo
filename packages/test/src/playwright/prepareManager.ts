import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { unzipSync } from 'fflate';

const version = '2.49.0';
const url = `https://github.com/violentmonkey/violentmonkey/releases/download/v${version}/Violentmonkey-mv3-v${version}.zip`;
const digest = '3fa676c803a9698453ed23dfe496d4bc29a4bec52f6a95e55c43c2955921f8ee';
export async function prepareManager(directory: string) {
	const destination = resolve(directory);
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Manager download failed: HTTP ${response.status}`);
	const archive = new Uint8Array(await response.arrayBuffer());
	if (createHash('sha256').update(archive).digest('hex') !== digest) {
		throw new Error('Manager archive checksum mismatch');
	}
	const files = unzipSync(archive);
	const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
	if (manifest.version !== version || manifest.manifest_version !== 3) {
		throw new Error('Unexpected manager manifest');
	}
	await rm(destination, { recursive: true, force: true });
	for (const [name, content] of Object.entries(files)) {
		const target = resolve(destination, name);
		if (!target.startsWith(destination + sep)) throw new Error(`Invalid archive path: ${name}`);
		if (name.endsWith('/')) continue;
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
	return destination;
}
