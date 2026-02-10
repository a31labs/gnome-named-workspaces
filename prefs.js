import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WorkspaceNamePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Settings',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        this._buildPanelGroup(page, settings);
        this._buildGlobalStyleGroup(page, settings);
    }

    _buildPanelGroup(page, settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Panel',
        });
        page.add(group);

        // Position
        const posValues = ['left', 'center', 'right'];
        const posModel = new Gtk.StringList();
        posModel.append('Left');
        posModel.append('Center');
        posModel.append('Right');

        const posRow = new Adw.ComboRow({
            title: 'Position',
            subtitle: 'Where to place the indicator in the panel',
            model: posModel,
        });
        posRow.set_selected(Math.max(0, posValues.indexOf(settings.get_string('panel-position'))));
        posRow.connect('notify::selected', () => {
            settings.set_string('panel-position', posValues[posRow.get_selected()]);
        });
        group.add(posRow);

        // Font Size
        const fontAdj = new Gtk.Adjustment({
            lower: 0,
            upper: 48,
            step_increment: 1,
            page_increment: 4,
        });
        const fontRow = new Adw.SpinRow({
            title: 'Font Size',
            subtitle: '0 uses the default shell font size',
            adjustment: fontAdj,
            value: settings.get_int('font-size'),
        });
        fontRow.connect('notify::value', () => {
            settings.set_int('font-size', Math.round(fontRow.value));
        });
        group.add(fontRow);
    }

    _buildGlobalStyleGroup(page, settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Global Style',
            description: 'Applied to all workspaces unless overridden',
        });
        page.add(group);

        let globalStyle = {};
        const raw = settings.get_string('global-style');
        if (raw) {
            try { globalStyle = JSON.parse(raw); } catch (e) {}
        }

        const saveStyle = () => {
            const cleaned = {};
            for (const [k, v] of Object.entries(globalStyle)) {
                if (v) cleaned[k] = v;
            }
            settings.set_string('global-style',
                Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : '');
        };

        // Background Color
        const bgEntry = new Gtk.Entry({
            text: globalStyle['background-color'] || '',
            placeholder_text: '#000000',
            valign: Gtk.Align.CENTER,
            width_chars: 10,
        });
        bgEntry.connect('changed', () => {
            const val = bgEntry.get_text().trim();
            if (val)
                globalStyle['background-color'] = val;
            else
                delete globalStyle['background-color'];
            saveStyle();
        });
        const bgRow = new Adw.ActionRow({
            title: 'Background Color',
            subtitle: 'Hex color, e.g. #2c3e50',
        });
        bgRow.add_suffix(bgEntry);
        group.add(bgRow);

        // Text Color
        const colorEntry = new Gtk.Entry({
            text: globalStyle['color'] || '',
            placeholder_text: '#ffffff',
            valign: Gtk.Align.CENTER,
            width_chars: 10,
        });
        colorEntry.connect('changed', () => {
            const val = colorEntry.get_text().trim();
            if (val)
                globalStyle['color'] = val;
            else
                delete globalStyle['color'];
            saveStyle();
        });
        const colorRow = new Adw.ActionRow({
            title: 'Text Color',
            subtitle: 'Hex color, e.g. #ffffff',
        });
        colorRow.add_suffix(colorEntry);
        group.add(colorRow);

        // Bold
        const boldRow = new Adw.SwitchRow({
            title: 'Bold',
            active: globalStyle['font-weight'] === 'bold',
        });
        boldRow.connect('notify::active', () => {
            if (boldRow.active)
                globalStyle['font-weight'] = 'bold';
            else
                delete globalStyle['font-weight'];
            saveStyle();
        });
        group.add(boldRow);

        // Italic
        const italicRow = new Adw.SwitchRow({
            title: 'Italic',
            active: globalStyle['font-style'] === 'italic',
        });
        italicRow.connect('notify::active', () => {
            if (italicRow.active)
                globalStyle['font-style'] = 'italic';
            else
                delete globalStyle['font-style'];
            saveStyle();
        });
        group.add(italicRow);
    }
}
