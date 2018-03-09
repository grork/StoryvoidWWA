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
        private _currentFolderDbId: number = -1;
        private _currentFolder: IFolderDetails;
        private _currentBookmarks: WinJS.Binding.List<IBookmark>;
        private _currentSort: SortOption = SortOption.Oldest;
        private _readyForEvents: Utilities.Signal = new Utilities.Signal();
        private static _sorts: ISortsInfo[];
        private _currentSyncSignal: Utilities.Signal;
        private _autoSyncWatcher: AutoSyncWatcher;
        private _inProgressSync: WinJS.Promise<any>;

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
            this._currentFolderDbId = -1;
            this._currentBookmarks = null;
            this._currentSort = SortOption.Oldest;
            this._instapaperDB.dispose();
            this._instapaperDB = null;
            this._dbOpened = false;
        }

        private _handleFoldersChanged(detail: IFoldersChangedEvent): void {
            // Only care if it's for the folder we're currently on
            if (detail.folder_dbid !== this._currentFolderDbId) {
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

            // If we're currently looking at the liked folder, then
            // we need to handle these behaviours a little differently
            // because the 'liked' folder is really a virtual folder, so
            // doesn't have things added/removed from it -- just like/unlike
            if (this._currentFolderDbId === this._instapaperDB.commonFolderDbIds.liked) {
                switch (detail.operation) {
                    case InstapaperDB.BookmarkChangeTypes.UPDATE:
                        this._handleBookmarkUpdated(detail);
                        break;

                    case InstapaperDB.BookmarkChangeTypes.LIKE:
                        this._handleBookmarkAdded(detail);
                        break;

                    case InstapaperDB.BookmarkChangeTypes.UNLIKE:
                        this._handleBookmarkDeleted(detail);
                        break;
                }

                return;
            }

            var folderId = detail.sourcefolder_dbid || detail.bookmark.folder_dbid;
            // Only care if the folder for this bookmark is of interest
            if (folderId != this._currentFolderDbId) {
                return;
            }

            switch (detail.operation) {
                case InstapaperDB.BookmarkChangeTypes.LIKE:
                case InstapaperDB.BookmarkChangeTypes.UNLIKE:
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
            if (detail.sourcefolder_dbid === this._currentFolderDbId) {
                // since it's *from* this folder, and it's a move, this should be remapped to an delete:
                detail.operation = InstapaperDB.BookmarkChangeTypes.DELETE;
                this._handleBookmarkDeleted(detail);
                return;
            }

            if (detail.destinationfolder_dbid === this._currentFolderDbId) {
                // If the destination maps to the folder we're looking at,
                // then we can map to an add
                detail.operation = InstapaperDB.BookmarkChangeTypes.ADD;
                this._handleBookmarkAdded(detail);
                return;
            }
        }

        private _handleBookmarkUpdated(detail: IBookmarksChangedEvent): void {
            // Don't care about non-update-like events
            switch (detail.operation) {
                case InstapaperDB.BookmarkChangeTypes.UPDATE:
                case InstapaperDB.BookmarkChangeTypes.LIKE:
                case InstapaperDB.BookmarkChangeTypes.UNLIKE:
                    break;

                default:
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
            if ((detail.operation !== InstapaperDB.BookmarkChangeTypes.ADD)
                && (detail.operation !== InstapaperDB.BookmarkChangeTypes.LIKE)) {
                return;
            }

            this._currentBookmarks.push(detail.bookmark);
        }

        private _handleBookmarkDeleted(detail: IBookmarksChangedEvent): void {
            // Don't care about non-deletes
            if ((detail.operation !== InstapaperDB.BookmarkChangeTypes.DELETE)
                && (detail.operation !== InstapaperDB.BookmarkChangeTypes.UNLIKE)) {
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

        private _listenForDbSyncNeeded() {
            var internetProfile = Windows.Networking.Connectivity.NetworkInformation;
            this._autoSyncWatcher = new AutoSyncWatcher(
                <Utilities.EventSource><any>this._instapaperDB,
                <Utilities.EventSource><any>Windows.UI.WebUI.WebUIApplication,
                <Utilities.EventSource><any>internetProfile);

            this._handlersToCleanUp.push(Utilities.addEventListeners(
                this._autoSyncWatcher.eventSource,
                { syncneeded: this._handleSyncNeeded.bind(this) }
            ));
        }

        private _handleSyncNeeded(ev: Utilities.EventObject<ISyncNeededEventArgs>) {
            this.startSync(ev.detail.reason, { skipArticleDownload: !ev.detail.shouldSyncArticleBodies, noEvents: !ev.detail.shouldSyncArticleBodies }).done(() => {
                ev.detail.complete();
            }, () => {
                ev.detail.complete();
            });
        }

        private _startTrackingSyncForTelemetry(sync: InstapaperSync, reason: SyncReason): void {
            var foldersAdded = 0;
            var foldersRemoved = 0;
            var bookmarksAdded = 0;
            var bookmarksRemoved = 0;
            var vimeoLinksAdded = 0;
            var youtubeLinksAdded = 0;

            // Start timing the sync event
            Telemetry.instance.startTimedEvent("SyncCompleted");

            var dbEvents = Utilities.addEventListeners(this._instapaperDB, {
                bookmarkschanged: (eventData: Utilities.EventObject<IBookmarksChangedEvent>) => {
                    switch (eventData.detail.operation) {
                        case InstapaperDB.BookmarkChangeTypes.ADD:
                            bookmarksAdded++;

                            var uri = new Windows.Foundation.Uri(eventData.detail.bookmark.url);
                            if (uri.host.indexOf("youtube.com") > -1) {
                                youtubeLinksAdded++;
                            }

                            if (uri.host.indexOf("vimeo.com") > -1) {
                                vimeoLinksAdded++;
                            }
                            break;

                        case InstapaperDB.BookmarkChangeTypes.DELETE:
                            bookmarksRemoved++;
                            break;
                    }
                },
                folderschanged: (eventData: Utilities.EventObject<IFoldersChangedEvent>) => {
                    switch (eventData.detail.operation) {
                        case InstapaperDB.FolderChangeTypes.ADD:
                            foldersAdded++;
                            break;

                        case InstapaperDB.FolderChangeTypes.DELETE:
                            foldersRemoved++;
                            break;
                    }
                },
            });

            var syncEvents = Utilities.addEventListeners(sync, {
                syncstatusupdate: (eventData: Utilities.EventObject<ISyncStatusUpdate>) => {
                    switch (eventData.detail.operation) {
                        case Codevoid.Storyvoid.InstapaperSync.Operation.end:
                            syncEvents.cancel();
                            dbEvents.cancel();

                            Telemetry.instance.track("SyncCompleted", toPropertySet({
                                bookmarksAdded: bookmarksAdded,
                                bookmarksRemoved: bookmarksRemoved,
                                foldersAdded: foldersAdded,
                                foldersRemoved: foldersRemoved,
                                youtubeLinksAdded: youtubeLinksAdded,
                                vimeoLinksAdded: vimeoLinksAdded,
                                reason: reason.toString()
                            }));

                            // We want to easily track how many empty syncs we have
                            if ((bookmarksAdded == 0)
                                && (bookmarksRemoved == 0)
                                && (foldersAdded == 0)
                                && (foldersRemoved == 0)) {
                                Telemetry.instance.track("EmptySync", null);
                            }

                            this._logTotalHomeAndFoldersForTelemetry();
                            break;
                    }
                }
            });
        }

        private _logTotalHomeAndFoldersForTelemetry(): void {
            WinJS.Promise.join({
                unreadArticleCount: this._instapaperDB.listCurrentBookmarks(this._instapaperDB.commonFolderDbIds.unread).then(articles => articles.length),
                folderCount: this._instapaperDB.listCurrentFolders().then((folders) => {
                    // There are 4 fixed folders; we only care about the users own folders
                    return folders.length - 4;
                })
            }).done((result: { unreadArticleCount: number, folderCount: number }) => {
                // We only want to log changes, not the same count every time.
                var telemetrySettings = new Settings.TelemetrySettings();
                if (telemetrySettings.lastFolderCountSeen != result.folderCount) {
                    Telemetry.instance.track("FolderCountChanged", toPropertySet({ count: result.folderCount }));
                    telemetrySettings.lastFolderCountSeen = result.folderCount;
                }

                if (telemetrySettings.lastHomeArticleCountSeen != result.unreadArticleCount) {
                    Telemetry.instance.track("UnreadArticleCountChanged", toPropertySet({ count: result.unreadArticleCount }));
                    telemetrySettings.lastHomeArticleCountSeen = result.unreadArticleCount;
                }
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
                this._currentFolderDbId = this.commonFolderDbIds.unread;

                Utilities.Logging.instance.log("Initialized DB w/ folder ID: " + this._currentFolderDbId);
                this._pendingDbOpen.complete();
                this._pendingDbOpen = null;

                this._listenForDbSyncNeeded();
                this.startSync(SyncReason.Launched);
            }, (e) => {
                this._pendingDbOpen.error(e);
                this._pendingDbOpen = null;
            });

            return this._pendingDbOpen.promise;
        }

        public readyForEvents(): void {
            this._readyForEvents.complete();
        }

        public get currentFolderDbId(): number {
            return this._currentFolderDbId;
        }

        public get currentFolderId(): string {
            if (!this._currentFolder || !this._currentFolder.folder) {
                return "";
            }

            return this._currentFolder.folder.folder_id;
        }

        public signOut(clearCredentials: boolean): WinJS.Promise<any> {
            this._inProgressSync.cancel();
            this.disposeDB();

            Telemetry.instance.track("SignedOut", toPropertySet({ clearingCredentials: clearCredentials }));

            if (clearCredentials) {
                Codevoid.Storyvoid.Authenticator.clearClientInformation();
                this._app.signOut(true);
            }

            if (this._autoSyncWatcher) {
                this._autoSyncWatcher.dispose();
                this._autoSyncWatcher = null;
            }

            var idb = new Codevoid.Storyvoid.InstapaperDB();
            return idb.initialize().then(() => {
                return WinJS.Promise.join([
                    idb.deleteAllData(),
                    this._cleanupDownloadedArticles()
                ]);
            }).then(() => {
                this._clientInformation = null;

                var viewerSettings = new Settings.ViewerSettings();
                viewerSettings.removeAllSettings();

                var syncSettings = new Settings.SyncSettings();
                syncSettings.removeAllSettings();

                var telemetrySettings = new Settings.TelemetrySettings();
                // Save setting about telemetery enbabled state
                var allowTelemetry = telemetrySettings.telemeteryCollectionEnabled;
                telemetrySettings.removeAllSettings();

                // Restore telemetry enabled state
                telemetrySettings.telemeteryCollectionEnabled = allowTelemetry;

                // Dispatch event after we've told the app to sign out
                // so that the animation plays w/ full content rather
                // than an empty state.
                this.events.dispatchEvent("signedout", null);

                Telemetry.instance.clearSuperProperties();
            });
        }

        public signedIn(usingSavedCredentials: boolean): WinJS.Promise<any> {
            this._clientInformation = Codevoid.Storyvoid.Authenticator.getStoredCredentials();
            var completedSignal = new Codevoid.Utilities.Signal();

            Telemetry.instance.track("SignedIn", toPropertySet({
                usedSavedCredentials: usingSavedCredentials,
                type: "app",
            }));

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
                    this.startSync(SyncReason.Initial, { dontWaitForDownloads: true }).done(() => {
                        completedSignal.complete();
                    });
                } else {
                    completedSignal.complete();
                }
            });

            return completedSignal.promise;
        }

        public signInCompleted(): void {
            this.events.dispatchEvent("signincomplete", null);
        }

        public startSync(reason: SyncReason, parameters?: { skipArticleDownload?: boolean, noEvents?: boolean, dontWaitForDownloads?: boolean }): WinJS.Promise<any> {
            if (this._currentSyncSignal) {
                return this._currentSyncSignal.promise;
            }

            // Don't try to sync if we're offline
            var internetProfile = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            if (!internetProfile || internetProfile.getNetworkConnectivityLevel() != Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess) {
                return WinJS.Promise.as();
            }

            parameters = parameters || {};

            var sync = new Codevoid.Storyvoid.InstapaperSync(this._clientInformation);
            var folderOperation = Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists);
            var articleSync: Codevoid.Storyvoid.InstapaperArticleSync;
            var syncSettings = new Codevoid.Storyvoid.Settings.SyncSettings();
            this._currentSyncSignal = new Codevoid.Utilities.Signal();

            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Unread] = syncSettings.homeArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Archive] = syncSettings.archiveArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDB.CommonFolderIds.Liked] = syncSettings.likedArticleLimit;

            Utilities.Logging.instance.log("Starting Sync");

            sync.addEventListener("syncstatusupdate", (eventData) => {
                switch (eventData.detail.operation) {
                    case Codevoid.Storyvoid.InstapaperSync.Operation.start:
                        this._startTrackingSyncForTelemetry(sync, reason);
                        if (!parameters.noEvents) {
                            this.events.dispatchEvent("syncstarting", { message: "Syncing your articles!" });
                        }

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

            this._inProgressSync = WinJS.Promise.join({
                sync: sync.sync({
                    dbInstance: this._instapaperDB,
                    folders: true,
                    bookmarks: true,
                }),
                folder: folderOperation,
            }).then((result) => {
                if (parameters.dontWaitForDownloads) {
                    if (this._currentSyncSignal) {
                        this._currentSyncSignal.complete();
                    }
                }

                articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, result.folder);

                Codevoid.Utilities.addEventListeners(articleSync.events, {
                    syncingarticlestarting: (e: Utilities.EventObject<{ title: string }>) => {
                        if (parameters.noEvents) {
                            return;
                        }

                        this.events.dispatchEvent("syncprogressupdate", {
                            message: "Syncing \"" + e.detail.title + "\"",
                        });
                    },
                });

                if (!parameters.skipArticleDownload) {
                    return articleSync.syncAllArticlesNotDownloaded(this._instapaperDB);
                }
            }).then(() => {
                return articleSync.removeFilesForNotPresentArticles(this._instapaperDB);
            }).then(() => {
                Utilities.Logging.instance.log("Completed Sync");

                if (!parameters.noEvents) {
                    this._eventSource.dispatchEvent("synccompleted", null);
                }

                if (this._currentSyncSignal) {
                    this._currentSyncSignal.complete();
                }
            }, (e) => {
                this._inProgressSync = null;
                if (this._currentSyncSignal) {
                    this._currentSyncSignal.complete();
                }

                // Make sure we hide the sync status if there is an error
                if (!parameters.noEvents) {
                    this._eventSource.dispatchEvent("synccompleted", null);
                }

                Utilities.Logging.instance.log("Failed Sync:");
                Utilities.Logging.instance.log(JSON.stringify(e, null, 2), true);
            });

            return this._currentSyncSignal.promise.then(() => {
                this._currentSyncSignal = null;
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
                    hasBookmarks: (result.bookmarks.length > 0)
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
            if (this._currentFolderDbId === folderId) {
                return;
            }

            this._currentFolder = null;
            this._currentFolderDbId = folderId;

            this.refreshCurrentFolder();
        }

        public refreshCurrentFolder(): void {
            this._eventSource.dispatchEvent("folderchanging", null);

            this.getDetailsForFolder(this._currentFolderDbId).done((result) => {
                this._currentFolder = result;
                this._eventSource.dispatchEvent("folderchanged", result);
            }, () => {
                this._currentFolderDbId = -1;
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
                        Telemetry.instance.track("OpenInBrowser", toPropertySet({ location: "ArticleList" }));
                        Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmarks[0].url));
                    }
                }

                commands.push(openInBrowser);
                var downloadCommand = {
                    label: "Download",
                    icon: "download",
                    onclick: () => {
                        Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists).then((folder) => {
                            Telemetry.instance.track("DownloadBookmark", toPropertySet({ location: "ArticleList" }));
                            var articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, folder);
                            articleSync.syncSingleArticle(bookmarks[0].bookmark_id, this._instapaperDB).then((bookmark) => {
                                Utilities.Logging.instance.log("File saved to: " + bookmark.localFolderRelativePath);
                            });
                        });
                    }
                };

                commands.push(downloadCommand);
            }

            if (this._currentFolderDbId === this.commonFolderDbIds.liked) {
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
                        Telemetry.instance.track("DeletedBookmark", toPropertySet({ location: "ArticleList" }));
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
                    moveViewModel.move(bookmarks, <HTMLElement>e.currentTarget).done((result: boolean) => {
                        if (!result) {
                            return;
                        }

                        Telemetry.instance.track("MovedBookmark", toPropertySet({ location: "ArticleList" }));
                    });
                },
            };

            commands.push(moveCommand);

            if (this._currentFolderDbId !== this.commonFolderDbIds.archive) {
                var archiveCommand = {
                    label: "Archive",
                    icon: "\uEC50",
                    onclick: () => {
                        Telemetry.instance.track("ArchiveBookmark", toPropertySet({ location: "ArticleList" }));
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
            // Sometimes the article has gone, but we thought we were viewing it, so
            // handle it by no-oping after clearing the saved article ID.
            if (restoring && !bookmark) {
                (new Settings.TransientSettings()).clearLastViewedArticleId();
                return WinJS.Promise.as();
            }

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
            var prompt = new Windows.UI.Popups.MessageDialog("This article wasn't able to be downloaded, would you like to open it in a web browser, or attempt to download it?", "Open in a web browser?");
            var commands = prompt.commands;
            commands.clear();

            var open = new Windows.UI.Popups.UICommand();
            open.label = "Open";
            open.invoked = (command: Windows.UI.Popups.UICommand) => {
                Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmark.url));
            };

            commands.push(open);

            var download = new Windows.UI.Popups.UICommand();
            download.label = "Download";
            download.invoked = (command: Windows.UI.Popups.UICommand) => {
                Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists).then((folder) => {
                    var articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, folder);
                    articleSync.syncSingleArticle(bookmark.bookmark_id, this._instapaperDB).then((bookmark) => {
                        Utilities.Logging.instance.log("File saved to: " + bookmark.localFolderRelativePath);
                    });
                });
            };

            commands.push(download);

            commands.push(new Windows.UI.Popups.UICommand("No"));

            prompt.cancelCommandIndex = 2;
            prompt.defaultCommandIndex = 0;

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