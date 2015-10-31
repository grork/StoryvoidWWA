module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SignedInViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        constructor() {
            this._clientInformation = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
        }

        public signOut(): void {
            Codevoid.ArticleVoid.Authenticator.clearClientInformation();

            var idb = new Codevoid.ArticleVoid.InstapaperDB();
            idb.initialize().then(() => {
                return idb.deleteAllData();
            }).done(() => {
                Codevoid.ArticleVoid.App.instance.signedOut();
            });
        }

        public getSyncEngine(): Codevoid.ArticleVoid.InstapaperSync {
            return new Codevoid.ArticleVoid.InstapaperSync(this._clientInformation);
        }

        public clearDb(): WinJS.Promise<any> {
            var idb = new Codevoid.ArticleVoid.InstapaperDB();
            return idb.initialize().then(() => {
                return idb.deleteAllData();
            });
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

            var sync = this.viewModel.getSyncEngine();
            sync.addEventListener("syncstatusupdate", (eventData) => {
                var el = document.createElement("div");
                switch (eventData.detail.operation) {
                    case Codevoid.ArticleVoid.InstapaperSync.Operation.start:
                        el.innerText = "Started";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.end:
                        el.innerText = "Ended";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersStart:
                        el.innerText = "Folders Started";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersEnd:
                        el.innerText = "Folders Ended";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksStart:
                        el.innerText = "Bookmarks Start";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksEnd:
                        el.innerText = "Bookmarks End";
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.folder:
                        el.innerText = "Folder Synced: " + eventData.detail.title;
                        break;

                    default:
                        el.innerText = "Unknown Event: " + eventData.detail.operation;
                        break;
                }

                this._content.appendChild(el);
            });

            sync.sync();
        }

        public clearDb(): void {
            this.viewModel.clearDb().done(() => {
                var clearedElement = document.createElement("div");
                clearedElement.textContent = "Cleared";
                this._content.appendChild(clearedElement);
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);

}