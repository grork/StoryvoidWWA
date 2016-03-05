﻿module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    export class SignedOutExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _loginButton: HTMLElement;
        private viewModel: SignedOutViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            WinJS.Utilities.addClass(element, "signedOut-container");
            DOM.loadTemplate("/HtmlTemplates.html", "signedOut").then((template) => {
                return template.render(null, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);
            });
        }

        public startLogin(): void {
            this.viewModel.startLogin().done(null, () => {
                this._loginButton.innerText = "Failed";
            });
        }
    }

    export class SignedOutViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SignedOutExperience" };
        constructor(private _app: IAppWithAbilityToSignIn) {
        }

        public startLogin(): WinJS.Promise<void> {
            return Codevoid.Storyvoid.Authenticator.getClientInformation().then((clientInfo: Codevoid.OAuth.ClientInformation) => {
                this._app.signedIn(clientInfo, false/*usingSavedCredentials*/);
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience.prototype.startLogin);
}