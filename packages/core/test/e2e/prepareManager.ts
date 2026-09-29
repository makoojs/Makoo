import { resolve } from 'node:path';
import { prepareManager } from '@makoojs/test/playwright';

console.log(await prepareManager(resolve(import.meta.dirname, '.cache/violentmonkey')));
