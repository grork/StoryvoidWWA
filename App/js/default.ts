module Codevoid.ArticleVoid {
    export class App {
        private _loginEvents: Codevoid.Utilities.ICancellable;
        private _clearCredsEvents: Codevoid.Utilities.ICancellable;
        private _isSignedIn: boolean = false;

        constructor() {
        }

        public initialize(): void {
            var loginButton = <HTMLElement>document.querySelector("[data-cv-id=loginButton]");
            this._loginEvents = Codevoid.Utilities.addEventListeners(loginButton, {
                click: () => {
                    Codevoid.ArticleVoid.UI.Authenticator.showAuthenticator().done((result: Codevoid.OAuth.ClientInformation) => {
                        loginButton.innerText = "Logged In";
                    }, () => {
                        loginButton.innerText = "Failed";
                    });
                },
            });

            var clearCredsButton = document.querySelector("[data-cv-id=clearCredentials]");
            this._clearCredsEvents = Codevoid.Utilities.addEventListeners(clearCredsButton, {
                click: () => {
                    Codevoid.ArticleVoid.Authenticator.clearClientInformation();
                }
            });

            if (Codevoid.ArticleVoid.Authenticator.hasStoredCredentials()) {
                loginButton.innerText = "Already Authed!"
            }
        }

        public get isSignedIn(): boolean {
            return this._isSignedIn;
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = (<any>window).__appObject = new App();
        app.initialize();
    });
}