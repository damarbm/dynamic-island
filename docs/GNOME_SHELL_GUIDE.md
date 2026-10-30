# GNOME Shell Development: A Guide Through Dynamic Island

This guide explains what every folder and file in this project does, and the GNOME Shell ideas you need to understand them. Read it top to bottom once, then use it as a reference while you work.

For the project's own vocabulary (Island, Pill, Expanded View, Metric, History), see [CONTEXT.md](CONTEXT.md).

---

## Part 1: GNOME Shell basics

### What is an extension?

GNOME Shell is the desktop itself: the top bar, the Activities overview, and the notification popups. It runs as **one long-lived process**.

An **extension** is a folder of JavaScript that GNOME Shell loads into that process. The extension can add actors (widgets) to the top bar, change behavior, and so on.

Two consequences shape everything else:

1. **Your code runs inside the desktop.** An uncaught error is logged, and a badly written extension can break the desktop for the whole session.
2. **You must undo everything when the extension is disabled.** Timers, signal handlers, widgets, and changes to other people's widgets all need to be cleaned up. Otherwise they leak or stay visible.

### The JavaScript runtime: GJS

GNOME Shell runs JavaScript through **GJS**. GJS uses SpiderMonkey (Mozilla's JavaScript engine) and gives JavaScript access to GNOME's C libraries.

Since GNOME 45, extensions are **ES modules**, which is why the files use `import` and `export`.

### The imports you will see

| Import                                                          | What it is                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `gi://St`                                                       | **St** (Shell Toolkit): the widget library GNOME Shell itself is built with. Labels, boxes, and so on. Styled with CSS. |
| `gi://Clutter`                                                  | **Clutter**: the scene graph under St. Handles actors, positions, and animations (`ease`).                              |
| `gi://GLib`                                                     | Core utilities: timers (`timeout_add`), monotonic time, reading files, the main loop.                                   |
| `gi://Gio`                                                      | I/O: GSettings, D-Bus, files.                                                                                           |
| `gi://Gtk`, `gi://Adw`                                          | **GTK 4** and **libadwaita**. Used only in the preferences window.                                                      |
| `resource:///org/gnome/shell/ui/main.js`                        | GNOME Shell's own internal modules. Exposes `Main.panel`, `Main.layoutManager`, and so on.                              |
| `resource:///org/gnome/shell/extensions/extension.js`           | The `Extension` base class your extension extends.                                                                      |
| `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` | The `ExtensionPreferences` base class for the settings window.                                                          |

The `gi://` prefix means **GObject Introspection**. It is how GJS talks to C libraries. `gi://Clutter` means "the Clutter library".

The `resource:///` prefix means a file that is built into GNOME Shell, not a file on your disk. You cannot change these files. You only import from them.

### Key GNOME concepts

**Actor.** Anything that is drawn on screen and takes part in layout. Labels, boxes, and drawing areas are all actors. Every actor has properties such as `width`, `height`, `opacity`, `visible`, and `hover`.

**Signals.** Objects emit named events. You subscribe with `connect` and unsubscribe with `disconnect`:

```js
const id = actor.connect('notify::hover', () => { /* runs when hover changes */ });
actor.disconnect(id);
```

Property changes emit `notify::<property>`. Keep the returned ID so you can disconnect later.

**Timers and the main loop.** GNOME has an event loop. Repeating work is scheduled with a GLib timer:

```js
const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    doWork();
    return GLib.SOURCE_CONTINUE;   // keep repeating; SOURCE_REMOVE stops it
});
GLib.Source.remove(id);            // cancel it
```

**Chrome.** `Main.layoutManager.addTopChrome(actor)` places UI above windows and reserves its area so clicks reach it. `removeChrome` takes it back off.

**Style classes and CSS.** Setting `style_class: 'dynamic-island'` on an actor makes it match `.dynamic-island` in a stylesheet. The shell theme's CSS applies too.

**Animation with `ease`.** Animates properties over time. `mode` picks the easing curve, and `onComplete` runs when the animation ends:

```js
actor.ease({width: 300, duration: 250, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
```

**GSettings.** Typed key/value storage. Keys are declared in an XML schema file. Both the extension and the preferences window read and write the same keys.

**D-Bus.** The system's messaging bus. Programs publish signals on it, and others subscribe. This project listens for the screen lock signal on the session bus.

**Cairo.** A 2D drawing library. A `St.DrawingArea` emits a `repaint` signal, and your handler draws into a Cairo context.

**Looking Glass.** GNOME's built-in inspector. Press `Alt+F2`, type `lg`, and press Enter. You can browse live actors and run JavaScript inside the shell. It is the best tool for learning.

---

## Part 2: The big picture

The extension has one data path and one event path.

```mermaid
flowchart TD
    proc["/proc files"] --> sampler["Sampler<br/>sampler.ts"]
    lock["D-Bus: screen lock"] --> controller
    settings["GSettings: pill-metric"] --> controller
    timer["GLib timer<br/>2 s collapsed, 1 s expanded"] --> controller
    sampler --> controller["Controller<br/>controller.ts"]
    controller -->|"history push, setPill, setRow"| island["Island<br/>island.ts"]
    island --> graph["Graph<br/>graph.ts (Cairo)"]
    hover["pointer hover"] --> island
    island -->|"onExpandedChanged"| controller
```

- **Data path.** The `Sampler` reads `/proc` and returns numbers. The `Controller` keeps those numbers in `RingBuffer`s and tells the `Island` to show them. The `Island` hands its line data to `Graph`, which draws it.
- **Event path.** Hovering the pointer expands the Island. The Island tells the Controller, which switches to a faster timer. Locking the screen pauses sampling.

This split is a simple version of **model-view-controller**:

- `sampler.ts`, `history.ts`, and `proc.ts` are the **model**. They produce and store data.
- `island.ts` and `graph.ts` are the **view**. They only display.
- `controller.ts` is the **controller**. It connects the two and owns the timers.

---

## Part 3: The lifecycle of an extension

Every extension has an entry point with an `enable()` and a `disable()` method. GNOME calls them when the user turns the extension on or off.

Here is what this project does, from `src/extension.ts`:

```ts
enable(): void {
    this._controller = new Controller(this.getSettings());   // start everything
    // ...hide the default clock...
}

disable(): void {
    // undo the clock change first
    this._controller?.destroy();                             // then stop everything
    this._controller = null;
}
```

The pattern to learn:

1. `enable()` **creates** things and stores references to them.
2. `disable()` **destroys** them, in reverse order where it matters.
3. Each object that creates something also has a `destroy()` that removes it. The `Controller` destroys the `Island`, and the `Island` removes its chrome and disconnects its signals.

Note that `disable()` restores the clock's opacity to the value it had before `enable()` ran. That is the rule for changes to shell widgets: **remember the old value, then restore it**.

---

## Part 4: The folders

```
dynamic-island/
├── src/            TypeScript source code (the real work happens here)
├── static/         Files copied unchanged into dist/
├── scripts/        Build and install scripts
├── test/           Unit tests
├── docs/           Project documentation (this guide, CONTEXT.md)
├── dist/           Build output. Generated. Do not edit.
├── node_modules/   npm packages. Generated. Do not edit.
├── .git/           Git history. Generated.
└── ...             Root config files (see below)
```

### `src/`: source code

Everything you edit lives here. It is TypeScript, which is JavaScript with types. Types are checked by `tsc` and removed at build time, so they do not exist at runtime.

### `static/`: files that ship as-is

Files that do not need compiling. The build copies them into `dist/`:

| File                    | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `metadata.json`         | Identifies the extension to GNOME Shell (see Part 5). |
| `stylesheet.css`        | Visual styling for the Island.                        |
| `schemas/*.gschema.xml` | Declares the settings keys (see Part 5).              |

### `scripts/`: build and install

| File         | Purpose                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `build.mjs`  | Bundles `src/` into `dist/` with esbuild, copies `static/`, and compiles the schema. |
| `install.sh` | Copies `dist/` into `~/.local/share/gnome-shell/extensions/<uuid>/`.                 |

### `test/`: unit tests

| File           | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `proc.test.ts` | Tests for the `/proc` parsers, formatters, and `RingBuffer`. |

Tests run with plain Node, not GNOME. This works because the tested modules never import `gi://` or `resource:///`. See Part 7.

### `docs/`: documentation

- `CONTEXT.md`: the project's glossary. It also lists words to avoid.
- `GNOME-SHELL-GUIDE.md`: this file.

### `dist/`: build output

This folder is generated and ignored by git. It is the **installable extension**. `dist/` holds the bundled `extension.js` and `prefs.js`, plus the copied `metadata.json`, `stylesheet.css`, and the compiled schema. Its contents are what GNOME Shell actually loads.

### `node_modules/`: dependencies

Installed by `npm install`. The `@girs/*` packages are **type definitions only**. They tell TypeScript what GNOME's libraries look like. They are not shipped in the extension.

---

## Part 5: The root files

| File                   | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `static/metadata.json` | The extension's identity. Copied into `dist/`. See below.                                            |
| `package.json`         | npm project file. Defines the scripts (`build`, `typecheck`, `test`, `deploy`) and dev dependencies. |
| `package-lock.json`    | Pins exact dependency versions. Do not edit by hand.                                                 |
| `tsconfig.json`        | TypeScript compiler settings. Used by `npm run typecheck`.                                           |
| `Makefile`             | Shortcuts for the common workflows (`make deploy`, `make dev`).                                      |
| `README.md`            | User-facing overview: features, install steps, and how it works.                                     |
| `.gitignore`           | Tells git to ignore `node_modules/` and `dist/`.                                                     |

### `metadata.json`

GNOME Shell reads this file first. It must include:

- **`uuid`**: the extension's unique ID. Here it is `dynamic-island@damar.local`. The install folder must have this exact name.
- **`shell-version`**: the GNOME versions the extension supports. Here it is `["50"]`. GNOME refuses to load it on other versions.
- **`settings-schema`**: the GSettings schema the extension uses.

### `tsconfig.json`

Settings worth knowing:

- `"strict": true`: strict type checking. Catches many bugs early.
- `"types": []`: TypeScript will not auto-load type packages. GNOME types have to be imported explicitly, which is what `ambient.d.ts` does.
- `"include": ["src/**/*.ts"]`: checks every file in `src/`, including `ambient.d.ts`.
- `"noEmit": true`: TypeScript only checks types. esbuild does the actual compiling.

### `Makefile`

| Target        | What it does                                            |
| ------------- | ------------------------------------------------------- |
| `make deploy` | Builds and installs the extension (`npm run deploy`).   |
| `make run`    | Starts a nested GNOME Shell with the extension enabled. |
| `make dev`    | `deploy` then `run`. The fastest loop while developing. |

---

## Part 6: The source files, one by one

Read them in this order. Each one depends only on the ones before it.

### 1. `format.ts`: turning numbers into text

Pure functions. `formatPercent(12.4)` gives `"12%"`, and `formatSpeed` scales bytes into KB/s, MB/s, and so on.

**Learn:** the simplest kind of module. No GNOME imports, no state.

### 2. `history.ts`: the RingBuffer

A fixed-size list that drops the oldest value when full. The Controller keeps 60 samples in each one.

**Learn:** why graphs need a history at all. One sample is just a number. A graph needs a list of them.

### 3. `proc.ts`: parsers for `/proc`

Turns the text of `/proc/stat`, `/proc/meminfo`, `/proc/net/route`, and `/proc/net/dev` into numbers. Examples:

- `parseCpuStat` adds up the CPU time fields. Busy is total minus idle.
- `parseDefaultRouteInterface` finds the network interface that carries internet traffic.

`/proc` is a virtual filesystem. The kernel writes its statistics there as plain text. Reading a file in `/proc` gives you the current numbers.

**Learn:** the file header says "No GNOME imports, so they can be unit-tested with plain Node". Keeping logic free of UI code makes it testable.

### 4. `sampler.ts`: taking measurements

Uses `proc.ts` to read the files, then returns a `Snapshot`: CPU %, RAM %, network download and upload bytes per second.

Key idea: **CPU and network are rates**. A single reading of CPU time means nothing on its own. The Sampler keeps a `Baseline` from the last call and reports the change since then, divided by elapsed time.

Also note `readProc` uses `GLib.file_get_contents`, a GLib function for reading files, and not Node's `fs` module. GJS has no Node APIs.

**Learn:** the difference between a counter (cumulative) and a rate (change over time).

### 5. `graph.ts`: drawing the graphs

A `St.DrawingArea` is a blank actor. It emits a `repaint` signal when it needs to draw, and the handler draws with Cairo:

- `cr.moveTo` and `cr.lineTo` build a path.
- `cr.stroke()` draws the line. `cr.fill()` fills the area under it.
- `cr.$dispose()` frees the Cairo context when done.

The graph scales its y-axis either to a fixed maximum (CPU and RAM use 100%) or to the largest value on screen (network). A minimum top stops idle noise from looking like a spike.

**Learn:** custom drawing in GNOME. You describe the picture, and the compositor paints it.

### 6. `island.ts`: the view

The largest file (around 300 lines). It builds the widget tree and animates it:

- `_pill`: the collapsed row showing the time and the Pill Metric.
- `_details`: the Expanded View with one row per Metric (name, value, graph).
- `_actor`: the outer rounded box that contains both. It is added to the top bar as chrome.

Important behavior:

- **Hover.** `track_hover: true` plus `notify::hover` detects the pointer. The Island waits 300 ms (`EXPAND_DELAY_MS`) before expanding, so passing over it does not trigger the animation.
- **Measure, then animate.** To animate to the natural size, the code first lets St compute the target size (`set_size(-1, -1)` then `get_preferred_size()`), then sets the old size back and animates to the target. This is the standard GNOME trick for animating to an automatic size.
- **Positioning.** `_reposition` centers the Island horizontally on the primary monitor. It reacts to `notify::width`, `notify::height`, and the `monitors-changed` signal.

**Learn:** layout in St. `get_preferred_size` asks an actor how big it wants to be.

### 7. `controller.ts`: the brain

Owns everything that changes over time:

- The `Sampler`, the four `RingBuffer`s, and the `Island`.
- A GLib timer. Ticks every 2 s when collapsed and every 1 s when expanded. Hovering triggers `onExpandedChanged`, which reschedules the timer.
- A D-Bus subscription to `org.gnome.ScreenSaver` `ActiveChanged`. It pauses sampling while the screen is locked and resumes afterward.
- A GSettings subscription to `changed::pill-metric`, so the Pill updates as soon as the user changes the preference.

`_tick()` runs on every timer tick. It samples, pushes history at most once per 2 s, and calls `_render()`. `_render()` pushes the current values to the Island.

**Learn:** the shape of a GNOME feature. Subscriptions to timers, D-Bus, and settings are all created in the constructor, and `destroy()` removes them.

### 8. `extension.ts`: the entry point

The class that GNOME Shell instantiates. It has only `enable()` and `disable()`.

It also hides the default clock with `opacity = 0`, not `visible = false`. As the code comment says, opacity keeps the top bar layout unchanged. Setting `visible = false` would remove the clock from layout and shift the other top bar items.

**Learn:** `Main.panel.statusArea.dateMenu` is an example of reaching into the shell's own UI. These paths come from reading GNOME Shell's source, and they can change between versions.

### 9. `prefs.ts`: the preferences window

A separate program. It runs in the Settings app, not in the shell. It uses GTK 4 and libadwaita (`Adw.ComboRow`), writes the `pill-metric` key, and listens for changes so the dropdown stays in sync.

The preferences window and the extension never talk to each other directly. They communicate through **GSettings**. This is why the extension listens for `changed::pill-metric`.

**Learn:** the separation between the shell process and the preferences process.

### 10. `ambient.d.ts`: type setup

Contains only imports:

```ts
import '@girs/gjs/ambient';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';
import '@girs/gjs/dom';
```

These lines bring in type definitions for GJS globals, GNOME Shell globals (such as `global`), and the DOM-like APIs GJS provides (such as `TextDecoder`). No source file imports this file. TypeScript picks it up because `tsconfig.json` includes everything in `src/`.

**Learn:** you can ignore this file in day-to-day work. Touch it only when TypeScript reports a missing global.

---

## Part 7: The build pipeline

When you run `npm run build`, this happens:

```
src/*.ts  ──esbuild──▶  dist/extension.js, dist/prefs.js
static/   ──copy────▶  dist/metadata.json, dist/stylesheet.css, dist/schemas/
schema    ──glib-compile-schemas──▶  dist/schemas/gschemas.compiled
```

1. **esbuild** bundles `src/extension.ts` and `src/prefs.ts`. Bundling merges every imported file into one output file. The `gi://*` and `resource://*` imports are left alone, because GNOME Shell supplies them at runtime.
2. **Static files** are copied into `dist/`.
3. **`glib-compile-schemas`** turns the XML schema into a binary file that GNOME Shell can read.

`npm run deploy` then runs `scripts/install.sh`, which copies `dist/` into `~/.local/share/gnome-shell/extensions/dynamic-island@damar.local/`.

**Why bundle?** GNOME Shell loads extensions as a folder of ES modules. One bundled file per entry point keeps that folder simple, and esbuild removes the TypeScript types at the same time.

**Why does `test/` import `.ts` files directly?** Recent versions of Node can run TypeScript directly. Node needs the explicit `.ts` extension, which is why the test imports end in `.ts`.

---

## Part 8: Development workflow

### Commands

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm install`       | Installs dependencies. Run once after cloning.                        |
| `npm run build`     | Builds `dist/`.                                                       |
| `npm run typecheck` | Checks types without producing output.                                |
| `npm test`          | Runs the unit tests in `test/`.                                       |
| `make deploy`       | Builds and installs into your extensions folder.                      |
| `make dev`          | Deploys, then starts a nested GNOME Shell with the extension enabled. |

### Testing safely

`make dev` starts a **nested** GNOME Shell in a window. If your code crashes it, your real session keeps running. Use it for everything you can.

GNOME Shell only scans the extensions folder when it starts. After a code change, run `make deploy` (or use `make dev`) to pick it up. A running shell will not notice.

On a real Wayland session, you must log out and back in to load a new version of the extension. On Wayland, logging out is the only way to restart the real shell.

### Enabling and inspecting

```sh
gnome-extensions list                              # show installed extensions
gnome-extensions enable dynamic-island@damar.local
gnome-extensions disable dynamic-island@damar.local
gnome-extensions prefs dynamic-island@damar.local  # open the preferences window
gnome-extensions info dynamic-island@damar.local
```

### Reading logs

Errors from extension code appear in the shell's log. In the nested shell, the output shows in the terminal that ran `make dev`. On the real session, follow it with:

```sh
journalctl -f /usr/bin/gnome-shell
```

### Looking Glass

Press `Alt+F2`, type `lg`, and press Enter. Useful tabs:

- **Evaluator**: runs JavaScript in the shell. Try `Main.panel.statusArea.dateMenu.container.opacity`.
- **Windows** and **Extensions**: show the live actor tree and loaded extensions.
- **Errors**: lists errors from extensions.

---

## Part 9: Pitfalls in this code

These are patterns you should understand before changing the code.

1. **Always clean up.** Every `connect` needs a `disconnect`. Every `timeout_add` needs a `Source.remove`. `destroy()` and `disable()` are where that happens. Forgetting one leaks memory and can cause errors after the extension is disabled.

2. **`opacity` is not `visibility`.** Hiding an actor with `visible = false` removes it from layout, and the top bar shifts. Setting `opacity = 0` keeps the space. The clock fix depends on this.

3. **`set_size(-1, -1)` means "natural size".** It clears a forced size. The Island sets a forced size to animate, and then clears it when the animation ends.

4. **The first sample is zero.** The Sampler has no baseline on its first call, so CPU and network rates are zero. The Controller calls `sample()` once in its constructor so the first real value is ready on the next tick.

5. **Resume after a pause.** When the screen unlocks, `_resume()` calls `resetBaseline()` and takes a fresh sample. Without this, the first rate would average over the whole time the screen was locked.

6. **GLib timers repeat only if you return `SOURCE_CONTINUE`.** Returning `SOURCE_REMOVE` stops them. The expand timer returns `SOURCE_REMOVE` because it fires once.

7. **Shell widgets can change.** Code that reaches into `Main.panel` or other shell internals may break in new GNOME versions. Check the `shell-version` in `metadata.json` when you upgrade.

---

## Part 10: Exercises

Try these in order. Each one teaches a different part of the codebase. Test them with `make dev`.

1. **Change the expand delay.** In `island.ts`, set `EXPAND_DELAY_MS` to `0`, then to `1000`. Notice how it feels when you pass the pointer over the Island.

2. **Change a color.** In `controller.ts`, change `CPU_COLOR` to `[1.0, 0.3, 0.3]`. Watch the CPU graph change.

3. **Change the history length.** Change `HISTORY_CAPACITY` from `60` to `30`. The graphs now show 1 minute instead of 2. Consider why the graph code needs no other changes.

4. **Explore with Looking Glass.** Open `lg` and run `Main.layoutManager.primaryMonitor` in the Evaluator. Then open the Windows tab and find the Island's actor.

5. **Add a CSS rule.** In `static/stylesheet.css`, make `.dynamic-island-time` use a different color. Run `make deploy` and reopen the nested shell to see the change.

6. **Write a test.** Add a test in `test/proc.test.ts` for a case not yet covered, such as `formatSpeed` for values in the GB range. Run `npm test`.

7. **Follow one value end to end.** Pick the network download speed. Trace it from `sampler.ts` (`netDownBps`), through `controller.ts` (`_down`, `_render`), to `island.ts` (`setRow`), and into `graph.ts` (`_repaint`). If you can explain each step, you understand the whole project.

---

## Part 11: Further reading

- **GJS guide for extensions**: https://gjs.guide/extensions/. The official beginner's tutorial.
- **GJS API reference**: https://gjs-docs.gnome.org/. Documentation for GLib, Gio, St, and Clutter.
- **GNOME Shell source**: https://gitlab.gnome.org/GNOME/gnome-shell. The best reference for `Main`, `Extension`, and the shell's internal modules. Search the source when you need to know what a shell object does.
- **Clutter and St**: the GNOME developer documentation for these two libraries explains layout and animation in more depth.

When you are stuck, the most reliable method is to read how GNOME Shell's own code does the same thing, then copy that approach.
