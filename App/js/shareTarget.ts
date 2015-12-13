module Codevoid.ArticleVoid {
    export class ShareTargetApp extends UI.AppThatCanSignIn {

        public initialize(): void {
            super.initialize();

            Windows.UI.WebUI.WebUIApplication.addEventListener("activated", (args) => {
                var shareArgs = <Windows.ApplicationModel.Activation.IShareTargetActivatedEventArgs>args;

                Utilities.Logging.instance.log("From: " + shareArgs.shareOperation.data.properties.title);

                shareArgs.shareOperation.data.getUriAsync().done((uri: Windows.Foundation.Uri) => {
                    Utilities.Logging.instance.log(uri.rawUri);
                });
            });
        }

        protected getSignedInViewModel(): UI.ISignedInViewModel {
            return new UI.ShareTargetSignedInViewModel(this);
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = new ShareTargetApp();
        app.initialize();

        Utilities.Logging.instance.showViewer();
    });
}

module Codevoid.ArticleVoid.UI {
    export class ShareTargetSignedInViewModel implements ISignedInViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.ShareTargetSignedInExperience" };
        private _app: ShareTargetApp;
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _eventSource: Utilities.EventSource;

        constructor(app: IAppWithAbilityToSignIn) {
            this._app = <ShareTargetApp>app;
            this._eventSource = new Utilities.EventSource();
        }

        public signedIn(): void {
        }
    }

    export class ShareTargetSignedInExperience extends UICore.Control {
        constructor(element: HTMLElement, options: any) {
            super(element, options);

            Utilities.DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.ShareTargetSignedInExperience");
            element.textContent = "Signed in!";
        }
    }
}