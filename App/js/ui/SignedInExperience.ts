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

        public dumpDb(): WinJS.Promise<any> {
            var database: Codevoid.Utilities.IIndexedDatabase;
            var db: Codevoid.Utilities.IIndexedDB = (<any>window).db;
            var dumpData = {};

            return db.open({
                server: Codevoid.ArticleVoid.InstapaperDB.DBName,
                version: Codevoid.ArticleVoid.InstapaperDB.DBVersion,
            }).then((openedDb) => {
                database = openedDb;

                for (var i = 0; i < database.objectStoreNames.length; i++) {
                    dumpData[database.objectStoreNames[i]] = {};
                }
            }).then(() => {
                return JSON.stringify(dumpData, null, 2);
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

        private _logMessage(message: string): void {
            var messageElement = document.createElement("div");
            messageElement.textContent = message;
            this._content.appendChild(messageElement);
        }

        public signOut(): void {
            this.viewModel.signOut();
        }

        public startSync(): void {
            this._logMessage("Starting Sync");

            var sync = this.viewModel.getSyncEngine();
            sync.addEventListener("syncstatusupdate", (eventData) => {
                switch (eventData.detail.operation) {
                    case Codevoid.ArticleVoid.InstapaperSync.Operation.start:
                        this._logMessage("Started");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.end:
                        this._logMessage("Ended");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersStart:
                        this._logMessage("Folders Started");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersEnd:
                        this._logMessage("Folders Ended");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksStart:
                        this._logMessage("Bookmarks Start");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksEnd:
                        this._logMessage("Bookmarks End");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.folder:
                        this._logMessage("Folder Synced: " + eventData.detail.title);
                        break;

                    default:
                        this._logMessage("Unknown Event: " + eventData.detail.operation);
                        break;
                }

            });

            sync.sync();
        }

        public clearDb(): void {
            this.viewModel.clearDb().done(() => {
                this._logMessage("Cleared DB");
            });
        }

        public dumpDb(): void {
            this.viewModel.dumpDb().done((dumpData: string) => {
                this._logMessage("Dumped");

                var structured = document.createElement("pre");
                structured.innerText = dumpData;
                this._content.appendChild(structured);
            }, () => {
                this._logMessage("Not dumped");
            });
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.dumpDb);

}