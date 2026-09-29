import { createMakoo, listen } from '../../../src/index';
import { element } from './element';

declare const __PERSIST__: boolean;
declare const GM: {
	getValue<T>(key: string, fallback: T): Promise<T>;
	setValue(key: string, value: unknown): Promise<void>;
};

const state = element('#storage-state');
async function start() {
	const count = element('#count');
	const button = element<HTMLButtonElement>('#increment');
	let value = await GM.getValue('counter', 0);
	count.textContent = String(value);
	createMakoo().start([
		listen({
			id: 'persistent-counter',
			listenAt: '#increment',
			type: 'click',
			callback: async () => {
				button.disabled = true;
				try {
					if (__PERSIST__) await GM.setValue('counter', value + 1);
					count.textContent = String(++value);
				} catch (error) {
					state.textContent = String(error);
				} finally {
					button.disabled = false;
				}
			}
		})
	]);
	state.textContent = 'ready';
}
void start().catch((error) => {
	state.textContent = String(error);
});
