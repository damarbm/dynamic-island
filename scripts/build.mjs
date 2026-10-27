// Bundles the TypeScript sources into dist/ and copies the static files
// (metadata, stylesheet, schemas) next to them. dist/ is a ready-to-install
// extension directory.
import {build} from 'esbuild';
import {cpSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

rmSync('dist', {recursive: true, force: true});

await build({
    entryPoints: ['src/extension.ts', 'src/prefs.ts'],
    outdir: 'dist',
    bundle: true,
    format: 'esm',
    target: 'firefox128', // GJS 1.8x ships a recent SpiderMonkey; this keeps modern syntax readable
    minify: false,
    external: ['gi://*', 'resource://*'],
});

cpSync('static', 'dist', {recursive: true});
execFileSync('glib-compile-schemas', ['dist/schemas'], {stdio: 'inherit'});
console.log('Built dist/');
