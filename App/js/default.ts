module Codevoid.ArticleVoid {
    export class App {
        constructor() {
        }

        public initialize(): void {
            Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));

            if (!Codevoid.ArticleVoid.Authenticator.hasStoredCredentials()) {
                WinJS.Utilities.empty(document.body);
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(new Codevoid.ArticleVoid.UI.SignedOutViewModel());
            } else {
                document.querySelector("[data-cv-id=clearCreds]").addEventListener("click", () => {
                    Codevoid.ArticleVoid.Authenticator.clearClientInformation();
                });
            }
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = (<any>window).__appObject = new App();
        app.initialize();
    });
}