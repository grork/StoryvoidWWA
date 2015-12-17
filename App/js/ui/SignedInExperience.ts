﻿module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export interface IFolderDetails {
        folder: IFolder;
        bookmarks: WinJS.Binding.ListBase<IBookmark>;
    }

    enum SortOption {
        Oldest,
        Newest,
        Progress
    }

    interface ISortsInfo
    {
        label: string;
        sort: SortOption;
        comparer: (firstBookmark: IBookmark, secondBookmark: IBookmark) => number
    }

    export class SignedInViewModel implements Codevoid.ArticleVoid.UI.ISignedInViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.SignedInExperience" };
        private _handlersToCleanUp: Utilities.ICancellable[] = [];
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _instapaperDB: Codevoid.ArticleVoid.InstapaperDB;
        private _dbOpened: boolean;
        private _pendingDbOpen: Utilities.Signal;
        private _eventSource: Utilities.EventSource;
        private _currentFolderId: number = -1;
        private _currentFolder: IFolderDetails;
        private _currentBookmarks: WinJS.Binding.List<IBookmark>;
        private _currentSort: SortOption = SortOption.Oldest;
        private static _sorts: ISortsInfo[];

        constructor(private _app: IAppWithAbilityToSignIn) {
            this._eventSource = new Utilities.EventSource();
        }

        private disposeDB(): void {
            if (!this._instapaperDB) {
                return;
            }

            // Clean up listeners
            this._handlersToCleanUp.forEach((cancellable: Utilities.ICancellable) => {
                cancellable.cancel();
            });

            this._handlersToCleanUp = [];
            this._instapaperDB.dispose();
            this._instapaperDB = null;
            this._dbOpened = false;
        }

        private _handleFoldersChanged(detail: IFoldersChangedEvent): void {
            // Only care if it's for the folder we're currently on
            if (detail.folder_dbid !== this._currentFolderId) {
                return;
            }

            switch (detail.operation) {
                case InstapaperDB.FolderChangeTypes.UPDATE:
                    this._handleFoldersUpdated(detail);
                    break;

                case InstapaperDB.FolderChangeTypes.DELETE:
                    this._handleFolderDeleted(detail);
                    break;
            }
        }

        private _handleFoldersUpdated(detail: IFoldersChangedEvent): void {
            // We only care about updates
            if (detail.operation !== InstapaperDB.FolderChangeTypes.UPDATE) {
                return;
            }

            // If it's not changed, we don't care.
            if (detail.folder.title === this._currentFolder.folder.title) {
                return;
            }

            this._eventSource.dispatchEvent("foldertitleupdated", detail.folder);
        }

        private _handleFolderDeleted(detail: IFoldersChangedEvent): void {
            // Don't care about not-deletes
            if (detail.operation !== InstapaperDB.FolderChangeTypes.DELETE) {
                return;
            }

            // Since the folder we're on was deleted, we should refresh
            // to some UI -- so switch to 'home'
            this.switchCurrentFolderTo(this._instapaperDB.commonFolderDbIds.unread);
        }

        private _handleBookmarksChanged(detail: IBookmarksChangedEvent): void {
            if (detail.operation === InstapaperDB.BookmarkChangeTypes.MOVE) {
                // Moves are handled specially because we need to look at both destination
                // and source information.
                this._handleBookmarkMoved(detail);
                return;
            }

            var folderId = detail.sourcefolder_dbid || detail.bookmark.folder_dbid;
            // Only care if the folder for this bookmark is of interest
            if (folderId != this._currentFolderId) {
                return;
            }

            switch (detail.operation) {
                case InstapaperDB.BookmarkChangeTypes.UPDATE:
                    this._handleBookmarkUpdated(detail);
                    break;

                case InstapaperDB.BookmarkChangeTypes.ADD:
                    this._handleBookmarkAdded(detail);
                    break;

                case InstapaperDB.BookmarkChangeTypes.DELETE:
                    this._handleBookmarkDeleted(detail);
                    break;
            }
        }

        private _handleBookmarkMoved(detail: IBookmarksChangedEvent) {
            if (detail.sourcefolder_dbid === this._currentFolderId) {
                // since it's *from* this folder, and it's a move, this should be remapped to an delete:
                detail.operation = InstapaperDB.BookmarkChangeTypes.DELETE;
                this._handleBookmarkDeleted(detail);
                return;
            }

            if (detail.destinationfolder_dbid === this._currentFolderId) {
                // If the destination maps to the folder we're looking at,
                // then we can map to an add
                detail.operation = InstapaperDB.BookmarkChangeTypes.ADD;
                this._handleBookmarkAdded(detail);
                return;
            }
        }

        private _handleBookmarkUpdated(detail: IBookmarksChangedEvent): void {
            // Don't care about non-updates
            if (detail.operation !== InstapaperDB.BookmarkChangeTypes.UPDATE) {
                return;
            }

            var indexOfBookmark: number;
            var boomarkWereLookingFor = this._currentBookmarks.some((bookmark: IBookmark, index: number) => {
                if (bookmark.bookmark_id === detail.bookmark_id) {
                    indexOfBookmark = index;
                    return true;
                }

                return false;
            });

            if (!boomarkWereLookingFor) {
                return;
            }

            this._currentBookmarks.setAt(indexOfBookmark, detail.bookmark);
        }

        private _handleBookmarkAdded(detail: IBookmarksChangedEvent): void {
            // Only adds of intrest to us here.
            if (detail.operation !== InstapaperDB.BookmarkChangeTypes.ADD) {
                return;
            }

            this._currentBookmarks.push(detail.bookmark);
        }

        private _handleBookmarkDeleted(detail: IBookmarksChangedEvent): void {
            // Don't care about non-deletes
            if (detail.operation !== InstapaperDB.BookmarkChangeTypes.DELETE) {
                return;
            }

            var indexOfBookmark: number;
            var boomarkWereLookingFor = this._currentBookmarks.some((bookmark: IBookmark, index: number) => {
                if (bookmark.bookmark_id === detail.bookmark_id) {
                    indexOfBookmark = index;
                    return true;
                }

                return false;
            });

            if (!boomarkWereLookingFor) {
                return;
            }

            this._currentBookmarks.splice(indexOfBookmark, 1);
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

            this._handlersToCleanUp.push(Utilities.addEventListeners(this._instapaperDB, {
                folderschanged: (e: Utilities.EventObject<IFoldersChangedEvent>) => {
                    Utilities.Logging.instance.log("Folder Changed: " + e.detail.operation + ", for Folder: " + e.detail.folder_dbid);

                    this._handleFoldersChanged(e.detail);
                },
                bookmarkschanged: (e: Utilities.EventObject<IBookmarksChangedEvent>) => {
                    Utilities.Logging.instance.log("Bookmark Changed: " + e.detail.operation + ", for Bookmark: " + e.detail.bookmark_id);

                    this._handleBookmarksChanged(e.detail);
                },
            }));

            this._instapaperDB.initialize().done((result) => {
                this._dbOpened = true;
                this._currentFolderId = this.commonFolderDbIds.unread;

                Utilities.Logging.instance.log("Initialized DB w/ folder ID: " + this._currentFolderId);
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
                this._app.signOut();
            });
        }

        public signedIn() {
            this._clientInformation = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
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

            sync.sync({
                dbInstance: this._instapaperDB,
                folders: true,
                bookmarks: true,
            }).done(() => {
                Utilities.Logging.instance.log("Completed Sync");
                this._eventSource.dispatchEvent("synccompleted", null);

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

        public showDbFiddler(): void {
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(new DbFiddlerViewModel(this._instapaperDB));
        }

        public listFolders(): WinJS.Promise<Codevoid.ArticleVoid.IFolder[]> {
            return this._instapaperDB.listCurrentFolders().then((folders: IFolder[]) => {
                return folders.filter((item) => {
                    if (item.localOnly) {
                        return false;
                    }

                    return true;
                }).sort((firstFolder: IFolder, secondFolder: IFolder): number => {
                    if ((firstFolder.position === undefined) && (secondFolder.position === undefined)) {
                        // Assume we're sorting pre-canned folders. Sort by "id"
                        if (firstFolder.id < secondFolder.id) {
                            return -1;
                        } else if (firstFolder.id > secondFolder.id) {
                            return 1;
                        } else {
                            return;
                        }
                    }

                    if ((firstFolder.position === undefined) && (secondFolder.position !== undefined)) {
                        // Assume it's a pre-canned folder against a user folder. Pre-canned
                        // always go first
                        return -1;
                    }

                    if ((firstFolder.position !== undefined) && (secondFolder.position === undefined)) {
                        // Assume it's a user folder against a pre-canned folder. User folders
                        // always come after.
                        return 1;
                    }

                    // Since we've got user folders, sort soley by the users ordering preference
                    if (firstFolder.position < secondFolder.position) {
                        return -1;
                    } else if (firstFolder.position > secondFolder.position) {
                        return 1;
                    } else {
                        return 1;
                    }
                });
            });
        }

        public getDetailsForFolder(folderId: number): WinJS.Promise<IFolderDetails> {
            return WinJS.Promise.join({
                folder: this._instapaperDB.getFolderByDbId(folderId),
                bookmarks: this._instapaperDB.listCurrentBookmarks(folderId),
            }).then((result) => {
                // Save base list of bookmarks locally so we can mutate it based
                // on change notifications.
                this._currentBookmarks = new WinJS.Binding.List<IBookmark>(result.bookmarks);

                // However, return the projection to the person asking for the *sorted* list of bookmarks.
                return {
                    folder: result.folder,
                    bookmarks: this._currentBookmarks.createSorted(SignedInViewModel.sorts[this._currentSort].comparer),
                };
            });
        }

        public get events(): Utilities.EventSource {
            return this._eventSource;
        }

        public get commonFolderDbIds() {
            return this._instapaperDB.commonFolderDbIds;
        }

        public switchCurrentFolderTo(folderId: number): void {
            // If we're being asked to switch to the folder
            // we're currently on, then no-op.
            if (this._currentFolderId === folderId) {
                return;
            }

            this._currentFolder = null;
            this._currentFolderId = folderId;

            this.refreshCurrentFolder();
        }

        public refreshCurrentFolder(): void {
            this._eventSource.dispatchEvent("folderchanging", null);

            this.getDetailsForFolder(this._currentFolderId).done((result) => {
                this._currentFolder = result;
                this._eventSource.dispatchEvent("folderchanged", result);
            }, () => {
                this._currentFolderId = -1;
            });
        }

        public changeSortTo(newSort: SortOption): void {
            if (this._currentSort === newSort) {
                return;
            }

            this._currentSort = newSort;
            this._eventSource.dispatchEvent("sortchanged", newSort);

            this.refreshCurrentFolder();
        }

        public static get sorts(): ISortsInfo[]{
            if (!SignedInViewModel._sorts) {
                SignedInViewModel._sorts = [
                    { label: "Oldest", sort: SortOption.Oldest, comparer: SignedInViewModel.sortOldestFirst },
                    { label: "Newest", sort: SortOption.Newest, comparer: SignedInViewModel.sortNewestFirst },
                    { label: "Progress", sort: SortOption.Progress, comparer: SignedInViewModel.sortMostProgressFirst },
                ];
            }

            return SignedInViewModel._sorts;
        }

        private static sortOldestFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
            if (firstBookmark.time < secondBookmark.time) {
                return -1;
            } else if (firstBookmark.time > secondBookmark.time) {
                return 1;
            } else {
                return 0;
            }
        }

        private static sortNewestFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
            if (firstBookmark.time < secondBookmark.time) {
                return 1;
            } else if (firstBookmark.time > secondBookmark.time) {
                return -1;
            } else {
                return 0;
            }
        }

        private static sortMostProgressFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
            if (firstBookmark.progress < secondBookmark.progress) {
                return -1;
            } else if (firstBookmark.progress > secondBookmark.progress) {
                return 1;
            } else {
                return SignedInViewModel.sortOldestFirst(firstBookmark, secondBookmark);
            }
        }
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _folderNameElement: HTMLElement;
        private _contentList: WinJS.UI.ListView<any>;
        private _splitToggle: WinJS.UI.SplitViewPaneToggle;
        private _splitView: WinJS.UI.SplitView;
        private _folderList: WinJS.UI.Repeater;
        private _sorts: WinJS.UI.Repeater;
        private _sortsElement: HTMLSelectElement;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedInExperience");

            WinJS.UI.processAll(element).done(() => {
                this._initialize();
            });
        }

        private _initialize(): void {
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._splitToggle.splitView = this._splitView.element;

            this._handlersToCleanup.push(Utilities.addEventListeners(this.viewModel.events, {
                folderchanging: () => {
                    this._contentList.itemDataSource = null;
                },
                folderchanged: (e: { detail: IFolderDetails }) => {
                    this._renderFolderDetails(e.detail);
                },
                foldertitleupdated: (e: { detail: IFolder }) => {
                    this._folderNameElement.textContent = e.detail.title;
                },
                sortchanged: (e: { detail: SortOption }) => {
                    this._sortsElement.value = e.detail.toString();
                },
            }));

            this.viewModel.initializeDB().done(() => {
                this._handleDBInitialized();
            });

            this._sorts.data = new WinJS.Binding.List(SignedInViewModel.sorts);
            this._sortsElement = <HTMLSelectElement>this._sorts.element;
            this._sortsElement.selectedIndex = 0;
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

            this.viewModel.refreshCurrentFolder();
        }

        public handleSortsChanged(e: UIEvent) {
            var rawSortOption = parseInt(this._sortsElement.value);
            this.viewModel.changeSortTo(<SortOption>rawSortOption);
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

        public _renderFolderDetails(folderDetails: IFolderDetails): void {
            Utilities.Logging.instance.log("Bookmarks for: " + folderDetails.folder.folder_id);

            this._folderNameElement.textContent = folderDetails.folder.title;
            this._contentList.itemDataSource = folderDetails.bookmarks.dataSource;
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

        public showDbFiddler(): void {
            this.viewModel.showDbFiddler();
        }
        
        static folderIdToIcon: any;
        static restrictProgressTo5PercentOrMore: any;
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewOpening);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showLogger);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.folderClicked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.handleSortsChanged);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.dumpDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showDbFiddler);

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

    SignedInExperience.restrictProgressTo5PercentOrMore = WinJS.Binding.converter((progress: number) => {
        if (progress > 0.049) {
            return progress;
        }

        return 0;
    });
}