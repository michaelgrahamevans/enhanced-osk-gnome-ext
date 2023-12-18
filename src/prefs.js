'use strict';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings("org.gnome.shell.extensions.enhancedosk");

    const page = new Adw.PreferencesPage();

    const group = new Adw.PreferencesGroup({
      title: _('Preferences'),
    });
    page.add(group);

    const apply = Gtk.Button.new_with_label(_("Apply Changes"));
		apply.connect("clicked", () => {
			window._settings.set_int("portrait-height",
                       inputPortraitHeight.value);
      window._settings.set_int("landscape-height",
                               inputLandscapeHeight.value);
      window._settings.set_boolean("show-statusbar-icon",
                                   indicatorEnabled.active);
      window._settings.set_boolean("ignore-touch-input",
                                   ignoreTouch.active);
      window._settings.set_boolean("force-touch-input",
                                   forceTouch.active);
      window._settings.set_boolean("show-suggestions",
                                   showSuggestions.active);

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

    const row_ind = new Adw.ActionRow({
			title: _('Show Panel Indicator')
		});
		group.add(row_ind);

    const indicatorEnabled = new Gtk.Switch({
			active: window._settings.get_boolean("show-statusbar-icon"),
			valign: Gtk.Align.CENTER,
		});

		row_ind.add_suffix(indicatorEnabled);
		row_ind.activatable_widget = indicatorEnabled;

    const row_igtouch = new Adw.ActionRow({
			title: _('Ignore touch input')
		});
		group.add(row_igtouch);

    const ignoreTouch = new Gtk.Switch({
			active: window._settings.get_boolean("ignore-touch-input"),
			valign: Gtk.Align.CENTER,
		});

		row_igtouch.add_suffix(ignoreTouch);
		row_igtouch.activatable_widget = ignoreTouch;

    const row_forcetouch = new Adw.ActionRow({
			title: _('Force touch input')
		});
		group.add(row_forcetouch);

    const forceTouch = new Gtk.Switch({
			active: window._settings.get_boolean("force-touch-input"),
			valign: Gtk.Align.CENTER,
		});

		row_forcetouch.add_suffix(forceTouch);
		row_forcetouch.activatable_widget = forceTouch;

    const row_showSuggestions = new Adw.ActionRow({
			title: _('Show Suggestion bar')
		});
		group.add(row_showSuggestions);

    const showSuggestions = new Gtk.Switch({
			active: window._settings.get_boolean("show-suggestions"),
			valign: Gtk.Align.CENTER,
		});

		row_showSuggestions.add_suffix(showSuggestions);
		row_showSuggestions.activatable_widget = showSuggestions;
  }
}
