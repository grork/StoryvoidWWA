module Codevoid.Storyvoid.Settings {
    export class PermanentSettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("PermanentSettings", Windows.Storage.ApplicationData.current.localSettings, {
                whatsNewShownForRelease: "",
            });
        }

        public get whatsNewShownForRelease(): string {
            return this.getValueOrDefault<string>("whatsNewShownForRelease");
        }

        public set whatsNewShownForRelease(value: string) {
            this.setValue("whatsNewShownForRelease", value);
        }
    }
}