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
            this._init();
        }

        private async _init(): Promise<void> {
            WinJS.Utilities.addClass(this.element, "signedOut-container");

            const template = await DOM.loadTemplate("/HtmlTemplates.html", "signedOut");
            await template.render(null, this.element);

            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.SignedOutExperience");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._authenticatorControl = new Codevoid.Storyvoid.UI.Authenticator(this._authenticatorContainer, {
                viewModel: this.viewModel.authenticator,
            });

            this._handlersToCleanup.push(Utilities.addEventListeners(this._authenticatorContainer, {
                readytoauthenticate: () => {
                    Windows.UI.ViewManagement.InputPane.getForCurrentView().tryHide();
                    this.viewModel.startLogin();
                }
            }));
        }

        public async startLogin(): Promise<void> {
            try {
                await this.viewModel.startLogin();
            } catch(e) {
                this._loginButton.innerText = "Failed";
            }
        }
    }

    export class SignedOutViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SignedOutExperience" };
        public authenticator = new Codevoid.Storyvoid.Authenticator.AuthenticatorViewModel();
        constructor(private _app: IAppWithAbilityToSignIn) {
            this.authenticator.holdWorkingStateOnSuccess = true;
        }

        public async startLogin(): Promise<void> {
            const tokenDetails = await this.authenticator.authenticate(500);
            const clientInfo = Codevoid.Storyvoid.Authenticator.saveAccessToken(tokenDetails);
            this._app.signedIn(clientInfo, false/*usingSavedCredentials*/);
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience.prototype.startLogin);
}