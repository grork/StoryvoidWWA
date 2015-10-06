module Codevoid.ArticleVoid {
    export class App {
        private _loginEvents: Codevoid.Utilities.ICancellable;
        constructor() {
        }

        public initialize(): void {
            var loginButton = document.querySelector("[data-cv-id=loginButton]");
            this._loginEvents = Codevoid.Utilities.addEventListeners(loginButton, {
                click: () => {
                    Codevoid.ArticleVoid.UI.Authenticator.showAuthenticator();
                },
            });
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = (<any>window).__appObject = new App();
        app.initialize();
    });
}