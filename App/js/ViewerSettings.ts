module Codevoid.Storyvoid.Settings {
    function areColoursEqual(first: Windows.UI.Color, second: Windows.UI.Color): boolean {
        return (
            first.r === second.r
            && first.g === second.g
            && first.b === second.b
            && first.a === second.a
        );
    }

    export enum Theme {
        Day = 1,
        Paper = 2,
        Dusk = 3,
        Night = 4,
        MatchSystem = 100,
    }

    export enum UITheme {
        Automatic = 1,
        Light = 2,
        Dark = 3,
    }

    export enum Font {
        Arial = 1,
        Calibri = 2,
        Cambria = 3,
        Constantia = 4,
        Georgia = 5,
        SitkaText = 6,
    }

    export class ViewerSettings extends Codevoid.Utilities.SettingsCore {
        constructor() {
            super("ViewerSettings",
                Windows.Storage.ApplicationData.current.localSettings,
                {
                    currentTheme: Theme.MatchSystem,
                    currentTypeface: Font.Cambria,
                    currentFontSize: 20,
                    currentLineHeight: 1.6,
                    currentArticleWidth: 80,
                    toolbarVisible: true,
                    uiTheme: UITheme.Automatic,
                    pictureInPictureWidth: -1,
                    pictureInPictureHeight: -1,
                });
        }

        public get currentTheme(): Theme {
            return this.getValueOrDefault<Theme>("currentTheme");
        }

        public set currentTheme(value: Theme) {
            this.setValue("currentTheme", value);
        }

        public get currentTypeface(): Font {
            return this.getValueOrDefault<Font>("currentTypeface");
        }

        public set currentTypeface(value: Font) {
            this.setValue("currentTypeface", value);
        }

        public get currentFontSize(): number {
            return this.getValueOrDefault<number>("currentFontSize");
        }

        public set currentFontSize(value: number) {
            this.setValue("currentFontSize", value);
        }

        public get currentLineHeight(): number {
            return this.getValueOrDefault<number>("currentLineHeight");
        }

        public set currentLineHeight(value: number) {
            this.setValue("currentLineHeight", value);
        }

        public get currentArticleWidth(): number {
            return this.getValueOrDefault<number>("currentArticleWidth");
        }

        public set currentArticleWidth(value: number) {
            this.setValue("currentArticleWidth", value);
        }

        public get toolbarVisible(): boolean {
            return this.getValueOrDefault<boolean>("toolbarVisible");
        }

        public set toolbarVisible(value: boolean) {
            this.setValue("toolbarVisible", value);
        }

        public get pictureInPictureSize(): Windows.Foundation.Size {
            const width = this.getValueOrDefault("pictureInPictureWidth");
            const height = this.getValueOrDefault("pictureInPictureHeight");

            if (width === -1 || height === -1) {
                return null;
            }

            return { width: <any>width, height: <any>height };
        }

        public set pictureInPictureSize(size: Windows.Foundation.Size) {
            this.setValue("pictureInPictureWidth", size.width);
            this.setValue("pictureInPictureHeight", size.height);
        }

        public get uiTheme(): number {
            return this.getValueOrDefault<number>("uiTheme");
        }

        public set uiTheme(value: number) {
            this.setValue("uiTheme", value);
        }

        public getUITheme(): UITheme {
            let theme = this.uiTheme;
            if (theme != UITheme.Automatic) {
                return theme;
            }

            // Since we are set to automatic, we need to detect it
            const uiSettings = new Windows.UI.ViewManagement.UISettings();
            const backgroundColor = uiSettings.getColorValue(Windows.UI.ViewManagement.UIColorType.background);
            if (areColoursEqual(backgroundColor, Windows.UI.Colors.black)) {
                return UITheme.Dark;
            }

            return UITheme.Light;
        }

        public refreshThemeOnDOM(): void {
            document.body.classList.toggle("win-ui-dark", this.getUITheme() === Settings.UITheme.Dark);
        }

        public static getDisplayedUITheme(): Theme {
            if (document.body.classList.contains("win-ui-dark")) {
                return Theme.Night;
            }

            return Theme.Day
        }
    }
}