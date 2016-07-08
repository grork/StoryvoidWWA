module Codevoid.Storyvoid.Settings {

    export class SyncSettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("SyncSettings",
                Windows.Storage.ApplicationData.current.localSettings,
            {
                homeArticleLimit: 250,
                likedArticleLimit: 10,
                archiveArticleLimit: 10,
            });
        }

        public get homeArticleLimit(): number {
            return this.getValueOrDefault<number>("homeArticleLimit");
        }

        public set homeArticleLimit(value: number) {
            this.setValue("homeArticleLimit", value);
        }

        public get likedArticleLimit(): number {
            return this.getValueOrDefault<number>("likedArticleLimit");
        }

        public set likedArticleLimit(value: number) {
            this.setValue("likedArticleLimit", value);
        }

        public get archiveArticleLimit(): number {
            return this.getValueOrDefault<number>("archiveArticleLimit");
        }

        public set archiveArticleLimit(value: number) {
            this.setValue("archiveArticleLimit", value);
        }
    }
}