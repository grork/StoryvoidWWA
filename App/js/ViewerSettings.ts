module Codevoid.Storyvoid {
    export class ViewerSettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("ViewerSettings", Windows.Storage.ApplicationData.current.localSettings);
        }
    }
}