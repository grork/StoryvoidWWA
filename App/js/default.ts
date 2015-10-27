module Codevoid.ArticleVoid {
    export class App {
        private _signedOutViewModel: Codevoid.ArticleVoid.UI.SignedOutViewModel;
        private _signedInViewModel: Codevoid.ArticleVoid.UI.SignedInViewModel;
        constructor() {
            if (App._instance) {
                throw "Only one app instance can be constructed";
            }

            App._instance = this;
        }

        public initialize(): void {
            Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));

            var credentials = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
            if (!credentials) {
                this.signedOut();
            } else {
                this.signedIn(credentials);
            }
        }

        public signedOut(): void {
            var signedInElement = <HTMLElement>document.body.firstElementChild;
            WinJS.Utilities.addClass(signedInElement, "hide");
            this._signedOutViewModel = new Codevoid.ArticleVoid.UI.SignedOutViewModel();
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this._signedOutViewModel);
        }

        public signedIn(credentials: Codevoid.OAuth.ClientInformation): void {
            var signedInElement = <HTMLElement>document.body.firstElementChild;
            if (!this._signedInViewModel) {
                this._signedInViewModel = new Codevoid.ArticleVoid.UI.SignedInViewModel();
                (<Codevoid.UICore.WwaExperienceHost>Codevoid.UICore.Experiences.currentHost).createExperienceWithModel(signedInElement, this._signedInViewModel);
            }

            WinJS.Utilities.removeClass(signedInElement, "hide");

            if (this._signedOutViewModel) {
                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this._signedOutViewModel);
                this._signedOutViewModel = null;
            }
        }

        static _instance: App;
        static get instance(): App {
            return App._instance;
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = new App();
        app.initialize();
    });
}