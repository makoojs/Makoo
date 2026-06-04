const normalizeImportPath = (value: string): string => {
	return value.replace(/\\/g, '/');
};

export function renderRuntimeSetupImport(setup: string[]): string {
	return setup.map((file) => `import '${normalizeImportPath(file)}';`).join('\n');
}
