module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    export class SignedOutExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _loginButton: HTMLElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            DOM.loadTemplate("/HtmlTemplates.html", "signedOut").then((template) => {
                return template.render(null, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);
            });
        }

        public startLogin(): void {
            Codevoid.ArticleVoid.UI.Authenticator.showAuthenticator().done((result: Codevoid.OAuth.ClientInformation) => {
                this._loginButton.innerText = "Logged In";
            }, () => {
                this._loginButton.innerText = "Failed";
            });
        }
    }

    export class SignedOutViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedOutExperience" };
        constructor() {
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience.prototype.startLogin);
}