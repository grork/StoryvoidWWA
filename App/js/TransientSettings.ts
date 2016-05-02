module Codevoid.Storyvoid.Settings {
    export class TransientSettings extends Utilities.SettingsCore {
        constructor() {
            super("TransientSettiings",
                Windows.Storage.ApplicationData.current.localSettings,
                {
                    lastViewedArticleId: -1,
                });
        }

        public get lastViewedArticleId(): number {
            return this.getValueOrDefault<number>("lastViewedArticleId");
        }

        public set lastViewedArticleId(value: number) {
            this.setValue("lastViewedArticleId", value);
        }

        public clearLastViewedArticleId(): void {
            this.clearValue("lastViewedArticleId");
        }
    }
}