# Dynamic Island

A GNOME Shell extension that puts a compact widget at the center of the top bar. The collapsed **Pill** shows the time and one live system **Metric**. Hover over it and it expands into the **Expanded View**, with graphs for CPU, RAM and network speed.

It is inspired by the Dynamic Island on recent iPhones, and it covers the default clock in the top bar while it is enabled.

## Features

- **Pill**: shows the current time and one Metric (CPU, RAM, or network speed).
- **Expanded View**: hover for about 300 ms to expand it into live graphs for CPU usage, RAM usage, and network download/upload speed. Move the pointer away to collapse it.
- **Rolling History**: the last 2 minutes of samples are recorded in the background, so the graphs are already full when the Expanded View opens.
- **Choice of Pill Metric**: pick which Metric the Pill shows (CPU by default) from the extension's preferences.
- **Low overhead**: samples every 2 seconds while collapsed and every second while expanded. Sampling pauses while the screen is locked or blanked.

## Requirements

- GNOME Shell 50 (the extension's `shell-version` is `50`).
- Linux with `/proc` (the extension reads CPU, memory, and network statistics from it).
- To build: Node.js, npm, and `glib-compile-schemas` (from `glib2` development tools).

## Installation

Install the dependencies and deploy the extension to your user extensions folder:

```sh
npm install
make deploy
```

`make deploy` builds the extension into `dist/` and copies it to `~/.local/share/gnome-shell/extensions/dynamic-island@damar.local`.

Then load it:

- **On Wayland**, log out and back in so GNOME Shell scans the extensions folder.
- Enable it with:

  ```sh
  gnome-extensions enable dynamic-island@damar.local
  ```

## Development

To try changes without logging out of your session, run a nested GNOME Shell with the extension enabled:

```sh
make dev
```

This deploys the latest build and starts `gnome-shell --devkit --wayland` in a D-Bus session. A running shell only scans for extensions when it starts, so run `make deploy` again after changing the code if you are not using `make dev`.

Other scripts from `package.json`:

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run build`   | Bundle the sources and static files into `dist/` |
| `npm run typecheck` | Type-check the project with `tsc --noEmit`  |
| `npm test`        | Run the unit tests in `test/`                 |

## Settings

Open the extension's preferences to change:

- **Pill Metric**: the Metric shown in the Pill next to the time (CPU usage, RAM usage, or Network speed). The default is CPU usage.

The setting is stored in the `org.gnome.shell.extensions.dynamic-island` GSettings schema under the key `pill-metric`.

## How it works

- `src/sampler.ts` reads `/proc/stat`, `/proc/meminfo`, `/proc/net/route`, and `/proc/net/dev`. CPU and network values are rates, so they are measured as the change since the previous sample.
- `src/controller.ts` owns sampling, the History, and the refresh timer. It also listens for the screen lock signal on the session bus and pauses sampling while the screen is locked.
- `src/island.ts` draws the Island in the top bar: the Pill, the Expanded View, and their animations.
- `src/graph.ts` draws the line graphs with Cairo.
- `src/proc.ts` holds the parsers for the `/proc` files. It has no GNOME imports, so it can be unit-tested with plain Node.
- `src/prefs.ts` builds the preferences window.

## Project layout

```
src/           TypeScript sources (extension, controller, island, graph, sampler, prefs, ...)
static/        Files copied as-is into dist/: metadata.json, stylesheet.css, GSettings schema
scripts/       build.mjs (esbuild bundle) and install.sh (copies dist/ into the extensions folder)
test/          Unit tests
docs/          CONTEXT.md, the project's domain glossary
```

## Glossary

The terms used in this project are defined in [`docs/CONTEXT.md`](docs/CONTEXT.md). In short:

- **Island**: the whole widget, collapsed or expanded.
- **Pill**: the collapsed Island.
- **Expanded View**: the expanded Island, showing all Metrics.
- **Metric**: one live measurement (CPU, RAM, or network speed).
- **Pill Metric**: the Metric shown in the Pill.
- **History**: the rolling record of recent samples.

## License

ISC
