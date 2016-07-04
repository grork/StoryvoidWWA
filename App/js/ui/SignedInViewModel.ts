module Codevoid.Storyvoid.UI {
    var ARTICLES_FOLDER_NAME = "Articles";

    export interface IFolderDetails {
        folder: IFolder;
        bookmarks: WinJS.Binding.ListBase<IBookmark>;
    }

    export enum SortOption {
        Oldest,
        Newest,
        Progress
    }

    interface ISortsInfo {
        label: string;
        sort: SortOption;
        comparer: (firstBookmark: IBookmark, secondBookmark: IBookmark) => number
    }

    interface ICommandOptions {
        label: string;
        icon: string;
        onclick: (e?: UIEvent) => void;
    }

    export class SignedInViewModel implements Codevoid.Storyvoid.UI.ISignedInViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SignedInExperience" };
        private _handlersToCleanUp: Utilities.ICancellable[] = [];
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _instapaperDB: Codevoid.Storyvoid.InstapaperDB;
        private _dbOpened: boolean;
        private _pendingDbOpen: Utilities.Signal;
        private _eventSource: Utilities.EventSource;
        private _currentFolderId: number = -1;
        private _currentFolder: IFolderDetails;
        private _currentBookmarks: WinJS.Binding.List<IBookmark>;
        private _currentSort: SortOption = SortOption.Oldest;
        private _readyForEvents: Utilities.Signal = new Utilities.Signal();
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
            this._currentFolder = null;
            this._currentFolderId = -1;
            this._currentBookmarks = null;
            this._currentSort = SortOption.Oldest;
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

        private _cleanupDownloadedArticles(): WinJS.Promise<any> {
            return Windows.Storage.ApplicationData.current.localFolder.getFolderAsync(ARTICLES_FOLDER_NAME).then((folder) => {
                return folder.deleteAsync();
            }).then(() => {
                // Nothing to do on success
            }, () => {
                // Kill all the errors!
                // Specifically, if it doesn't exist it'll fail to get the folder.
            });
        }

        public initializeDB(): WinJS.Promise<void> {
            if (this._dbOpened) {
                return WinJS.Promise.as(null);
            }

            if (this._pendingDbOpen) {
                return this._pendingDbOpen.promise;
            }

            this._pendingDbOpen = new Utilities.Signal();
            this._instapaperDB = new Codevoid.Storyvoid.InstapaperDB();

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

        public readyForEvents(): void {
            this._readyForEvents.complete();
        }

        public get currentFolderId(): number {
            return this._currentFolderId;
        }

        public signOut(clearCredentials: boolean): WinJS.Promise<any> {
            this.disposeDB();

            if (clearCredentials) {
                Codevoid.Storyvoid.Authenticator.clearClientInformation();
                this._app.signOut(true);
            }

            var idb = new Codevoid.Storyvoid.InstapaperDB();
            return idb.initialize().then(() => {
                return WinJS.Promise.join([
                    idb.deleteAllData(),
                    this._cleanupDownloadedArticles()
                ]);
            }).then(() => {
                this._clientInformation = null;

                var viewerSettings = new Codevoid.Storyvoid.Settings.ViewerSettings();
                viewerSettings.removeAllSettings();

                var syncSettings = new Codevoid.Storyvoid.Settings.SyncSettings();
                syncSettings.removeAllSettings();

                // Dispatch event after we've told the app to sign out
                // so that the animation plays w/ full content rather
                // than an empty state.
                this.events.dispatchEvent("signedout", null);
            });
        }

        public signedIn(usingSavedCredentials: boolean): WinJS.Promise<any> {
            this._clientInformation = Codevoid.Storyvoid.Authenticator.getStoredCredentials();
            var completedSignal = new Codevoid.Utilities.Signal();

            WinJS.Promise.join({
                db: this.initializeDB(),
                uiReady: this._readyForEvents.promise,
            }).then(() => {
                var articleDisplay = WinJS.Promise.as<any>();

                // Try showing a saved article before doing the rest of the work.
                var transientSettings = new Settings.TransientSettings();
                if (transientSettings.lastViewedArticleId != -1) {
                    articleDisplay = this._instapaperDB.getBookmarkByBookmarkId(transientSettings.lastViewedArticleId).then(bookmark => this.showArticle(bookmark, true /*restoring*/));
                }

                return articleDisplay;
            }).done(() => {
                this.refreshCurrentFolder();

                // We just signed in, we should probably start a sync.
                // Probably need to factor something in w/ startup
                if (!usingSavedCredentials) {
                    this.startSync().done(() => {
                        completedSignal.complete();
                    });
                } else {
                    completedSignal.complete();
                }
            });

            return completedSignal.promise;
        }

        public startSync(): WinJS.Promise<any> {
            var sync = new Codevoid.Storyvoid.InstapaperSync(this._clientInformation);
            var folderOperation = Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists);
            var articleSync: Codevoid.Storyvoid.InstapaperArticleSync;
            var syncSettings = new Codevoid.Storyvoid.Settings.SyncSettings();
            var completedSignal = new Codevoid.Utilities.Signal();

            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Unread] = syncSettings.homeArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Archive] = syncSettings.archiveArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Liked] = syncSettings.likedArticleLimit;

            Utilities.Logging.instance.log("Starting Sync");

            sync.addEventListener("syncstatusupdate", (eventData) => {
                switch (eventData.detail.operation) {
                    case Codevoid.Storyvoid.InstapaperSync.Operation.start:
                        this.events.dispatchEvent("syncstarting", { message: "Syncing your articles!" });

                        Utilities.Logging.instance.log("Started");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.end:
                        Utilities.Logging.instance.log("Ended");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.foldersStart:
                        Utilities.Logging.instance.log("Folders Started");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.foldersEnd:
                        Utilities.Logging.instance.log("Folders Ended");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksStart:
                        Utilities.Logging.instance.log("Bookmarks Start");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksEnd:
                        Utilities.Logging.instance.log("Bookmarks End");
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.bookmarkFolder:
                        Utilities.Logging.instance.log("Syncing Folder: " + eventData.detail.title);
                        break;

                    case Codevoid.Storyvoid.InstapaperSync.Operation.folder:
                        Utilities.Logging.instance.log("Folder Synced: " + eventData.detail.title);
                        break;

                    default:
                        Utilities.Logging.instance.log("Unknown Event: " + eventData.detail.operation);
                        break;
                }
            });

            WinJS.Promise.join({
                sync: sync.sync({
                    dbInstance: this._instapaperDB,
                    folders: true,
                    bookmarks: true,
                }),
                folder: folderOperation,
            }).then((result) => {
                if (completedSignal) {
                    completedSignal.complete();
                }

                articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, result.folder);

                Codevoid.Utilities.addEventListeners(articleSync.events, {
                    syncingarticlestarting: (e: { detail: { title: string } }) => {
                        this.events.dispatchEvent("syncprogressupdate", {
                            message: "Syncing \"" + e.detail.title + "\"",
                        });
                    },
                });

                return articleSync.syncAllArticlesNotDownloaded(this._instapaperDB);
            }).then(() => {
                return articleSync.removeFilesForNotPresentArticles(this._instapaperDB);
            }).done(() => {
                Utilities.Logging.instance.log("Completed Sync");
                this._eventSource.dispatchEvent("synccompleted", null);
            }, (e) => {
                if (completedSignal) {
                    completedSignal.complete();
                }

                Utilities.Logging.instance.log("Failed Sync:");
                Utilities.Logging.instance.log(JSON.stringify(e, null, 2), true);
            });

            return completedSignal.promise.then(() => {
                completedSignal = null;
            });
        }

        public clearDb(): WinJS.Promise<any> {
            this.disposeDB();
            var idb = new Codevoid.Storyvoid.InstapaperDB();

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
                server: Codevoid.Storyvoid.InstapaperDB.DBName,
                version: Codevoid.Storyvoid.InstapaperDB.DBVersion,
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
                return JSON.stringify(dumpData, null, 2);
            });
        }

        public showDbFiddler(): void {
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(new DbFiddlerViewModel(this._instapaperDB));
        }

        public listFolders(): WinJS.Promise<Codevoid.Storyvoid.IFolder[]> {
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

        public getCommandInformationForBookmarks(bookmarks: IBookmark[]): ICommandOptions[] {
            var commands: ICommandOptions[] = [];

            if (bookmarks.length === 1) {
                var openInBrowser = {
                    label: "Open in browser",
                    icon: "globe",
                    onclick: () => {
                        Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmarks[0].url));
                    }
                }

                commands.push(openInBrowser);
                var downloadCommand = {
                    label: "Download",
                    icon: "download",
                    onclick: () => {
                        Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists).then((folder) => {
                            var articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, folder);
                            articleSync.syncSingleArticle(bookmarks[0].bookmark_id, this._instapaperDB).then((bookmark) => {
                                Utilities.Logging.instance.log("File saved to: " + bookmark.localFolderRelativePath);
                            });
                        });
                    }
                };

                commands.push(downloadCommand);
            }

            if (this._currentFolderId === this.commonFolderDbIds.liked) {
                var unlikeCommand = {
                    label: "Unlike",
                    icon: "\uEA92",
                    onclick: () => {
                        this.unlike(bookmarks);
                    }
                };

                commands.push(unlikeCommand);
            } else {
                var deleteCommand = {
                    label: "Delete",
                    icon: "delete",
                    onclick: () => {
                        this.delete(bookmarks);
                    },
                };

                commands.push(deleteCommand);
            }

            var moveCommand = {
                label: "Move",
                icon: "movetofolder",
                onclick: (e: UIEvent) => {

                    var moveViewModel = new MoveToFolderViewModel(this._instapaperDB);
                    moveViewModel.move(bookmarks, <HTMLElement>e.currentTarget);
                },
            };

            commands.push(moveCommand);

            if (this._currentFolderId !== this.commonFolderDbIds.archive) {
                var archiveCommand = {
                    label: "Archive",
                    icon: "\uEC50",
                    onclick: () => {
                        this.archive(bookmarks);
                    }
                };

                commands.push(archiveCommand);
            }

            return commands;
        }

        public getCommandsForSelection(bookmarks: IBookmark[]): WinJS.UI.ICommand[] {
            var commandInfo = this.getCommandInformationForBookmarks(bookmarks);
            var commands = commandInfo.map((options: any) => {
                var instance = new WinJS.UI.Command(null, options);
                return instance;
            });
            
            return commands;
        }

        public delete(bookmarksToDelete: IBookmark[]): void {
            Utilities.serialize(bookmarksToDelete, (bookmark: IBookmark, index: number): WinJS.Promise<any> => {
                return this._instapaperDB.removeBookmark(bookmark.bookmark_id);
            });
        }

        public unlike(bookmarksToUnlike: IBookmark[]): void {
            Utilities.serialize(bookmarksToUnlike, (bookmark: IBookmark, index: number): WinJS.Promise<any> => {
                return this._instapaperDB.unlikeBookmark(bookmark.bookmark_id);
            });
        }

        public archive(bookmarksToArchive: IBookmark[]): void {
            Utilities.serialize(bookmarksToArchive, (bookmark: IBookmark, index: number): WinJS.Promise<any> => {
                return this._instapaperDB.moveBookmark(bookmark.bookmark_id, this.commonFolderDbIds.archive);
            });
        }

        public showArticle(bookmark: IBookmark, restoring: boolean): WinJS.Promise<any> {
            // if the local file path has gone AWOL, lets not load, and complete silently.
            if (!bookmark.localFolderRelativePath) {
                return this._promptToOpenBrowser(bookmark);
            }

            var viewer = new Codevoid.Storyvoid.UI.ArticleViewerViewModel(bookmark,
                this._instapaperDB);
            viewer.isRestoring = restoring;
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(viewer);

            return viewer.displayed;
        }

        private _promptToOpenBrowser(bookmark: IBookmark): WinJS.Promise<any> {
            var prompt = new Windows.UI.Popups.MessageDialog("This article wasn't able to be downloaded, would you like to open it in a web browser?", "Open in a web browser?");
            var commands = prompt.commands;
            commands.clear();

            var open = new Windows.UI.Popups.UICommand();
            open.label = "Open";
            open.invoked = (command: Windows.UI.Popups.UICommand) => {
                Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmark.url));
            };

            commands.push(open);
            commands.push(new Windows.UI.Popups.UICommand("No"));

            prompt.cancelCommandIndex = 1;
            prompt.defaultCommandIndex = 1;

            return prompt.showAsync();
        }

        public showSettings(): void {
            var settingsAvailable = !!WinJS.Utilities.getMember("Codevoid.Storyvoid.UI.SettingsPopupExperience");
            var settingsScripts = WinJS.Promise.as();

            // If settings namespace wasn't available, then we can assume
            // that the script file needs to be added in.
            if (!settingsAvailable) {
                var signal = new Codevoid.Utilities.Signal();
                settingsScripts = signal.promise;

                var scriptTag = document.createElement("script");
                scriptTag.addEventListener("load", () => {
                    signal.complete();
                });

                scriptTag.src = "/js/ui/SettingsPopupExperience.js";

                document.head.appendChild(scriptTag);
            }

            settingsScripts.done(() => {
                var settings = new Codevoid.Storyvoid.UI.SettingsPopupViewModel(this);
                Codevoid.UICore.Experiences.currentHost.addExperienceForModel(settings);
            });
        }

        public static get sorts(): ISortsInfo[] {
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
}