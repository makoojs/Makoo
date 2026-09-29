import React, { useState } from 'react';

export function Counter() {
	const [count, setCount] = useState(0);
	return (
		<button id="react-increment" onClick={() => setCount((previous) => previous + 1)}>
			React: {count}
		</button>
	);
}
