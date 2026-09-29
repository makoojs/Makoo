import { createMakoo, listen } from '@makoojs/core';

let count = 0;
createMakoo().start([
	listen({
		id: 'consumer-counter',
		listenAt: '#increment',
		type: 'click',
		callback: () => {
			const output = document.querySelector('#count');
			if (output) output.textContent = String(++count);
		}
	})
]);

document.documentElement.dataset.consumerReady = 'true';
