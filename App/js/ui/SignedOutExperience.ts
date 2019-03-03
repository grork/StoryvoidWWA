module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    export class SignedOutExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _loginButton: HTMLElement;
        private _authenticatorContainer: HTMLDivElement;
        private _authenticatorControl: Codevoid.Storyvoid.UI.Authenticator;
        private viewModel: SignedOutViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            WinJS.Utilities.addClass(element, "signedOut-container");
            DOM.loadTemplate("/HtmlTemplates.html", "signedOut").then((template) => {
                return template.render(null, element);
            }).then(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this._authenticatorControl = new Codevoid.Storyvoid.UI.Authenticator(this._authenticatorContainer, {
                    viewModel: this.viewModel.authenticator,
                });

                this._handlersToCleanup.push(Utilities.addEventListeners(this._authenticatorContainer, {
                    readytoauthenticate: () => {
                        Windows.UI.ViewManagement.InputPane.getForCurrentView().tryHide();
                        this.viewModel.startLogin();
                    }
                }));
            });
        }

        public startLogin(): void {
            this.viewModel.startLogin().then(null, () => {
                this._loginButton.innerText = "Failed";
            });
        }
    }

    export class SignedOutViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SignedOutExperience" };
        public authenticator = new Codevoid.Storyvoid.Authenticator.AuthenticatorViewModel();
        constructor(private _app: IAppWithAbilityToSignIn) {
            this.authenticator.holdWorkingStateOnSuccess = true;
        }

        public startLogin(): WinJS.Promise<void> {
            return this.authenticator.authenticate(500).then((tokenDetails: InstapaperApi.IAccessTokenInformation) => {
                var clientInfo = Codevoid.Storyvoid.Authenticator.saveAccessToken(tokenDetails);
                this._app.signedIn(clientInfo, false/*usingSavedCredentials*/);
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience.prototype.startLogin);
}