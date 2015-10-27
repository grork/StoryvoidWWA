module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SignedInViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        constructor() {
            this._clientInformation = Codevoid.ArticleVoid.Authenticator.getClientInformation();
        }

        public signOut(): void {
            Codevoid.ArticleVoid.Authenticator.clearClientInformation();
            Codevoid.ArticleVoid.App.instance.signedOut();
        }

        public startSync(): WinJS.Promise<any> {
            return WinJS.Promise.as();
        }
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _signOutButton: HTMLElement;
        private _content: HTMLElement;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
            DOM.marryPartsToControl(element, this);
        }

        public signOut(): void {
            this.viewModel.signOut();
        }

        public startSync(): void {
            var startEl = document.createElement("div");
            startEl.innerText = "Starting Sync";
            this._content.appendChild(startEl);
            this.viewModel.startSync().done(() => {
                var endEl = document.createElement("div");
                endEl.innerText = "Ending Sync";
                this._content.appendChild(endEl);
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
}