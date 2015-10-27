module Codevoid.ArticleVoid.UI {
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
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);
            });
        }

        public startLogin(): void {
            this.viewModel.startLogin().done((clientInfo: Codevoid.OAuth.ClientInformation) => {
                if (clientInfo) {
                    Codevoid.ArticleVoid.App.instance.signedIn(clientInfo);
                } else {
                    this._loginButton.innerText = "Failed";
                }
            });
        }
    }

    export class SignedOutViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedOutExperience" };
        constructor() {
        }

        public startLogin(): WinJS.Promise<Codevoid.OAuth.ClientInformation> {
            return Codevoid.ArticleVoid.Authenticator.getClientInformation().then((clientInfo: Codevoid.OAuth.ClientInformation) => {
                return clientInfo;
            }, () => {
                return null;
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedOutExperience.prototype.startLogin);
}