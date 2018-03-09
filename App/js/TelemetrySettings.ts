module Codevoid.Storyvoid.Settings {

    export class TelemetrySettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("TelemetrySettings",
                Windows.Storage.ApplicationData.current.localSettings,
                {
                    telemetryCollectionEnabled: true,
                    lastFolderCountSeen: 0,
                    lastHomeArticleCountSeen: 0,
                });
        }

        public get lastFolderCountSeen(): number {
            return this.getValueOrDefault<number>("lastFolderCountSeen");
        }

        public set lastFolderCountSeen(value: number) {
            this.setValue("lastFolderCountSeen", value);
        }

        public get lastHomeArticleCountSeen(): number {
            return this.getValueOrDefault<number>("lastHomeArticleCountSeen");
        }

        public set lastHomeArticleCountSeen(value: number) {
            this.setValue("lastHomeArticleCountSeen", value);
        }

        public get telemeteryCollectionEnabled(): boolean {
            return this.getValueOrDefault<boolean>("telemetryCollectionEnabled");
        }

        public set telemeteryCollectionEnabled(value: boolean) {
            this.setValue("telemetryCollectionEnabled", value);
        }
    }
}