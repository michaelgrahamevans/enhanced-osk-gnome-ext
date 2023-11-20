//import { Gio, GLib, St, Clutter, GObject } from 'gi://';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/keyboard.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Me from './extension.js';

const A11Y_APPLICATIONS_SCHEMA = "org.gnome.desktop.a11y.applications";
const KEY_RELEASE_TIMEOUT = 100;


//check how to get metadata

let extensionObject, extensionSettings;
let _oskA11yApplicationsSettings;
let backup_lastDeviceIsTouchScreen;
let backup_relayout;
let backup_touchMode;
let currentSeat;
let _indicator;
let settings;
let keyReleaseTimeoutId;

function isInUnlockDialogMode() {
  return Main.sessionMode.currentMode === 'unlock-dialog';
}

// Indicator
let OSKIndicator = GObject.registerClass(
  { GTypeName: "OSKIndicator" },
  class OSKIndicator extends PanelMenu.Button {
    _init() {
        //super._init(0.0, `${Me.metadata.name} Indicator`, false);
        super._init(0.0, `Nometadata Indicator`, false);

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

        // Don't open extension prefs if in unlock-dialog session mode
          if (button == 3 && !isInUnlockDialogMode()) {
              extensionObject = Extension.lookupByUUID('improvedosk@nick-shmyrev.dev');
              extensionSettings = extensionObject.openPreferences();
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
  if (Main.keyboard._keyboard._keyboardVisible) return Main.keyboard.close();

  Main.keyboard.open(Main.layoutManager.bottomIndex);
}

function override_getCurrentGroup() {
  // Special case for Korean, if Hangul mode is disabled, use the 'us' keymap
  if (this._currentSource.id === 'hangul') {
      const inputSourceManager = InputSourceManager.getInputSourceManager();
      const currentSource = inputSourceManager.currentSource;
      let prop;
      for (let i = 0; (prop = currentSource.properties.get(i)) !== null; ++i) {
          if (prop.get_key() === 'InputMode' &&
              prop.get_prop_type() === IBus.PropType.TOGGLE &&
              prop.get_state() !== IBus.PropState.CHECKED)
              return 'us';
      }
  }
  return this._currentSource.xkbId;
}


// Extension
export default class thisdoesmatternot extends Extension {
    constructor(metadata) {
        super(metadata);
        this._injectionManager = new InjectionManager();
    }
init() {
  settings = this.getSettings(
    "org.gnome.shell.extensions.improvedosk"
  );
  backup_relayout = Keyboard.Keyboard.prototype["_relayout"];

  backup_lastDeviceIsTouchScreen =
    Keyboard.KeyboardManager._lastDeviceIsTouchscreen;

  currentSeat = Clutter.get_default_backend().get_default_seat();
  backup_touchMode = currentSeat.get_touch_mode;
}

enable() {
  this.init()
  _oskA11yApplicationsSettings = new Gio.Settings({
    schema_id: A11Y_APPLICATIONS_SCHEMA,
  });

  Main.layoutManager.removeChrome(Main.layoutManager.keyboardBox);

  // Set up the indicator in the status area
  if (settings.get_boolean("show-statusbar-icon")) {
    _indicator = new OSKIndicator();
    Main.panel.addToStatusArea("OSKIndicator", _indicator);
  }

  if (settings.get_boolean("force-touch-input")) {
    currentSeat.get_touch_mode = () => true;
  }

  let KeyboardIsSetup = this.tryDestroyKeyboard();

  this.enable_overrides();

  settings.connect("changed::show-statusbar-icon", function () {
    if (settings.get_boolean("show-statusbar-icon")) {
      _indicator = new OSKIndicator();
      Main.panel.addToStatusArea("OSKIndicator", _indicator);
    } else if (_indicator !== null) {
      _indicator.destroy();
      _indicator = null;
    }
  });

  settings.connect("changed::force-touch-input", function () {
    if (settings.get_boolean("force-touch-input")) {
      currentSeat.get_touch_mode = () => true;
    } else {
      currentSeat.get_touch_mode = backup_touchMode;
    }
  });

  if (KeyboardIsSetup) {
    Main.keyboard._syncEnabled();
    Main.keyboard._keyboard._updateKeys(); //for testing
  }

  Main.layoutManager.addTopChrome(Main.layoutManager.keyboardBox, {
    affectsStruts: settings.get_boolean("resize-desktop"),
    trackFullscreen: false,
  });
}

disable() {
  Main.layoutManager.removeChrome(Main.layoutManager.keyboardBox);

  currentSeat.get_touch_mode = backup_touchMode;

  let KeyboardIsSetup = this.tryDestroyKeyboard();

  // Remove indicator if it exists
  if (_indicator instanceof OSKIndicator) {
    _indicator.destroy();
    _indicator = null;
  }

  settings = null;

  if (keyReleaseTimeoutId) {
    GLib.Source.remove(keyReleaseTimeoutId);
    keyReleaseTimeoutId = null;
  }

  this.disable_overrides();

  if (KeyboardIsSetup) {
    Main.keyboard._setupKeyboard();
  }
  Main.layoutManager.addTopChrome(Main.layoutManager.keyboardBox);
}
    
getModifiedLayouts() {
  const modifiedLayoutsPath = this.dir
    .get_child("data")
    .get_child("gnome-shell-osk-layouts.gresource")
    .get_path();
  return Gio.Resource.load(modifiedLayoutsPath);
 }

    // Overrides
override_lastDeviceIsTouchScreen() {
  if (!this._lastDevice) return false;

    let deviceType = this._lastDevice.get_device_type();
  return settings.get_boolean("ignore-touch-input")
    ? false
    : deviceType == Clutter.InputDeviceType.TOUCHSCREEN_DEVICE;
}

override_relayout() {
  let monitor = Main.layoutManager.keyboardMonitor;

  if (!monitor) return;

    this.width = monitor.width;

  if (monitor.width > monitor.height) {
    this.height = (monitor.height * settings.get_int("landscape-height")) / 100;
  } else {
    this.height = (monitor.height * settings.get_int("portrait-height")) / 100;
  }
}

  enable_overrides() {
    Keyboard.Keyboard.prototype["_relayout"] = this.override_relayout;
    Keyboard.KeyboardManager.prototype["_lastDeviceIsTouchscreen"] =
      this.override_lastDeviceIsTouchScreen;
    this._injectionManager.overrideMethod(
      Keyboard.Keyboard.prototype, '_init',
      originalMethod => {
        return function (...args) {
          originalMethod.call(this, ...args);
          this._keyboardController.getCurrentGroup = override_getCurrentGroup;
        }
      });

  // Unregister original osk layouts resource file
  this.getDefaultLayouts()._unregister();

  // Register modified osk layouts resource file
  this.getModifiedLayouts()._register();
}

  disable_overrides() {
    this._injectionManager.clear();
    Keyboard.Keyboard.prototype["_relayout"] = backup_relayout;
    Keyboard.KeyboardManager.prototype["_lastDeviceIsTouchscreen"] =
      backup_lastDeviceIsTouchScreen;

    // Unregister modified osk layouts resource file
    this.getModifiedLayouts()._unregister();
    
    // Register original osk layouts resource file
    this.getDefaultLayouts()._register();
}


getDefaultLayouts() {
  return Gio.Resource.load(
    (GLib.getenv("JHBUILD_PREFIX") || "/usr") +
      "/share/gnome-shell/gnome-shell-osk-layouts.gresource"
  );
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
