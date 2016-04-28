module Codevoid.Storyvoid.Settings {
    export enum Theme {
        Day = 1,
        Paper = 2,
        Dusk = 3,
        Night = 4,
    }

    export enum Font {
        Arial = 1,
        Calibri = 2,
        Cambria = 3,
        Constantia = 4,
        Georgia = 5,
    }

    export class ViewerSettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("ViewerSettings", Windows.Storage.ApplicationData.current.localSettings);
        }

        public get currentTheme(): Theme {
            return this.getValueOrDefault("currentTheme", Theme.Day);
        }

        public set currentTheme(value: Theme) {
            this.setValue("currentTheme", value);
        }

        public get currentTypeface(): Font {
            return this.getValueOrDefault("currentTypeface", Font.Cambria);
        }

        public set currentTypeface(value: Font) {
            this.setValue("currentTypeface", value);
        }

        public get currentFontSize(): number {
            return this.getValueOrDefault("currentFontSize", 20);
        }

        public set currentFontSize(value: number) {
            this.setValue("currentFontSize", value);
        }

        public get currentLineHeight(): number {
            return this.getValueOrDefault("currentLineHeight", 1.6);
        }

        public set currentLineHeight(value: number) {
            this.setValue("currentLineHeight", value);
        }

        public get currentArticleWidth(): number {
            return this.getValueOrDefault("currentArticleWidth", 80);
        }

        public set currentArticleWidth(value: number) {
            this.setValue("currentArticleWidth", value);
        }
    }
}