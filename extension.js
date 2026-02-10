import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const SWATCH_COLORS = [
    '#c0392b', '#d35400', '#f39c12', '#27ae60', '#2980b9',
    '#8e44ad', '#16a085', '#ecf0f1', '#2c3e50', '#ffffff', '#000000',
];

const WorkspaceNameIndicator = GObject.registerClass(
class WorkspaceNameIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Workspace Name Indicator');

        this._settings = extension.getSettings();
        this._editing = false;
        this._boldActive = false;
        this._italicActive = false;
        this._fontSize = '';
        this._pendingClickTimeout = 0;
        this._wsItems = [];
        this._styleScope = 'workspace';

        const box = new St.BoxLayout({style_class: 'panel-status-indicators-box'});

        this._label = new St.Label({
            style_class: 'workspace-name-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);

        this._entry = new St.Entry({
            style_class: 'workspace-name-entry',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        box.add_child(this._entry);

        this.add_child(box);

        this._clutterText = this._entry.get_clutter_text();

        this._buildMenu();
        this._connectSignals();
        this._updateLabel();
    }

    vfunc_event(event) {
        if (this._editing)
            return Clutter.EVENT_PROPAGATE;

        if (event.type() === Clutter.EventType.TOUCH_BEGIN) {
            this.menu.toggle();
            return Clutter.EVENT_STOP;
        }

        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            if (this._pendingClickTimeout) {
                GLib.source_remove(this._pendingClickTimeout);
                this._pendingClickTimeout = 0;
                if (this.menu.isOpen)
                    this.menu.close();
                this._startEdit();
                return Clutter.EVENT_STOP;
            }

            this._pendingClickTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, 250, () => {
                    this._pendingClickTimeout = 0;
                    this.menu.toggle();
                    return GLib.SOURCE_REMOVE;
                });

            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _buildMenu() {
        // ===== Workspaces section =====
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Workspaces'));
        this._wsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._wsSection);

        // ===== Name section =====
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Name'));

        const nameItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._menuNameEntry = new St.Entry({
            style_class: 'wn-menu-entry',
            hint_text: 'Workspace name\u2026',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        nameItem.add_child(this._menuNameEntry);
        this.menu.addMenuItem(nameItem);

        // ===== Style section =====
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Style'));

        // --- Scope toggle ---
        const scopeItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const scopeBox = new St.BoxLayout({style_class: 'wn-btn-group'});
        this._scopeWorkspaceBtn = new St.Button({
            label: 'This Workspace',
            style_class: 'wn-btn wn-btn-active',
        });
        this._scopeGlobalBtn = new St.Button({
            label: 'All Workspaces',
            style_class: 'wn-btn',
        });
        scopeBox.add_child(this._scopeWorkspaceBtn);
        scopeBox.add_child(this._scopeGlobalBtn);
        scopeItem.add_child(scopeBox);
        this.menu.addMenuItem(scopeItem);

        // --- Background color row ---
        const bgItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        bgItem.add_child(new St.Label({
            text: 'Background',
            style_class: 'wn-menu-label',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        this._bgPreview = new St.Widget({
            style_class: 'wn-color-preview',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._bgEntry = new St.Entry({
            style_class: 'wn-menu-entry',
            hint_text: '#000000',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        bgItem.add_child(this._bgPreview);
        bgItem.add_child(this._bgEntry);
        this.menu.addMenuItem(bgItem);

        // --- Background swatches ---
        const bgSwatchItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        bgSwatchItem.add_child(this._createSwatchRow(this._bgEntry));
        this.menu.addMenuItem(bgSwatchItem);

        // --- Text color row ---
        const colorItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        colorItem.add_child(new St.Label({
            text: 'Text',
            style_class: 'wn-menu-label',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        this._colorPreview = new St.Widget({
            style_class: 'wn-color-preview',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._colorEntry = new St.Entry({
            style_class: 'wn-menu-entry',
            hint_text: '#ffffff',
            can_focus: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        colorItem.add_child(this._colorPreview);
        colorItem.add_child(this._colorEntry);
        this.menu.addMenuItem(colorItem);

        // --- Text color swatches ---
        const colorSwatchItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        colorSwatchItem.add_child(this._createSwatchRow(this._colorEntry));
        this.menu.addMenuItem(colorSwatchItem);

        // --- Bold + Italic row ---
        const toggleItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const toggleBox = new St.BoxLayout({style_class: 'wn-btn-group'});
        this._boldBtn = new St.Button({
            style_class: 'wn-btn',
            label: 'Bold',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._italicBtn = new St.Button({
            style_class: 'wn-btn',
            label: 'Italic',
            y_align: Clutter.ActorAlign.CENTER,
        });
        toggleBox.add_child(this._boldBtn);
        toggleBox.add_child(this._italicBtn);
        toggleItem.add_child(toggleBox);
        this.menu.addMenuItem(toggleItem);

        // --- Font size row ---
        const sizeItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const sizeBox = new St.BoxLayout({style_class: 'wn-btn-group'});
        this._sizeSmallBtn = new St.Button({
            label: 'Small',
            style_class: 'wn-btn',
        });
        this._sizeDefaultBtn = new St.Button({
            label: 'Default',
            style_class: 'wn-btn wn-btn-active',
        });
        this._sizeLargeBtn = new St.Button({
            label: 'Large',
            style_class: 'wn-btn',
        });
        sizeBox.add_child(this._sizeSmallBtn);
        sizeBox.add_child(this._sizeDefaultBtn);
        sizeBox.add_child(this._sizeLargeBtn);
        sizeItem.add_child(sizeBox);
        this.menu.addMenuItem(sizeItem);

        // --- Separator + Reset ---
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._resetItem = new PopupMenu.PopupMenuItem('Reset Style');
        this.menu.addMenuItem(this._resetItem);

        // ===== Position section =====
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Position'));

        const posItem = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const posBox = new St.BoxLayout({style_class: 'wn-btn-group'});
        this._posLeftBtn = new St.Button({
            label: 'Left',
            style_class: 'wn-btn',
        });
        this._posCenterBtn = new St.Button({
            label: 'Center',
            style_class: 'wn-btn',
        });
        this._posRightBtn = new St.Button({
            label: 'Right',
            style_class: 'wn-btn',
        });
        posBox.add_child(this._posLeftBtn);
        posBox.add_child(this._posCenterBtn);
        posBox.add_child(this._posRightBtn);
        posItem.add_child(posBox);
        this.menu.addMenuItem(posItem);

        // ===== Connect menu widget signals =====
        this._menuNameEntry.get_clutter_text().connect('activate', () => {
            this._saveNameFromMenu();
            this._buildWorkspaceList();
        });

        this._bgEntry.get_clutter_text().connect('text-changed', () => {
            const color = this._bgEntry.get_text().trim();
            this._bgPreview.set_style(color
                ? `background-color: ${color};`
                : 'background-color: transparent;');
            this._liveUpdateLabel();
        });

        this._colorEntry.get_clutter_text().connect('text-changed', () => {
            const color = this._colorEntry.get_text().trim();
            this._colorPreview.set_style(color
                ? `background-color: ${color};`
                : 'background-color: transparent;');
            this._liveUpdateLabel();
        });

        this._boldBtn.connect('clicked', () => {
            this._boldActive = !this._boldActive;
            if (this._boldActive)
                this._boldBtn.add_style_class_name('wn-btn-active');
            else
                this._boldBtn.remove_style_class_name('wn-btn-active');
            this._liveUpdateLabel();
        });

        this._italicBtn.connect('clicked', () => {
            this._italicActive = !this._italicActive;
            if (this._italicActive)
                this._italicBtn.add_style_class_name('wn-btn-active');
            else
                this._italicBtn.remove_style_class_name('wn-btn-active');
            this._liveUpdateLabel();
        });

        this._sizeSmallBtn.connect('clicked', () => this._setFontSize('10px'));
        this._sizeDefaultBtn.connect('clicked', () => this._setFontSize(''));
        this._sizeLargeBtn.connect('clicked', () => this._setFontSize('16px'));

        this._scopeWorkspaceBtn.connect('clicked', () => {
            if (this._styleScope === 'workspace') return;
            this._saveCurrentStyle();
            this._styleScope = 'workspace';
            this._updateScopeToggle();
            this._populateStyleFields();
        });

        this._scopeGlobalBtn.connect('clicked', () => {
            if (this._styleScope === 'global') return;
            this._saveCurrentStyle();
            this._styleScope = 'global';
            this._updateScopeToggle();
            this._populateStyleFields();
        });

        this._posLeftBtn.connect('clicked', () => this._setPanelPosition('left'));
        this._posCenterBtn.connect('clicked', () => this._setPanelPosition('center'));
        this._posRightBtn.connect('clicked', () => this._setPanelPosition('right'));

        this._resetItem.connect('activate', () => {
            if (this._styleScope === 'workspace') {
                const index = this._getMenuIndex();
                const styles = this._settings.get_strv('workspace-styles');
                if (index < styles.length) {
                    styles[index] = '';
                    this._settings.set_strv('workspace-styles', styles);
                }
            } else {
                this._settings.set_string('global-style', '');
            }

            this._bgEntry.set_text('');
            this._colorEntry.set_text('');
            this._boldActive = false;
            this._boldBtn.remove_style_class_name('wn-btn-active');
            this._italicActive = false;
            this._italicBtn.remove_style_class_name('wn-btn-active');
            this._setFontSize('');
            this._updateLabel();
        });

        this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) {
                this._buildWorkspaceList();
                this._populateMenu();
            } else {
                this._commitMenuChanges();
            }
        });
    }

    _createSwatchRow(targetEntry) {
        const row = new St.BoxLayout({style_class: 'wn-swatch-row'});

        for (const color of SWATCH_COLORS) {
            const swatch = new St.Button({style_class: 'wn-swatch'});
            swatch.set_style(`background-color: ${color};`);
            swatch.connect('clicked', () => {
                targetEntry.set_text(color);
            });
            row.add_child(swatch);
        }

        // Clear swatch
        const clearBtn = new St.Button({
            style_class: 'wn-swatch-clear',
            label: '\u2715',
        });
        clearBtn.connect('clicked', () => {
            targetEntry.set_text('');
        });
        row.add_child(clearBtn);

        return row;
    }

    _buildWorkspaceList() {
        this._wsSection.removeAll();
        this._wsItems = [];

        const wm = global.workspace_manager;
        const nWorkspaces = wm.get_n_workspaces();
        const activeIndex = wm.get_active_workspace_index();

        for (let i = 0; i < nWorkspaces; i++) {
            const item = new PopupMenu.PopupBaseMenuItem({reactive: true});
            const box = new St.BoxLayout({x_expand: true});

            const dot = new St.Widget({
                style_class: i === activeIndex ? 'wn-ws-dot' : 'wn-ws-dot-inactive',
                y_align: Clutter.ActorAlign.CENTER,
            });
            box.add_child(dot);

            const label = new St.Label({
                text: this._getWorkspaceName(i),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            if (i === activeIndex)
                label.add_style_class_name('wn-ws-item-active');
            box.add_child(label);

            item.add_child(box);

            const wsIndex = i;
            item.connect('activate', () => {
                const ws = wm.get_workspace_by_index(wsIndex);
                if (ws)
                    ws.activate(global.get_current_time());
            });

            this._wsSection.addMenuItem(item);
            this._wsItems.push(item);
        }
    }

    _setFontSize(size) {
        this._fontSize = size;
        this._sizeSmallBtn.remove_style_class_name('wn-btn-active');
        this._sizeDefaultBtn.remove_style_class_name('wn-btn-active');
        this._sizeLargeBtn.remove_style_class_name('wn-btn-active');

        if (size === '10px')
            this._sizeSmallBtn.add_style_class_name('wn-btn-active');
        else if (size === '16px')
            this._sizeLargeBtn.add_style_class_name('wn-btn-active');
        else
            this._sizeDefaultBtn.add_style_class_name('wn-btn-active');

        this._liveUpdateLabel();
    }

    _liveUpdateLabel() {
        const index = this._getMenuIndex();
        const style = this._getEffectiveStyle(index, this._styleScope, this._buildStyleFromFields());
        this._label.set_style(this._styleToCss(style) || null);
    }

    _buildStyleFromFields() {
        const style = {};
        const bg = this._bgEntry.get_text().trim();
        if (bg) style['background-color'] = bg;
        const color = this._colorEntry.get_text().trim();
        if (color) style['color'] = color;
        style['font-weight'] = this._boldActive ? 'bold' : 'normal';
        if (this._italicActive) style['font-style'] = 'italic';
        if (this._fontSize) style['font-size'] = this._fontSize;
        return style;
    }

    _populateMenu() {
        this._menuWorkspaceIndex = global.workspace_manager.get_active_workspace_index();
        this._menuNameEntry.set_text(this._getWorkspaceName(this._menuWorkspaceIndex));
        this._styleScope = 'workspace';
        this._updateScopeToggle();
        this._populateStyleFields();
        this._updatePositionToggle();
    }

    _updateScopeToggle() {
        if (this._styleScope === 'workspace') {
            this._scopeWorkspaceBtn.add_style_class_name('wn-btn-active');
            this._scopeGlobalBtn.remove_style_class_name('wn-btn-active');
        } else {
            this._scopeWorkspaceBtn.remove_style_class_name('wn-btn-active');
            this._scopeGlobalBtn.add_style_class_name('wn-btn-active');
        }
    }

    _setPanelPosition(pos) {
        this._settings.set_string('panel-position', pos);
        this._updatePositionToggle();
    }

    _updatePositionToggle() {
        const pos = this._settings.get_string('panel-position') || 'right';
        const btns = {left: this._posLeftBtn, center: this._posCenterBtn, right: this._posRightBtn};
        for (const [key, btn] of Object.entries(btns)) {
            if (key === pos)
                btn.add_style_class_name('wn-btn-active');
            else
                btn.remove_style_class_name('wn-btn-active');
        }
    }

    _populateStyleFields() {
        let style = {};
        if (this._styleScope === 'workspace') {
            const index = this._getMenuIndex();
            const styles = this._settings.get_strv('workspace-styles');
            if (index < styles.length && styles[index]) {
                try { style = JSON.parse(styles[index]); } catch (e) {}
            }
        } else {
            const globalRaw = this._settings.get_string('global-style');
            if (globalRaw) {
                try { style = JSON.parse(globalRaw); } catch (e) {}
            }
        }

        this._bgEntry.set_text(style['background-color'] || '');
        this._colorEntry.set_text(style['color'] || '');

        this._boldActive = style['font-weight'] !== 'normal';
        if (this._boldActive)
            this._boldBtn.add_style_class_name('wn-btn-active');
        else
            this._boldBtn.remove_style_class_name('wn-btn-active');

        this._italicActive = style['font-style'] === 'italic';
        if (this._italicActive)
            this._italicBtn.add_style_class_name('wn-btn-active');
        else
            this._italicBtn.remove_style_class_name('wn-btn-active');

        this._setFontSize(style['font-size'] || '');
    }

    _saveNameFromMenu() {
        const newName = this._menuNameEntry.get_text().trim();
        const index = this._getMenuIndex();
        const names = this._settings.get_strv('workspace-names');
        while (names.length <= index)
            names.push('');
        names[index] = newName;
        this._settings.set_strv('workspace-names', names);
    }

    _saveCurrentStyle() {
        const style = this._buildStyleFromFields();
        const json = Object.keys(style).length > 0 ? JSON.stringify(style) : '';

        if (this._styleScope === 'workspace') {
            const index = this._getMenuIndex();
            const styles = this._settings.get_strv('workspace-styles');
            while (styles.length <= index)
                styles.push('');
            styles[index] = json;
            this._settings.set_strv('workspace-styles', styles);
        } else {
            this._settings.set_string('global-style', json);
        }
    }

    _commitMenuChanges() {
        this._saveNameFromMenu();
        this._saveCurrentStyle();
        this._updateLabel();
    }

    _getEffectiveStyle(index, overrideScope = null, overrideStyle = null) {
        let style = {};

        // Base defaults (lowest priority)
        style['font-weight'] = 'bold';
        const baseFontSize = this._settings.get_int('font-size');
        if (baseFontSize > 0)
            style['font-size'] = `${baseFontSize}px`;

        // Global style overrides base
        if (overrideScope === 'global') {
            Object.assign(style, overrideStyle);
        } else {
            const globalRaw = this._settings.get_string('global-style');
            if (globalRaw) {
                try { Object.assign(style, JSON.parse(globalRaw)); } catch (e) {}
            }
        }

        // Per-workspace style overrides global
        if (overrideScope === 'workspace') {
            Object.assign(style, overrideStyle);
        } else {
            const styles = this._settings.get_strv('workspace-styles');
            if (index < styles.length && styles[index]) {
                try { Object.assign(style, JSON.parse(styles[index])); } catch (e) {}
            }
        }

        return style;
    }

    _styleToCss(style) {
        return Object.entries(style)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ');
    }

    _connectSignals() {
        const wm = global.workspace_manager;

        this._wsChangedId = wm.connect('active-workspace-changed', () => {
            this._cancelEdit();
            if (this.menu.isOpen) {
                this._commitMenuChanges();
                this._buildWorkspaceList();
                this._populateMenu();
            }
            this._updateLabel();
        });

        this._wsCountId = wm.connect('notify::n-workspaces', () => {
            if (this.menu.isOpen)
                this._buildWorkspaceList();
            this._updateLabel();
        });

        this._activateId = this._clutterText.connect('activate', () => {
            this._commitEdit();
        });

        this._keyPressId = this._clutterText.connect('key-press-event', (_actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this._cancelEdit();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._focusOutId = this._clutterText.connect('key-focus-out', () => {
            if (this._editing)
                this._commitEdit();
        });

        this._settingsId = this._settings.connect('changed::workspace-names', () => {
            if (!this._editing)
                this._updateLabel();
        });

        this._wsStylesId = this._settings.connect('changed::workspace-styles', () => {
            this._updateLabel();
        });

        this._globalStyleId = this._settings.connect('changed::global-style', () => {
            this._updateLabel();
        });

        this._fontSizeId = this._settings.connect('changed::font-size', () => {
            this._updateLabel();
        });
    }

    _getMenuIndex() {
        return this._menuWorkspaceIndex ?? global.workspace_manager.get_active_workspace_index();
    }

    _getWorkspaceName(index) {
        const names = this._settings.get_strv('workspace-names');
        if (index < names.length && names[index] !== '')
            return names[index];
        return `Workspace ${index + 1}`;
    }

    _updateLabel() {
        const index = global.workspace_manager.get_active_workspace_index();
        this._label.set_text(this._getWorkspaceName(index));

        const style = this._getEffectiveStyle(index);
        const css = this._styleToCss(style);
        this._label.set_style(css || null);
    }

    _startEdit() {
        if (this._editing)
            return;

        if (this.menu.isOpen)
            this.menu.close();

        this._editing = true;
        const index = global.workspace_manager.get_active_workspace_index();
        const currentName = this._getWorkspaceName(index);

        this._label.hide();
        this._entry.show();
        this._entry.set_text(currentName);
        this._entry.grab_key_focus();
        this._clutterText.set_selection(0, currentName.length);
    }

    _commitEdit() {
        if (!this._editing)
            return;

        this._editing = false;
        const newName = this._entry.get_text().trim();
        const index = global.workspace_manager.get_active_workspace_index();

        const names = this._settings.get_strv('workspace-names');
        while (names.length <= index)
            names.push('');
        names[index] = newName;
        this._settings.set_strv('workspace-names', names);

        this._entry.hide();
        this._label.show();
        this._updateLabel();
    }

    _cancelEdit() {
        if (!this._editing)
            return;

        this._editing = false;
        this._entry.hide();
        this._label.show();
    }

    _disconnectSignals() {
        const wm = global.workspace_manager;

        if (this._wsChangedId) {
            wm.disconnect(this._wsChangedId);
            this._wsChangedId = 0;
        }
        if (this._wsCountId) {
            wm.disconnect(this._wsCountId);
            this._wsCountId = 0;
        }
        if (this._activateId) {
            this._clutterText.disconnect(this._activateId);
            this._activateId = 0;
        }
        if (this._keyPressId) {
            this._clutterText.disconnect(this._keyPressId);
            this._keyPressId = 0;
        }
        if (this._focusOutId) {
            this._clutterText.disconnect(this._focusOutId);
            this._focusOutId = 0;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        if (this._wsStylesId) {
            this._settings.disconnect(this._wsStylesId);
            this._wsStylesId = 0;
        }
        if (this._globalStyleId) {
            this._settings.disconnect(this._globalStyleId);
            this._globalStyleId = 0;
        }
        if (this._fontSizeId) {
            this._settings.disconnect(this._fontSizeId);
            this._fontSizeId = 0;
        }
    }

    destroy() {
        if (this._pendingClickTimeout) {
            GLib.source_remove(this._pendingClickTimeout);
            this._pendingClickTimeout = 0;
        }
        this._disconnectSignals();
        super.destroy();
    }
});

export default class WorkspaceNameExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        const pos = this._settings.get_string('panel-position') || 'right';

        this._indicator = new WorkspaceNameIndicator(this);
        const index = pos === 'left' ? -1 : 0;
        Main.panel.addToStatusArea(this.uuid, this._indicator, index, pos);

        this._positionChangedId = this._settings.connect('changed::panel-position', () => {
            this._repositionIndicator();
        });
    }

    _repositionIndicator() {
        if (!this._indicator)
            return;

        const pos = this._settings.get_string('panel-position') || 'right';
        const boxes = {
            left: Main.panel._leftBox,
            center: Main.panel._centerBox,
            right: Main.panel._rightBox,
        };
        const targetBox = boxes[pos] || boxes.right;
        const container = this._indicator.container;
        const currentParent = container.get_parent();

        if (currentParent === targetBox)
            return;

        if (currentParent)
            currentParent.remove_child(container);
        if (pos === 'left')
            targetBox.add_child(container);
        else
            targetBox.insert_child_at_index(container, 0);
    }

    disable() {
        if (this._positionChangedId) {
            this._settings.disconnect(this._positionChangedId);
            this._positionChangedId = 0;
        }
        this._settings = null;
        this._indicator?.destroy();
        this._indicator = null;
    }
}
