module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SignedInViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _instapaperDB: Codevoid.ArticleVoid.InstapaperDB;
        constructor() {
        }

        public initializeDB(): WinJS.Promise<Codevoid.ArticleVoid.InstapaperDB> {
            if (this._instapaperDB) {
                return WinJS.Promise.as(this._instapaperDB);
            }

            this._instapaperDB = new Codevoid.ArticleVoid.InstapaperDB();
            return this._instapaperDB.initialize();
        }

        private disposeDB(): void {
            if (!this._instapaperDB) {
                return;
            }

            this._instapaperDB.dispose();
        }

        public signOut(): void {
            this.disposeDB();
            Codevoid.ArticleVoid.Authenticator.clearClientInformation();

            var idb = new Codevoid.ArticleVoid.InstapaperDB();
            idb.initialize().then(() => {
                return idb.deleteAllData();
            }).done(() => {
                this._clientInformation = null;
                Codevoid.ArticleVoid.App.instance.signedOut();
            });
        }

        public signedIn() {
            this._clientInformation = this._clientInformation = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
        }

        public getSyncEngine(): Codevoid.ArticleVoid.InstapaperSync {
            return new Codevoid.ArticleVoid.InstapaperSync(this._clientInformation);
        }

        public clearDb(): WinJS.Promise<any> {
            this.disposeDB();
            var idb = new Codevoid.ArticleVoid.InstapaperDB();
            return idb.initialize().then(() => {

            }, () => {
            }).then(() => {
                idb.deleteAllData();
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

                var tablePromises = [];

                for (var i = 0; i < database.objectStoreNames.length; i++) {
                    ((tableName: string) => {
                        tablePromises.push(database.query(tableName).execute().then((results: any[]) => {
                            dumpData[tableName] = results;
                        }));
                    })(database.objectStoreNames[i]);
                }

                return WinJS.Promise.join(tablePromises);
            }).then(() => {
                database.close();
                return JSON.stringify(dumpData, null, 2);
            });
        }

        public listFolders(): WinJS.Promise<Codevoid.ArticleVoid.IFolder[]> {
            return this._instapaperDB.listCurrentFolders().then((folders: IFolder[]) => {
                return folders.filter((item) => {
                    if (item.localOnly) {
                        return false;
                    }

                    return true;
                });
            });
        }

        public listUnreadBookmarks(): WinJS.Promise<Codevoid.ArticleVoid.IBookmark[]> {
            return this._instapaperDB.listCurrentBookmarks(this._instapaperDB.commonFolderDbIds.unread);
        }
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _signOutButton: HTMLElement;
        private _messages: HTMLElement;
        private _contentList: WinJS.UI.ListView<any>;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");

            WinJS.UI.processAll(element).done(() => {
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);
            });
        }

        private _logMessage(message: string): void {
            var messageElement = document.createElement("div");
            messageElement.textContent = message;
            this._messages.appendChild(messageElement);
        }

        private _logStructedMessage(message: string): void {
            var messageElement = document.createElement("pre");
            messageElement.innerText = message;
            this._messages.appendChild(messageElement);
        }

        public signOut(): void {
            this.viewModel.signOut();
        }

        public initializeDB(): void {
            this.viewModel.initializeDB().done(() => {
                this._logMessage("Initialized DB");
            });
        }

        public listFolders(): void {
            this.viewModel.listFolders().done((folders: IFolder[]) => {
                folders.forEach((folder) => {
                    this._logMessage("Folder: " + folder.title);
                });
            });
        }

        public listUnreadBookmarks(): void {
            this.viewModel.listUnreadBookmarks().done((bookmarks: IBookmark[]) => {
                this._logMessage("Bookmarks!");
                bookmarks.reverse();
                this._contentList.itemDataSource = new WinJS.Binding.List<IBookmark>(bookmarks).dataSource;
            });
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

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarkFolder:
                        this._logMessage("Syncing Folder: " + eventData.detail.title);
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.folder:
                        this._logMessage("Folder Synced: " + eventData.detail.title);
                        break;

                    default:
                        this._logMessage("Unknown Event: " + eventData.detail.operation);
                        break;
                }

            });

            sync.sync().done(() => {
                this._logMessage("Completed Sync");
            }, (e) => {
                this._logMessage("Failed Sync:");
                this._logStructedMessage(JSON.stringify(e, null, 2));
            });
        }

        public clearDb(): void {
            this.viewModel.clearDb().done(() => {
                this._logMessage("Cleared DB");
            });
        }

        public dumpDb(): void {
            this.viewModel.dumpDb().done((dumpData: string) => {
                this._logMessage("Dumped");

                this._logStructedMessage(dumpData);
            }, () => {
                this._logMessage("Not dumped");
            });
        }

        public clearLog(): void {
            this._messages.textContent = "";
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.initializeDB);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.listFolders);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.listUnreadBookmarks);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.dumpDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearLog);

}