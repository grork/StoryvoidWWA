module Codevoid.ArticleVoid {
    export class App extends UI.AppThatCanSignIn {
        private configureTitlebar(): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            var primaryColour = Windows.UI.Colors.red;
            var textColour = Windows.UI.Colors.white;

            titleBar.backgroundColor = primaryColour;
            titleBar.buttonBackgroundColor = primaryColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = primaryColour;
            titleBar.buttonInactiveBackgroundColor = primaryColour;
        }

        public initialize(): void {
            super.initialize();

            this.configureTitlebar();
        }

        protected getSignedInViewModel(app: UI.IAppWithAbilityToSignIn): UI.ISignedInViewModel {
            return new UI.SignedInViewModel(app);
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = new App();
        app.initialize();
    });
}