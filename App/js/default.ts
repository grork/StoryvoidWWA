module Codevoid.Storyvoid {
    export class App extends UI.AppThatCanSignIn {

        constructor() {
            super();

            var activationEvents = Utilities.addEventListeners(Windows.UI.WebUI.WebUIApplication, {
                activated: (args: Windows.UI.WebUI.WebUILaunchActivatedEventArgs) => {
                    activationEvents.cancel();
                    this.handleActivated(args);
                }
            });
        }

        private handleActivated(args: Windows.UI.WebUI.WebUILaunchActivatedEventArgs): void {
            var deferral = args.activatedOperation.getDeferral();
            Telemetry.initialize().done(() => {
                app.initialize().done(() => {
                    deferral.complete();
                });
            });
        }

        public configureTitlebar(): void {
            var applicationView = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            applicationView.setPreferredMinSize({ height: 320, width: 320 });

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