module Codevoid.Storyvoid {
    export class App extends UI.AppThatCanSignIn {
        private configureTitlebar(): void {
            var applicationView = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            applicationView.setPreferredMinSize({ height: 320, width: 320 });

            var titleBar = applicationView.titleBar;

            var primaryColour = Windows.UI.Colors.red;
            var textColour = Windows.UI.Colors.white;

            titleBar.backgroundColor = primaryColour;
            titleBar.buttonBackgroundColor = primaryColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = primaryColour;
            titleBar.buttonInactiveBackgroundColor = primaryColour;

            if (Windows.UI.ViewManagement.StatusBar) {
                var statusBar = Windows.UI.ViewManagement.StatusBar.getForCurrentView();
                statusBar.showAsync();
                statusBar.backgroundColor = Windows.UI.Colors.red;
                statusBar.backgroundOpacity = 1.0;
            }
        }

        public initialize(): void {
            super.initialize();

            this.configureTitlebar();
        }

        protected getSignedInViewModel(app: UI.IAppWithAbilityToSignIn): UI.ISignedInViewModel {
            return new UI.SignedInViewModel(app);
        }
    }

    WinJS.Utilities.ready().then(() => {
        return Telemetry.initialize();
    }).done(() => {
        var app = new App();
        app.initialize();
        Telemetry.instance.track("AppLaunched", null);
    });
}