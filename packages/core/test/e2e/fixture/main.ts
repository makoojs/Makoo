import { createMakoo, listen } from '../../../src/index';

const runtime = createMakoo();
function element(selector: string) {
	const result = document.querySelector<HTMLElement>(selector);
	if (!result) throw new Error(`Missing fixture element: ${selector}`);
	return result;
}

const count = element('#count');
const state = element('#script-state');
let value = 0;

function start() {
	runtime.start([
		listen({
			id: 'counter',
			listenAt: '#increment',
			type: 'click',
			callback: () => {
				count.textContent = String(++value);
			}
		})
	]);
	state.textContent = 'running';
}

element('#dispose').addEventListener('click', () => {
	runtime.destroyAll();
	state.textContent = 'disposed';
});
element('#restart').addEventListener('click', () => {
	runtime.destroyAll();
	start();
});
start();
