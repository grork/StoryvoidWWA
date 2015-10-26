module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SignedInViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        constructor() {
        }

        public signOut(): void {
            Codevoid.ArticleVoid.Authenticator.clearClientInformation();
        }
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _signOutButton: HTMLElement;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
            DOM.marryPartsToControl(element, this);
        }

        public signOut(): void {
            this.viewModel.signOut();
            Codevoid.ArticleVoid.App.instance.signedOut();
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
}