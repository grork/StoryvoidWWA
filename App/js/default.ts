module Codevoid.Storyvoid {
    let appInititialized = false;

    function extractLaunchInformationFromUri(uri: Windows.Foundation.Uri): UI.IAppLaunchInformation {
        const result: UI.IAppLaunchInformation = {
            bookmark_id: 0,
            originalUrl: null,
        };

        let rawBookmarkId: string;
        let rawOriginalUrl: string;

        // Theres no way on the queryParsed object to easily
        // see if there is a key present, so just loop through
        // them all and pull out the ones we're going to do
        // something with.
        uri.queryParsed.forEach((entry) => {
            switch (entry.name) {
                case "bookmark_id":
                    rawBookmarkId = entry.value;
                    break;

                case "original_url":
                    rawOriginalUrl = entry.value;
                    break;
            }
        });

        const bookmarkId = parseInt(rawBookmarkId, 10);
        if (!isNaN(bookmarkId)) {
            result.bookmark_id = bookmarkId;
        }
        
        try {
            const originalUrl = new Windows.Foundation.Uri(rawOriginalUrl);
            result.originalUrl = originalUrl;
        } catch { }

        return result;
    }

    export class App extends UI.AppThatCanSignIn {

        constructor() {
            super();

            Utilities.addEventListeners(Windows.UI.WebUI.WebUIApplication, {
                activated: (args: Windows.UI.WebUI.WebUILaunchActivatedEventArgs) => {
                    this.handleActivated(args);
                }
            });
        }

        private handleActivated(args: Windows.UI.WebUI.WebUILaunchActivatedEventArgs): void {
            let launchInformation: UI.IAppLaunchInformation;
            if (args.kind === Windows.ApplicationModel.Activation.ActivationKind.protocol) {
                const protocolArgs = <Windows.UI.WebUI.WebUIProtocolActivatedEventArgs>(<any>args);
                launchInformation = extractLaunchInformationFromUri(protocolArgs.uri)
            }

            if (!appInititialized) {
                appInititialized = true;
                app.launchInformation = launchInformation;
                var deferral = args.activatedOperation.getDeferral();
                Telemetry.initialize().done(() => {
                    app.initialize().done(() => {
                        deferral.complete();
                    });
                });
            } else {
                app.processLaunchInformation(launchInformation);
            }
        }

        public configureTitlebar(): void {
            var applicationView = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            applicationView.setPreferredMinSize({ height: 320, width: 400 });

            var titleBar = applicationView.titleBar;

            var primaryColour = Windows.UI.Colors.transparent;
            var textColour = Windows.UI.Colors.white;

            titleBar.backgroundColor = primaryColour;
            titleBar.buttonBackgroundColor = primaryColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = primaryColour;
            titleBar.buttonInactiveBackgroundColor = primaryColour;

            titleBar.buttonHoverBackgroundColor = Windows.UI.Colors.red;
            titleBar.buttonHoverForegroundColor = textColour;

            if (Windows.UI.ViewManagement.StatusBar) {
                var statusBar = Windows.UI.ViewManagement.StatusBar.getForCurrentView();
                statusBar.showAsync();
                statusBar.backgroundColor = Windows.UI.Colors.red;
                statusBar.backgroundOpacity = 1.0;
            }

            Codevoid.Utilities.HiddenApiHelper.extendIntoTitleBar();
        }

        public initialize(): WinJS.Promise<void> {
            const baseInit = super.initialize();
            Telemetry.trackAppLaunched("tile");

            return baseInit;
        }

        protected getSignedInViewModel(app: UI.IAppWithAbilityToSignIn): UI.ISignedInViewModel {
            return new UI.SignedInViewModel(app);
        }
    }

    var app = new App();
    app.configureTitlebar();
}