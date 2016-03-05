module Codevoid.Storyvoid.UI {
    export class AppThatCanSignIn implements IAppWithAbilityToSignIn {
        private _signedOutViewModel: Codevoid.Storyvoid.UI.SignedOutViewModel;
        private _signedInViewModel: Codevoid.Storyvoid.UI.ISignedInViewModel;
        public initialize(): void {
            Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));

            var credentials = Codevoid.Storyvoid.Authenticator.getStoredCredentials();
            if (!credentials) {
                this.signOut();
            } else {
                this.signedIn(credentials, true /*usingSavedCredentials*/);
            }
        }

        public signOut(): void {
            var signedInElement = <HTMLElement>document.body.firstElementChild;
            WinJS.Utilities.addClass(signedInElement, "hide");
            this._signedOutViewModel = new Codevoid.Storyvoid.UI.SignedOutViewModel(this);
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this._signedOutViewModel);
        }

        public signedIn(credentials: OAuth.ClientInformation, usingSavedCredentials: boolean): void {
            var signedInElement = <HTMLElement>document.body.firstElementChild;
            if (!this._signedInViewModel) {
                this._signedInViewModel = this.getSignedInViewModel(this);
                (<Codevoid.UICore.WwaExperienceHost>Codevoid.UICore.Experiences.currentHost).createExperienceWithModel(signedInElement, this._signedInViewModel);
            }

            this._signedInViewModel.signedIn(usingSavedCredentials);

            WinJS.Utilities.removeClass(signedInElement, "hide");

            if (this._signedOutViewModel) {
                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this._signedOutViewModel);
                this._signedOutViewModel = null;
            }
        }

        protected get signedInViewModel(): ISignedInViewModel {
            return this._signedInViewModel;
        }

        protected getSignedInViewModel(app: IAppWithAbilityToSignIn): ISignedInViewModel {
            throw new Error("Must implement this method to support signing in");
        }
    }
}