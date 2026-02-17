# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GNOME Shell extension (`named-workspaces@a31.at`) that displays the current workspace name in the top panel. Supports inline renaming (double-click), a popup menu with workspace switching, per-workspace color styling, and global typography settings. Targets GNOME Shell 45–49.

## Build & Development

```sh
# Compile GSettings schema (required after any .gschema.xml change)
glib-compile-schemas schemas/

# Symlink into GNOME Shell extensions directory (one-time setup)
ln -s "$(pwd)" ~/.local/share/gnome-shell/extensions/named-workspaces@a31.at

# Enable the extension
gnome-extensions enable named-workspaces@a31.at

# Restart GNOME Shell to pick up code changes
# X11: Alt+F2 → r → Enter
# Wayland: log out and back in

# View extension logs
journalctl -f -o cat /usr/bin/gnome-shell
```

There is no test framework, linter, or bundler. Changes are tested by restarting GNOME Shell.

## Architecture

| File | Purpose |
|---|---|
| `extension.js` | Main extension. Contains `WorkspaceNameIndicator` (panel button with label, inline entry, and popup menu) and `WorkspaceNameExtension` (enable/disable lifecycle). |
| `prefs.js` | Preferences window using libadwaita (`Adw`) and GTK4. Configures panel position, font size, and global style. |
| `metadata.json` | Extension identity: UUID `named-workspaces@a31.at`, supported shell versions. |
| `schemas/*.gschema.xml` | GSettings schema defining persisted settings. |
| `stylesheet.css` | St (Shell Toolkit) CSS for the panel indicator and popup menu widgets. |

## Key Patterns

- **GObject ESM imports**: Uses `gi://` protocol imports (`Clutter`, `St`, `GLib`, `GObject`) and `resource:///` imports for GNOME Shell internals. No npm/node — this is pure GJS (GNOME JavaScript).
- **Settings storage**: `named-workspacess` and `workspace-styles` are string arrays (`as`) indexed by workspace number. `global-style` is a single JSON string. Styles are JSON objects with CSS property keys (e.g. `{"background-color":"#2c3e50","font-weight":"bold"}`).
- **Style layering**: `_getEffectiveStyle()` merges base font-size → global style → per-workspace style (last wins).
- **Signal management**: All GObject signal connections are tracked by ID and disconnected in `destroy()`/`_disconnectSignals()`. This pattern is required to avoid crashes on extension disable.
- **Panel button events**: `vfunc_event` overrides the default PanelMenu.Button behavior to implement single-click (menu toggle with 250ms debounce) and double-click (inline edit).
- **Preferences**: Uses `ExtensionPreferences` base class with `fillPreferencesWindow()` building Adw widgets. This is the GNOME 45+ prefs API.
