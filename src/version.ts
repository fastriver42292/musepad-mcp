import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Read straight from `package.json` at runtime instead of duplicating it as a literal, so it can't drift from the published version. */
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
export const VERSION: string = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
