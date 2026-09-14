export function normalizeSitePath(hrefOrPath: string, base: string): string {
	const pathname = hrefOrPath.split(/[?#]/)[0] || '/';
	const normalizedBase = (base || '/').replace(/\/+$/, '');
	let path = pathname;
	if (normalizedBase && (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))) {
		path = pathname.slice(normalizedBase.length) || '/';
	}
	if (!path.startsWith('/')) path = `/${path}`;
	if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
	return path;
}

export function isChineseLocale(localeIndex: string, lang: string): boolean {
	return localeIndex === 'zh' || lang.toLowerCase().startsWith('zh');
}

export function isGuideSitePath(path: string): boolean {
	return hasSitePrefix(path, '/docs') || hasSitePrefix(path, '/zh/docs');
}

export function isApiSitePath(path: string): boolean {
	return hasSitePrefix(path, '/api') || hasSitePrefix(path, '/zh/api');
}

function hasSitePrefix(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(`${prefix}/`);
}
