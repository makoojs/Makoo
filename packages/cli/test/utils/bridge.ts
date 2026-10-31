export async function bridgeReachable(port: number): Promise<boolean> {
	try {
		const response = await fetch(`http://127.0.0.1:${port}/__connection.json`, {
			signal: AbortSignal.timeout(1000)
		});
		return response.ok;
	} catch {
		return false;
	}
}
