module Codevoid.Storyvoid {
    let appInititialized = false;

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
                launchInformation = Deeplinking.extractBookmarkInformationFromUri(protocolArgs.uri);
            } else if (args.arguments) {
                // Jump lists don't pass a specific activation kind (it's just launch), so lets try parsing it as an argument
                // *WHY WINDOWS, WHY*
                let uriFromArgument: Windows.Foundation.Uri;
                try {
                    uriFromArgument = new Windows.Foundation.Uri(args.arguments);
                } catch (e) {
                    // Bad URI, assume bad actor
                }

                launchInformation = Deeplinking.extractBookmarkInformationFromUri(uriFromArgument);
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