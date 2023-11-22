'use strict';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings("org.gnome.shell.extensions.improvedosk");

    const page = new Adw.PreferencesPage();

    const group = new Adw.PreferencesGroup({
      title: _('Group Title'),
    });
    page.add(group);

    const apply = Gtk.Button.new_with_label(_("Apply Changes"));
		apply.connect("clicked", () => {
			window._settings.set_int("portrait-height",
                       inputPortraitHeight.value);
      window._settings.set_int("landscape-height",
                       inputLandscapeHeight.value);
		});
		group.add(apply)
    
    window.add(page);

    const row3 = new Adw.ExpanderRow({
			title: _('Height Keyboard')
		});
		group.add(row3);

    let lH = new Adw.ActionRow({
			title: _('Landscape Height (%)')
		});
		let pH = new Adw.ActionRow({
			title: _('Portrait Height (%)')
		});


    let inputPortraitHeight = new Gtk.SpinButton();
    inputPortraitHeight.set_range(0, 100);
    inputPortraitHeight.set_increments(1, 10);
    inputPortraitHeight.value = window._settings.get_int(
      'portrait-height');
		inputPortraitHeight.valign = Gtk.Align.CENTER;
	  pH.add_suffix(inputPortraitHeight);
		pH.activatable_widget = inputPortraitHeight;

    let inputLandscapeHeight = new Gtk.SpinButton();
    inputLandscapeHeight.set_range(0, 100);
    inputLandscapeHeight.set_increments(1, 10);
    inputLandscapeHeight.value = window._settings.get_int(
      'landscape-height');
		inputLandscapeHeight.valign = Gtk.Align.CENTER;
	  lH.add_suffix(inputLandscapeHeight);
		lH.activatable_widget = inputLandscapeHeight;

    row3.add_row(pH);
		row3.add_row(lH);

  }
}
