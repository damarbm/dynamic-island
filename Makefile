UUID := dynamic-island@damar.local

.PHONY: dev run deploy watch

# Build, install, then open a fresh nested GNOME Shell with the extension enabled.
dev: deploy run

# Open a nested GNOME Shell and enable the extension in it. A shell only scans
# the extensions folder when it starts, so run `make deploy` first after changes.
run:
	dbus-run-session -- bash -c 'gnome-shell --devkit --wayland & sleep 6; gnome-extensions enable $(UUID); wait'

# Build and copy the extension into ~/.local/share/gnome-shell/extensions.
deploy:
	npm run deploy

# Rebuild and restart the nested GNOME Shell whenever src/ or static/ changes.
# Only the nested shell is restarted, never your real session.
watch:
	node scripts/watch.mjs
