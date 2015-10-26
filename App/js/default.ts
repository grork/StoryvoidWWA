module Codevoid.ArticleVoid {
    export class App {
        constructor() {
        }

        public initialize(): void {
            Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));
            var signedInElement = <HTMLElement>document.body.firstElementChild;

            if (!Codevoid.ArticleVoid.Authenticator.hasStoredCredentials()) {
                WinJS.Utilities.addClass(signedInElement, "hide");
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(new Codevoid.ArticleVoid.UI.SignedOutViewModel());
            } else {
                (<Codevoid.UICore.WwaExperienceHost>Codevoid.UICore.Experiences.currentHost).createExperienceWithModel(signedInElement, new Codevoid.ArticleVoid.UI.SignedInViewModel());
            }
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = (<any>window).__appObject = new App();
        app.initialize();
    });
}