// Runtime URL matching shared by component and standalone listener tasks.
export const renderMatchUrlHelper = (): string => {
	return [
		'const matchUrl = (url, match) => {',
		'  if (!match) return true;',
		'  const matches = (patterns) => {',
		'    if (!patterns) return false;',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: generated code intentionally contains template syntax.
		"    const escape = (value) => value.replace(/[.+?^${}()|[\\]\\\\]/g, '\\\\$&');",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: generated code intentionally contains template syntax.
		"    return patterns.some((pattern) => new RegExp(`^${pattern.split('*').map(escape).join('.*')}$`).test(url));",
		'  };',
		'  const included = match.include ? matches(match.include) : true;',
		'  if (!included) return false;',
		'  if (match.exclude && matches(match.exclude)) return false;',
		'  return true;',
		'};'
	].join('\n');
};
