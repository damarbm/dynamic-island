// Rebuilds and redeploys on every change under src/ and static/, then restarts
// a nested GNOME Shell with the extension enabled. Only the nested shell that
// this script started is ever killed: it runs in its own process group, and we
// signal that group by its id. The real desktop session is never touched.
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, watch} from 'node:fs';

const {uuid} = JSON.parse(readFileSync('static/metadata.json', 'utf8'));
const DEBOUNCE_MS = 300;

let nested = null;
let timer = null;
let busy = false;
let pending = false;

function stopNested() {
    if (!nested)
        return Promise.resolve();
    const child = nested;
    nested = null;
    return new Promise(resolve => {
        child.once('exit', resolve);
        try {
            process.kill(-child.pid, 'SIGTERM');
        } catch {
            resolve();
        }
        setTimeout(() => {
            try {
                process.kill(-child.pid, 'SIGKILL');
            } catch {
                // already gone
            }
            resolve();
        }, 3000).unref();
    });
}

function startNested() {
    const script = `gnome-shell --devkit --wayland & sleep 6; gnome-extensions enable ${uuid}; wait`;
    nested = spawn('dbus-run-session', ['--', 'bash', '-c', script], {
        detached: true, // own process group, so we can kill exactly this tree
        stdio: 'inherit',
    });
    nested.on('exit', () => {
        nested = null;
    });
}

async function rebuild() {
    if (busy) {
        pending = true;
        return;
    }
    busy = true;
    try {
        console.log('\n[watch] change detected, rebuilding...');
        const result = spawnSync('npm', ['run', 'deploy'], {stdio: 'inherit'});
        if (result.status !== 0) {
            console.log('[watch] build failed; keeping the current nested shell.');
            return;
        }
        await stopNested();
        startNested();
        console.log('[watch] nested shell restarted.');
    } finally {
        busy = false;
        if (pending) {
            pending = false;
            rebuild();
        }
    }
}

function onChange() {
    clearTimeout(timer);
    timer = setTimeout(rebuild, DEBOUNCE_MS);
}

for (const dir of ['src', 'static'])
    watch(dir, {recursive: true}, onChange);

process.on('SIGINT', async () => {
    await stopNested();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await stopNested();
    process.exit(0);
});

console.log('[watch] watching src/ and static/. Press Ctrl+C to stop.');
rebuild();
