import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/keyboard.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const A11Y_APPLICATIONS_SCHEMA = "org.gnome.desktop.a11y.applications";
const KEY_RELEASE_TIMEOUT = 100;


//check how to get metadata

let settings;
let keyReleaseTimeoutId;

// Indicator
let OSKIndicator = GObject.registerClass(
  { GTypeName: "OSKIndicator" },
  class OSKIndicator extends PanelMenu.Button {
    _init(ref_this) {
      super._init(0.0, `${ref_this.metadata.name} Indicator`, false);

      let icon = new St.Icon({
        icon_name: "input-keyboard-symbolic",
        style_class: "system-status-icon",
      });

      this.add_child(icon);

      this.connect("button-press-event", function (_actor, event) {
        let button = event.get_button();

        if (button == 1) {
          toggleOSK();
        }

        if (button == 3) {
          ref_this.openPreferences();
        }
      });

      this.connect("touch-event", function () {
        toggleOSK();
      });
    }
  }
);

function toggleOSK() {
  //Main.keyboard._keyboard._keyboardController.destroy();
  //Main.keyboard._keyboard._setupKeyboard();
  if (Main.keyboard._keyboard !== null ){
    if (Main.keyboard._keyboard._keyboardVisible) return Main.keyboard.close();
    Main.keyboard.open(Main.layoutManager.bottomIndex);
  }
}

// Extension
export default class enhancedosk extends Extension {
  constructor(metadata) {
    super(metadata);
  }

  enable() {
    this._injectionManager = new InjectionManager();

    settings = this.getSettings(
      "org.gnome.shell.extensions.enhancedosk"
    );
    this.currentSeat = Clutter.get_default_backend().get_default_seat();
    this.backup_touchMode = this.currentSeat.get_touch_mode;

    this._oskA11yApplicationsSettings = new Gio.Settings({
      schema_id: A11Y_APPLICATIONS_SCHEMA,
    });

    Main.layoutManager.removeChrome(Main.layoutManager.keyboardBox);

    // Set up the indicator in the status area
    if (settings.get_boolean("show-statusbar-icon")) {
      this._indicator = new OSKIndicator(this);
      Main.panel.addToStatusArea("OSKIndicator", this._indicator);
    }

    if (settings.get_boolean("force-touch-input")) {
      this.currentSeat.get_touch_mode = () => true;
    }

    this.tryDestroyKeyboard();

    this.enable_overrides();

    settings.connect("changed::show-statusbar-icon", () => {
      if (settings.get_boolean("show-statusbar-icon")) {
        this._indicator = new OSKIndicator(this);
        Main.panel.addToStatusArea("OSKIndicator", this._indicator);
      } else if (this._indicator !== null) {
        this._indicator.destroy();
        this._indicator = null;
      }
    });

    settings.connect("changed::force-touch-input", () => {
      if (settings.get_boolean("force-touch-input")) {
        this.currentSeat.get_touch_mode = () => true;
      } else {
        this.currentSeat.get_touch_mode = this.backup_touchMode;
      }
    });

    Main.keyboard._syncEnabled();
    Main.keyboard._bottomDragAction.enabled = true;

    Main.layoutManager.addTopChrome(Main.layoutManager.keyboardBox, {
      affectsStruts: settings.get_boolean("resize-desktop"),
      trackFullscreen: false,
    });
  }

  disable() {
    Main.layoutManager.removeChrome(Main.layoutManager.keyboardBox);

    this.currentSeat.get_touch_mode = this.backup_touchMode;

    this.tryDestroyKeyboard();

    // Remove indicator if it exists
    if (this._indicator instanceof OSKIndicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    settings = null;
    this._oskA11yApplicationsSettings = null;
    this.currentSeat = null;

    if (keyReleaseTimeoutId) {
      GLib.Source.remove(keyReleaseTimeoutId);
      keyReleaseTimeoutId = null;
    }

    this.disable_overrides();

    Main.keyboard._syncEnabled();
    Main.keyboard._bottomDragAction.enabled = true;

    Main.layoutManager.addTopChrome(Main.layoutManager.keyboardBox);
  }

  getModifiedLayouts() {
    if (!this._modifiedLayouts) {
      const modifiedLayoutsPath = this.dir
            .get_child("data")
            .get_child("gnome-shell-osk-layouts.gresource")
            .get_path();
      this._modifiedLayouts = Gio.Resource.load(modifiedLayoutsPath);
    }
    return this._modifiedLayouts;
  }

  enable_overrides() {
    // Override _relayout so that the keyboard height and suggestions can be modified by the extension settings
    this._injectionManager.overrideMethod(
      Keyboard.Keyboard.prototype, '_relayout',
      originalMethod => {
        return function (...args) {
          let monitor = Main.layoutManager.keyboardMonitor;
          if (!monitor) return;
          this.width = monitor.width;
          if (monitor.width > monitor.height) {
            this.height = (monitor.height *
                           settings.get_int("landscape-height")) / 100;
          } else {
            this.height = (monitor.height *
                           settings.get_int("portrait-height")) / 100;
          }

          if (settings.get_boolean("show-suggestions")) {
            this._suggestions?.show();
          } else {
            this._suggestions?.hide();
          }
        }
      });

    // Override _lastDeviceIsTouchscreen so that touch inputs can be ignored through an extension setting
    this._injectionManager.overrideMethod(
      Keyboard.KeyboardManager.prototype, '_lastDeviceIsTouchscreen',
      originalMethod => {
        return function (...args) {
          let out = originalMethod.call(this, ...args);
          return settings.get_boolean("ignore-touch-input") ? false : out;
        }
      });

    this._injectionManager.overrideMethod(
      Keyboard.Keyboard.prototype, '_setupKeyboard',
      originalMethod => {
        return function (...args) {
          originalMethod.call(this, ...args);
          //track active level
          this._activeLevel = 'default';
        }
      });

    // Override _setActiveLevel so that the active level can be tracked
    this._injectionManager.overrideMethod(
      Keyboard.Keyboard.prototype, '_setActiveLevel',
      originalMethod => {
        return function (activeLevel) {
          originalMethod.call(this, activeLevel);
          //track the active level
          this._activeLevel = activeLevel;
        }
      });

    // Override toggleDelete to simplify it's logic so that it does not skip over characters
    this._injectionManager.overrideMethod(
      Keyboard.Keyboard.prototype, 'toggleDelete',
      originalMethod => {
        return function (enabled) {
          if (this._deleteEnabled === enabled) return;

          this._deleteEnabled = enabled;

          if (enabled) {
            this._keyboardController.keyvalPress(Clutter.KEY_BackSpace);
          } else {
            this._keyboardController.keyvalRelease(Clutter.KEY_BackSpace);
          }
        }
      });

    // Register modified osk layouts resource file
    this.getModifiedLayouts()._register();
  }

  disable_overrides() {
    this._injectionManager.clear();
    this._injectionManager = null;

    // Unregister modified osk layouts resource file
    this.getModifiedLayouts()._unregister();
  }

  // In case the keyboard is currently disabled in accessibility settings, attempting to _destroyKeyboard() yields a TypeError ("TypeError: this.actor is null")
  // This function proofs this condition, which would be used in the parent function to determine whether to run _setupKeyboard
  tryDestroyKeyboard() {
    try {
      Main.keyboard._keyboard.destroy();
      Main.keyboard._keyboard = null;
    } catch (e) {
      if (e instanceof TypeError) {
        return false;
        //throw e;
      } else {
        // Something different happened
        throw e;
      }
    }
    return true;
  }
}
