const MAX_SUGGESTION_DISTANCE = 2;

function editDistance(a: string, b: string): number {
	const previous = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j++) previous[j] = j;
	for (let i = 1; i <= a.length; i++) {
		let diagonal = previous[0];
		previous[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const up = previous[j];
			previous[j] = Math.min(
				previous[j] + 1,
				previous[j - 1] + 1,
				diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
			diagonal = up;
		}
	}
	return previous[b.length];
}

export function suggestCommand(input: string, commands: readonly string[]): string | undefined {
	let suggestion: string | undefined;
	let best = MAX_SUGGESTION_DISTANCE + 1;
	for (const name of commands) {
		const distance = editDistance(input, name);
		if (distance < best) {
			best = distance;
			suggestion = name;
		}
	}
	return suggestion;
}
