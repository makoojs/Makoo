import { createMakoo, inject, type ResolvableMountAdapter } from '../../../src/index';
import { element } from './element';

declare const __ALIVE__: boolean;
type Counter = { kind: 'counter' };
type Handle = { button: HTMLButtonElement; onClick: () => void };
let clicks = 0;
let mounts = 0;
let unmounts = 0;

const adapter: ResolvableMountAdapter<Counter, Handle> = {
	name: 'native-counter',
	matches: (artifact): artifact is Counter =>
		typeof artifact === 'object' &&
		artifact !== null &&
		'kind' in artifact &&
		artifact.kind === 'counter',
	mount({ mountPoint }) {
		const button = document.createElement('button');
		button.id = 'alive-button';
		button.textContent = 'Increment alive counter';
		const onClick = () => {
			element('#count').textContent = String(++clicks);
		};
		button.addEventListener('click', onClick);
		mountPoint.append(button);
		element('#mounts').textContent = String(++mounts);
		return { handle: { button, onClick } };
	},
	unmount({ handle }) {
		handle.button.removeEventListener('click', handle.onClick);
		handle.button.remove();
		element('#unmounts').textContent = String(++unmounts);
	}
};

const tasks = createMakoo({ adapters: [adapter] }).start([
	inject({
		id: 'alive-counter',
		injectAt: '#host',
		artifact: { kind: 'counter' },
		options: { alive: __ALIVE__, scope: 'global' }
	})
]);

window.addEventListener('makoo-fixture-dispose', () => tasks.destroyAll(), { once: true });
