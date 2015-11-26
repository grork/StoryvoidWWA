module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export interface IFolderDetails {
        folder: IFolder;
        bookmarks: IBookmark[];
    }

    export class SignedInViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _instapaperDB: Codevoid.ArticleVoid.InstapaperDB;
        private _dbOpened: boolean;
        private _pendingDbOpen: Utilities.Signal;
        private _eventSource: Utilities.EventSource;
        private _currentFolderId: number = -1;
        private _currentFolder: IFolderDetails;

        constructor() {
            this._eventSource = new Utilities.EventSource();
        }

        private disposeDB(): void {
            if (!this._instapaperDB) {
                return;
            }

            this._instapaperDB.dispose();
            this._instapaperDB = null;
            this._dbOpened = false;
        }

        public initializeDB(): WinJS.Promise<void> {
            if (this._dbOpened) {
                return WinJS.Promise.as(null);
            }

            if (this._pendingDbOpen) {
                return this._pendingDbOpen.promise;
            }

            this._pendingDbOpen = new Utilities.Signal();
            this._instapaperDB = new Codevoid.ArticleVoid.InstapaperDB();

            this._instapaperDB.initialize().done((result) => {
                this._dbOpened = true;
                Utilities.Logging.instance.log("Initialized DB");
                this._pendingDbOpen.complete();
                this._pendingDbOpen = null;
            }, (e) => {
                this._pendingDbOpen.error(e);
                this._pendingDbOpen = null;
            });

            return this._pendingDbOpen.promise;
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
            this.initializeDB();
        }

        public startSync(): void {
            var sync = new Codevoid.ArticleVoid.InstapaperSync(this._clientInformation);

            Utilities.Logging.instance.log("Starting Sync");

            sync.addEventListener("syncstatusupdate", (eventData) => {
                switch (eventData.detail.operation) {
                    case Codevoid.ArticleVoid.InstapaperSync.Operation.start:
                        Utilities.Logging.instance.log("Started");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.end:
                        Utilities.Logging.instance.log("Ended");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersStart:
                        Utilities.Logging.instance.log("Folders Started");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.foldersEnd:
                        Utilities.Logging.instance.log("Folders Ended");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksStart:
                        Utilities.Logging.instance.log("Bookmarks Start");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarksEnd:
                        Utilities.Logging.instance.log("Bookmarks End");
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.bookmarkFolder:
                        Utilities.Logging.instance.log("Syncing Folder: " + eventData.detail.title);
                        break;

                    case Codevoid.ArticleVoid.InstapaperSync.Operation.folder:
                        Utilities.Logging.instance.log("Folder Synced: " + eventData.detail.title);
                        break;

                    default:
                        Utilities.Logging.instance.log("Unknown Event: " + eventData.detail.operation);
                        break;
                }

            });

            sync.sync().done(() => {
                Utilities.Logging.instance.log("Completed Sync");
                this._eventSource.dispatchEvent("synccompleted", null);
                
                //HACK until we have actual DB change notifications
                var currentFolder = this._currentFolderId;
                this._currentFolderId = -1;
                this.switchCurrentFolderTo(currentFolder);
            }, (e) => {
                Utilities.Logging.instance.log("Failed Sync:");
                Utilities.Logging.instance.log(JSON.stringify(e, null, 2), true);
            });
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

        public getDetailsForFolder(folderId: number): WinJS.Promise<IFolderDetails> {
            return WinJS.Promise.join({
                folder: this._instapaperDB.getFolderByDbId(folderId),
                bookmarks: this._instapaperDB.listCurrentBookmarks(folderId),
            });
        }

        public get events(): Utilities.EventSource {
            return this._eventSource;
        }

        public get commonFolderDbIds() {
            return this._instapaperDB.commonFolderDbIds;
        }

        public get currentFolderId(): number {
            return this._currentFolderId;
        }

        public get currentFolder(): IFolderDetails {
            return this._currentFolder;
        }

        public switchCurrentFolderTo(folderId: number): void {
            // If we're being asked to switch to the folder
            // we're currently on, then no-op.
            if (this._currentFolderId === folderId) {
                return;
            }

            this._currentFolder = null;
            this._currentFolderId = folderId;

            this._eventSource.dispatchEvent("currentfolderchanging", null);

            this.getDetailsForFolder(folderId).done((result) => {
                this._currentFolder = result;
                this._eventSource.dispatchEvent("currentfolderchanged", result);
            }, () => {
                this._currentFolderId = -1;
            });
        }
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _folderNameElement: HTMLElement;
        private _contentList: WinJS.UI.ListView<any>;
        private _splitToggle: WinJS.UI.SplitViewPaneToggle;
        private _splitView: WinJS.UI.SplitView;
        private _folderList: WinJS.UI.Repeater;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");

            WinJS.UI.processAll(element).done(() => {
                this._initialize();
            });
        }

        private _initialize(): void {
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._splitToggle.splitView = this._splitView.element;

            this._handlersToCleanup.push(Utilities.addEventListeners(this.viewModel.events, {
                currentfolderchanging: () => {
                    this._contentList.itemDataSource = null;
                },
                currentfolderchanged: (e: { detail: IFolderDetails }) => {
                    this._renderFolderDetails(e.detail);
                },
            }));

            this.viewModel.initializeDB().then(() => {
                this._handleDBInitialized();
            });

        }

        private _handleDBInitialized(): void {
            var firstTimeAnimation = Utilities.addEventListeners(this._contentList, {
                contentanimating: (eventObject) => {
                    if (eventObject.detail.type === "entrance") {
                        eventObject.preventDefault();
                        firstTimeAnimation.cancel();
                    }
                }
            });

            if (this.viewModel.currentFolder) {
                this._renderFolderDetails(this.viewModel.currentFolder);
            } else {
                this.viewModel.switchCurrentFolderTo(this.viewModel.commonFolderDbIds.unread);
            }
        }

        public splitViewOpening() {
            this.viewModel.listFolders().done((folders: IFolder[]) => {
                this._folderList.data = new WinJS.Binding.List(folders);
            });
        }

        public signOut(): void {
            this._folderList.data = null;
            this._contentList.itemDataSource = null;
            this.viewModel.signOut();
        }

        public showLogger(): void {
            Utilities.Logging.instance.showViewer();
        }

        public _renderFolderDetails(folderDeatils: IFolderDetails): void {
            Utilities.Logging.instance.log("Bookmarks for: " + folderDeatils.folder.folder_id);
            this._folderNameElement.textContent = folderDeatils.folder.title;
            var bookmarks = folderDeatils.bookmarks.reverse();
            this._contentList.itemDataSource = new WinJS.Binding.List<IBookmark>(bookmarks).dataSource;
        }

        public startSync(): void {
            this.viewModel.startSync();
        }

        public folderClicked(e: any): void {
            var button: UI.SplitViewCommandWithData = e.target.winControl;
            this.viewModel.switchCurrentFolderTo(button.dataContext.id);
            this._splitView.closePane();
        }

        public clearDb(): void {
            this.viewModel.clearDb().done(() => {
                Utilities.Logging.instance.log("Cleared DB");
            });
        }

        public dumpDb(): void {
            this.viewModel.dumpDb().done((dumpData: string) => {
                Utilities.Logging.instance.log("Dumped");

                Utilities.Logging.instance.log(dumpData, true);
            }, () => {
                Utilities.Logging.instance.log("Not dumped");
            });
        }
        
        static folderIdToIcon: any;
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);


    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewOpening);

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showLogger);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.folderClicked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.dumpDb);

    SignedInExperience.folderIdToIcon = WinJS.Binding.converter((folder: string) => {
        var result = "\uE8B7"; // hollow folder icon

        switch (folder) {
            case InstapaperDB.CommonFolderIds.Archive:
                result = "\uE8F1";
                break;

            case InstapaperDB.CommonFolderIds.Liked:
                result = "\uE006";
                break;

            case InstapaperDB.CommonFolderIds.Unread:
                result = "\uE80F";
                break;

            default:
                break;
        }

        return result;
    });
}