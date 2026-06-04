const renderObjectEntries = (value: Record<string, unknown>): string => {
	const entries = Object.entries(value)
		.filter(([, item]) => typeof item !== 'undefined')
		.map(([key, item]) => `${JSON.stringify(key)}:${renderInlineValue(item)}`);

	return `{${entries.join(',')}}`;
};

export const renderInlineValue = (value: unknown): string => {
	if (typeof value === 'function') {
		return `(${value.toString()})`;
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => renderInlineValue(item)).join(',')}]`;
	}

	if (value && typeof value === 'object') {
		return renderObjectEntries(value as Record<string, unknown>);
	}

	return JSON.stringify(value);
};
