﻿module Codevoid.Storyvoid.UI {
    const ARTICLES_FOLDER_NAME = "Articles";

    function logArticleDownloadTime(e: Utilities.EventObject<{ bookmark_id: number; articleDownloadDuration: number }>) {
        Telemetry.instance.track("ArticleBodyDownloaded", toPropertySet({ duration: e.detail.articleDownloadDuration }));
    }

    function sortOldestFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
        if (firstBookmark.time < secondBookmark.time) {
            return -1;
        } else if (firstBookmark.time > secondBookmark.time) {
            return 1;
        } else {
            return 0;
        }
    }

    function sortNewestFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
        if (firstBookmark.time < secondBookmark.time) {
            return 1;
        } else if (firstBookmark.time > secondBookmark.time) {
            return -1;
        } else {
            return 0;
        }
    }

    function sortMostProgressFirst(firstBookmark: IBookmark, secondBookmark: IBookmark): number {
        if (firstBookmark.progress < secondBookmark.progress) {
            return -1;
        } else if (firstBookmark.progress > secondBookmark.progress) {
            return 1;
        } else {
            return sortOldestFirst(firstBookmark, secondBookmark);
        }
    }

    async function cancelCancellationSourceWhenSpinnerCanceled(spinner: FullscreenSpinnerViewModel, cancellationSource: Utilities.CancellationSource): Promise<void> {
        const successful = await spinner.waitForCompletion();
        if (successful) {
            return;
        }

        cancellationSource.cancel();
    }

    export interface IFolderDetails {
        folder: IFolder;
        bookmarks: WinJS.Binding.ListBase<IBookmark>;
        hasBookmarks?: boolean;
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

    export interface ICommandOptions {
        label: string;
        tooltip?: string;
        icon: string;
        onclick: (e?: UIEvent) => void;
        keyCode: number;
        section?: string;
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
        private _currentSync: { signal: Codevoid.Utilities.Signal; cancellationSource: Codevoid.Utilities.CancellationSource };
        private _autoSyncWatcher: AutoSyncWatcher;
        private _jumpListIdleWriter: Utilities.Debounce;
        private _whatToRead: WhatToRead;
        private _wasSignedInAutomatically: boolean = false;

        constructor(private _app: IAppWithAbilityToSignIn) {
            this._eventSource = new Utilities.EventSource();
            this._clearCurrentSync();
        }

        private _clearCurrentSync(): void {
            this._currentSync = { signal: null, cancellationSource: null };
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
                case InstapaperDBFolderChangeTypes.UPDATE:
                    this._handleFoldersUpdated(detail);
                    break;

                case InstapaperDBFolderChangeTypes.DELETE:
                    this._handleFolderDeleted(detail);
                    break;
            }
        }

        private _handleFoldersUpdated(detail: IFoldersChangedEvent): void {
            // We only care about updates
            if (detail.operation !== InstapaperDBFolderChangeTypes.UPDATE) {
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
            if (detail.operation !== InstapaperDBFolderChangeTypes.DELETE) {
                return;
            }

            // Since the folder we're on was deleted, we should refresh
            // to some UI -- so switch to 'home'
            this.switchCurrentFolderTo(this._instapaperDB.commonFolderDbIds.unread);
        }

        private _handleBookmarksChanged(detail: IBookmarksChangedEvent): void {
            if (detail.operation === InstapaperDBBookmarkChangeTypes.MOVE) {
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
                    case InstapaperDBBookmarkChangeTypes.UPDATE:
                        this._handleBookmarkUpdated(detail);
                        break;

                    case InstapaperDBBookmarkChangeTypes.LIKE:
                        this._handleBookmarkAdded(detail);
                        break;

                    case InstapaperDBBookmarkChangeTypes.UNLIKE:
                        this._handleBookmarkDeleted(detail);
                        break;
                }

                return;
            }

            const folderId = detail.sourcefolder_dbid || detail.bookmark.folder_dbid;
            // Only care if the folder for this bookmark is of interest
            if (folderId != this._currentFolderDbId) {
                return;
            }

            switch (detail.operation) {
                case InstapaperDBBookmarkChangeTypes.LIKE:
                case InstapaperDBBookmarkChangeTypes.UNLIKE:
                case InstapaperDBBookmarkChangeTypes.UPDATE:
                    this._handleBookmarkUpdated(detail);
                    break;

                case InstapaperDBBookmarkChangeTypes.ADD:
                    this._handleBookmarkAdded(detail);
                    break;

                case InstapaperDBBookmarkChangeTypes.DELETE:
                    this._handleBookmarkDeleted(detail);
                    break;
            }
        }

        private _handleBookmarkMoved(detail: IBookmarksChangedEvent) {
            if (detail.sourcefolder_dbid === this._currentFolderDbId) {
                // since it's *from* this folder, and it's a move, this should be remapped to an delete:
                detail.operation = InstapaperDBBookmarkChangeTypes.DELETE;
                this._handleBookmarkDeleted(detail);
                return;
            }

            if (detail.destinationfolder_dbid === this._currentFolderDbId) {
                // If the destination maps to the folder we're looking at,
                // then we can map to an add
                detail.operation = InstapaperDBBookmarkChangeTypes.ADD;
                this._handleBookmarkAdded(detail);
                return;
            }
        }

        private _handleBookmarkUpdated(detail: IBookmarksChangedEvent): void {
            if (!this._currentBookmarks) {
                return;
            }

            // Don't care about non-update-like events
            switch (detail.operation) {
                case InstapaperDBBookmarkChangeTypes.UPDATE:
                case InstapaperDBBookmarkChangeTypes.LIKE:
                case InstapaperDBBookmarkChangeTypes.UNLIKE:
                    break;

                default:
                    return;
            }

            let indexOfBookmark: number;
            const boomarkWereLookingFor = this._currentBookmarks.some((bookmark: IBookmark, index: number) => {
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
            if ((detail.operation !== InstapaperDBBookmarkChangeTypes.ADD)
                && (detail.operation !== InstapaperDBBookmarkChangeTypes.LIKE)) {
                return;
            }

            this._currentBookmarks.push(detail.bookmark);
        }

        private _handleBookmarkDeleted(detail: IBookmarksChangedEvent): void {
            // Don't care about non-deletes
            if ((detail.operation !== InstapaperDBBookmarkChangeTypes.DELETE)
                && (detail.operation !== InstapaperDBBookmarkChangeTypes.UNLIKE)) {
                return;
            }

            let indexOfBookmark: number;
            const boomarkWereLookingFor = this._currentBookmarks.some((bookmark: IBookmark, index: number) => {
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

        private async _cleanupDownloadedArticles(): Promise<void> {
            try {
            const folder = await Windows.Storage.ApplicationData.current.localFolder.getFolderAsync(ARTICLES_FOLDER_NAME);
            await folder.deleteAsync();
            } catch(e) {
                // Kill all the errors!
                // Specifically, if it doesn't exist it'll fail to get the folder.
            };
        }

        private _listenForDbSyncNeeded() {
            const internetProfile = Windows.Networking.Connectivity.NetworkInformation;
            this._autoSyncWatcher = new AutoSyncWatcher(
                <Utilities.EventSource><any>this._instapaperDB,
                <Utilities.EventSource><any>Windows.UI.WebUI.WebUIApplication,
                <Utilities.EventSource><any>internetProfile);

            this._handlersToCleanUp.push(Utilities.addEventListeners(
                this._autoSyncWatcher.eventSource,
                {
                    syncneeded: this._handleSyncNeeded.bind(this),
                    cancelsync: this._handleCancelSync.bind(this),
                }
            ));
        }

        private async _handleSyncNeeded(ev: Utilities.EventObject<ISyncNeededEventArgs>): Promise<void> {
            try {
                await this.startSync(ev.detail.reason, {
                    noEvents: !ev.detail.showEvents
                });
            } catch (e) { }
            ev.detail.complete();
        }

        private _handleCancelSync(e: Utilities.EventObject<Windows.ApplicationModel.SuspendingDeferral>) {
            if (!this._currentSync.signal) {
                e.detail.complete();
                return;
            }

            this._currentSync.signal.promise.then(
                () => e.detail.complete(),
                () => e.detail.complete()
            );

            this._currentSync.cancellationSource.cancel();
        }

        private _startTrackingSyncForTelemetry(sync: InstapaperSync, reason: SyncReason): void {
            let foldersAdded = 0;
            let foldersRemoved = 0;
            let bookmarksAdded = 0;
            let bookmarksRemoved = 0;
            let vimeoLinksAdded = 0;
            let youtubeLinksAdded = 0;

            // Start timing the sync event
            Telemetry.instance.startTimedEvent("SyncCompleted");

            const dbEvents = Utilities.addEventListeners(this._instapaperDB, {
                bookmarkschanged: (eventData: Utilities.EventObject<IBookmarksChangedEvent>) => {
                    switch (eventData.detail.operation) {
                        case InstapaperDBBookmarkChangeTypes.ADD:
                            bookmarksAdded++;

                            try {
                                const uri = new Windows.Foundation.Uri(eventData.detail.bookmark.url);
                                if (uri.host.indexOf("youtube.com") > -1) {
                                    youtubeLinksAdded++;
                                }

                                if (uri.host.indexOf("vimeo.com") > -1) {
                                    vimeoLinksAdded++;
                                }
                            } catch (e) {
                                Telemetry.instance.track("MalformedBookmarkUrlCollectingVideoLinkType", null);
                            }
                            break;

                        case InstapaperDBBookmarkChangeTypes.DELETE:
                            bookmarksRemoved++;
                            break;
                    }

                    this._jumpListIdleWriter.bounce();
                },
                folderschanged: (eventData: Utilities.EventObject<IFoldersChangedEvent>) => {
                    switch (eventData.detail.operation) {
                        case InstapaperDBFolderChangeTypes.ADD:
                            foldersAdded++;
                            break;

                        case InstapaperDBFolderChangeTypes.DELETE:
                            foldersRemoved++;
                            break;
                    }

                    this._jumpListIdleWriter.bounce();
                },
            });

            const syncEvents = Utilities.addEventListeners(sync, {
                syncstatusupdate: (eventData: Utilities.EventObject<ISyncStatusUpdate>) => {
                    switch (eventData.detail.operation) {
                        case Codevoid.Storyvoid.InstapaperSyncStatus.end:
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
                            } else {
                                Telemetry.instance.updateProfile(Utilities.Mixpanel.UserProfileOperation.add, toPropertySet({
                                    nonEmptySyncs: 1,
                                }));
                            }

                            this._logTotalHomeAndFoldersForTelemetry();
                            this._jumpListIdleWriter.bounce();
                            break;
                    }
                },
                bookmarkslistcompleted: (e: Utilities.EventObject<{ duration: number }>) => {
                    Telemetry.instance.track("BookmarksListed", toPropertySet({ duration: e.detail.duration }));
                }
            });
        }

        private async _logTotalHomeAndFoldersForTelemetry(): Promise<void> {
            const [unreadArticles, folders] = await Promise.all([
                this._instapaperDB.listCurrentBookmarks(this._instapaperDB.commonFolderDbIds.unread),
                this._instapaperDB.listCurrentFolders()
            ]);

            const folderCount = folders.length - 4; // There are 4 fixed folders; we only care about the users own folders

            // We only want to log changes, not the same count every time.
            const telemetrySettings = new Settings.TelemetrySettings();
            if (telemetrySettings.lastFolderCountSeen != folderCount) {
                Telemetry.instance.track("FolderCountChanged", toPropertySet({ count: folderCount }));
                telemetrySettings.lastFolderCountSeen = folderCount;
            }

            if (telemetrySettings.lastHomeArticleCountSeen != unreadArticles.length) {
                Telemetry.instance.track("UnreadArticleCountChanged", toPropertySet({ count: unreadArticles.length }));
                telemetrySettings.lastHomeArticleCountSeen = unreadArticles.length;
            }
        }

        public async initializeDB(): Promise<void> {
            if (this._dbOpened) {
                return;
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

            this._whatToRead = new WhatToRead(this._instapaperDB);
            this._jumpListIdleWriter = new Utilities.Debounce(() => this._whatToRead.refreshJumplists(), 1_000);

            try {
                await this._instapaperDB.initialize();
                this._dbOpened = true;
                this._currentFolderDbId = this.commonFolderDbIds.unread;

                Utilities.Logging.instance.log("Initialized DB w/ folder ID: " + this._currentFolderDbId);
                this._pendingDbOpen.complete();
                this._pendingDbOpen = null;

                this._listenForDbSyncNeeded();
            } catch (e) {
                this._pendingDbOpen.error(e);
                this._pendingDbOpen = null;
            };
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

        public getBookmarkAtIndex(index: number): IBookmark {
            if (!this._currentFolder) {
                return null;
            }

            return this._currentFolder.bookmarks.getAt(index);
        }

        public async signOut(clearCredentials: boolean): Promise<any> {
            if (this._currentSync.cancellationSource) {
                this._currentSync.cancellationSource.cancel();
            }

            this._jumpListIdleWriter.cancel();

            this.disposeDB();

            Telemetry.instance.track("SignedOut", toPropertySet({ clearingCredentials: clearCredentials }));

            if (clearCredentials) {
                Codevoid.Storyvoid.Authenticator.clearClientInformation();
                this._app.signOut(true);
            }

            // No bookmark to share currently, so clear it
            Sharing.instance.bookmarkToShare = null;

            if (this._autoSyncWatcher) {
                this._autoSyncWatcher.dispose();
                this._autoSyncWatcher = null;
            }

            const idb = new Codevoid.Storyvoid.InstapaperDB();
            await idb.initialize();

            await Promise.all([
                idb.deleteAllData(),
                this._cleanupDownloadedArticles(),
                WhatToRead.clearJumpList(),
            ]);

            this._clientInformation = null;

            const viewerSettings = new Settings.ViewerSettings();
            viewerSettings.removeAllSettings();

            const syncSettings = new Settings.SyncSettings();
            syncSettings.removeAllSettings();

            let telemetrySettings = new Settings.TelemetrySettings();
            // Save setting about telemetery enbabled state
            const allowTelemetry = telemetrySettings.telemeteryCollectionEnabled;
            telemetrySettings.removeAllSettings();

            Telemetry.instance.clearSuperProperties();

            // Defer the the setting of the properties
            // and dispatching the event since there is
            // an occasional crash when clearing then
            // setting them.
            await Codevoid.Utilities.timeout();
            telemetrySettings = new Settings.TelemetrySettings();
            // Restore telemetry enabled state
            telemetrySettings.telemeteryCollectionEnabled = allowTelemetry;

            // Dispatch event after we've told the app to sign out
            // so that the animation plays w/ full content rather
            // than an empty state.
            this.events.dispatchEvent("signedout", null);
        }

        public async signedIn(usingSavedCredentials: boolean): Promise<any> {
            this._clientInformation = Codevoid.Storyvoid.Authenticator.getStoredCredentials();
            this._wasSignedInAutomatically = usingSavedCredentials;

            Telemetry.initializeIdentity();

            Telemetry.instance.track("SignedIn", toPropertySet({
                usedSavedCredentials: usingSavedCredentials,
                type: "app",
            }));

            await Promise.all([
                this.initializeDB(),
                this._readyForEvents.promise,
            ])

            // Try showing a saved article before doing the rest of the work.
            const transientSettings = new Settings.TransientSettings();
            let lastViewedArticleId = transientSettings.lastViewedArticleId;
            let originalUrl: Windows.Foundation.Uri = null;
            if (this._app.launchInformation && this._app.launchInformation.bookmark_id) {
                lastViewedArticleId = this._app.launchInformation.bookmark_id;
                originalUrl = this._app.launchInformation.originalUrl;
            }

            if (lastViewedArticleId != -1) {
                // Since we're restoring, we should try syncing the article progress
                // before showing it. We're trading off time/jank for correct state.
                // Note, that the article could have gone away, so we need to handle
                // the errors by dropping them silently.
                try {
                    await this.externallyInitiatedDisplayArticle(lastViewedArticleId, true, originalUrl);
                } catch (e) { }
                transientSettings.lastViewedArticleId = -1;
            }

            try {
                this.refreshCurrentFolder();

                // We just signed in, we should probably start a sync.
                // Probably need to factor something in w/ startup
                if (!usingSavedCredentials) {
                    await this.startSync(SyncReason.Initial, { dontWaitForDownloads: true });
                } else {
                    this.startSync(SyncReason.Launched);
                }

            } catch (e) { }
        }

        public processLaunchInformation(launchInformation: IAppLaunchInformation): void {
            if (launchInformation.bookmark_id < 1) {
                return;
            }

            this.externallyInitiatedDisplayArticle(launchInformation.bookmark_id, false, launchInformation.originalUrl);
        }

        public get wasAutomaticallySignedIn(): boolean {
            return this._wasSignedInAutomatically;
        }

        private _externallyInitiatedDisplayArticle: Utilities.CancellationSource;

        private async externallyInitiatedDisplayArticle(bookmark_id: number, isRestoring: boolean, originalUrl?: Windows.Foundation.Uri): Promise<void> {
            if (this._externallyInitiatedDisplayArticle) {
                this._externallyInitiatedDisplayArticle.cancel();
            }

            const localCancellationSource = this._externallyInitiatedDisplayArticle = new Utilities.CancellationSource();
            const spinner = new Codevoid.Storyvoid.UI.FullscreenSpinnerViewModel();
            spinner.show({ after: 2000 });

            // If the spinner is dismissed for cancellation reasons,
            // we need to cancel any more work, since we don't want
            // to show if the customer has given up
            cancelCancellationSourceWhenSpinnerCanceled(spinner, localCancellationSource);

            let bookmark = await this._instapaperDB.getBookmarkByBookmarkId(bookmark_id);
            if (!bookmark) {
                // Attempt to download it from the service, but do not
                // allow the promise chain to wait on it, so if the download
                // takes a really long time we're not sat at the splashscreen
                this.downloadFromServiceOrFallbackToUrl(bookmark_id, originalUrl, spinner, localCancellationSource);
                await Promise.race([
                    spinner.waitForCompletion(),
                    spinner.waitForVisible(),
                ]);
                return;
            } else {
                bookmark = await this.refreshBookmarkWithLatestReadProgress(bookmark);
            }

            return this.completeExternallyInitiatedArticleDisplay(bookmark, true, spinner, localCancellationSource);
        }

        private async downloadFromServiceOrFallbackToUrl(bookmark_id: number, originalUrl: Windows.Foundation.Uri, spinner: FullscreenSpinnerViewModel, cancellationSource: Utilities.CancellationSource): Promise<void> {
            const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(Codevoid.Storyvoid.Authenticator.getStoredCredentials());

            // Get the article state from the service
            let bookmark: IBookmark;
            try {
                bookmark = await bookmarksApi.updateReadProgress({
                    bookmark_id: bookmark_id,
                    progress: 0.0,
                    progress_timestamp: 1,
                });

                // Insert it as an orphan into the DB
                bookmark.folder_dbid = this._instapaperDB.commonFolderDbIds.orphaned;
                bookmark = await this._instapaperDB.addBookmark(bookmark);

                bookmark = await this.syncSingleArticle(bookmark);
            } catch (e) {
                if ((!e || (e.name !== "Canceled")) && originalUrl) {
                    // If there was an error downloading the article but not a cancellation
                    // then prompt to open in a browser
                    this.promptToOpenArticleThatCouldntBeFoundOnTheService(originalUrl);
                }

                bookmark = null;
            }

            // We were cancelled, clear anything so we don't present
            // the article to the user by accident.
            if (cancellationSource.cancelled) {
                bookmark = null;
            }

            await this.completeExternallyInitiatedArticleDisplay(bookmark, false, spinner, cancellationSource);
        }

        private async completeExternallyInitiatedArticleDisplay(article: IBookmark, isRestoring: boolean, spinner: FullscreenSpinnerViewModel, cancellationSource: Utilities.CancellationSource) {
            try {
                if (cancellationSource.cancelled) {
                    return;
                }

                try {
                    await this.showArticle(article, isRestoring);
                } catch (e) { }

            } finally {
                spinner.complete(true);
                if (this._externallyInitiatedDisplayArticle === cancellationSource) {
                    this._externallyInitiatedDisplayArticle = null;
                }
            }
        }

        private async refreshBookmarkWithLatestReadProgress(bookmark: IBookmark): Promise<IBookmark> {
            const bookmarkApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(Codevoid.Storyvoid.Authenticator.getStoredCredentials());
            // By updating with that we have, it'll return us a new one if there is one, otherwise
            // it'll just give us back the same item again.
            const updatedBookmark = await bookmarkApi.updateReadProgress({
                bookmark_id: bookmark.bookmark_id,
                progress: bookmark.progress,
                // We might not have had any progress yet, but the service might have had some
                // but we can't say 0 for timestamp, so we need to send a low number so as not
                // to accidently update the progress with our 0 value.
                progress_timestamp: bookmark.progress_timestamp || 1
            });
            
            bookmark.progress = updatedBookmark.progress;
            bookmark.progress_timestamp = updatedBookmark.progress_timestamp;
            return this._instapaperDB.updateBookmark(bookmark);
        }

        private promptToOpenArticleThatCouldntBeFoundOnTheService(originalUrl: Windows.Foundation.Uri): void {
            const prompt = new Windows.UI.Popups.MessageDialog("We couldn't download the article you wanted to open, would you like to open it in a web browser instead?", "Open in a web browser?");
            const commands = prompt.commands;
            commands.clear();

            const open = new Windows.UI.Popups.UICommand();
            open.label = "Open";
            open.invoked = (command: Windows.UI.Popups.UICommand) => {
                Windows.System.Launcher.launchUriAsync(originalUrl);
            };

            commands.push(open);
            commands.push(new Windows.UI.Popups.UICommand("No"));
            prompt.cancelCommandIndex = 1;
            prompt.defaultCommandIndex = 0;

            prompt.showAsync();
        }

        public signInCompleted(): void {
            this.events.dispatchEvent("signincomplete", null);
        }

        public async startSync(reason: SyncReason, parameters?: { skipArticleDownload?: boolean, noEvents?: boolean, dontWaitForDownloads?: boolean }): Promise<void> {
            if (this._currentSync.signal) {
                return this._currentSync.signal.promise;
            }

            // Don't try to sync if we're offline
            const internetProfile = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            if (!internetProfile || internetProfile.getNetworkConnectivityLevel() != Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess) {
                return;
            }

            parameters = parameters || {};

            const sync = new Codevoid.Storyvoid.InstapaperSync(this._clientInformation);
            const syncSettings = new Codevoid.Storyvoid.Settings.SyncSettings();
            this._currentSync = {
                signal: new Codevoid.Utilities.Signal(),
                cancellationSource: new Codevoid.Utilities.CancellationSource()
            };

            let cancellationSource = this._currentSync.cancellationSource;

            sync.perFolderBookmarkLimits[InstapaperDBCommonFolderIds.Unread] = syncSettings.homeArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDBCommonFolderIds.Archive] = syncSettings.archiveArticleLimit;
            sync.perFolderBookmarkLimits[InstapaperDBCommonFolderIds.Liked] = syncSettings.likedArticleLimit;
            sync.defaultBookmarkLimit = syncSettings.otherFoldersLimit;

            Utilities.Logging.instance.log("Starting Sync");

            sync.addEventListener("syncstatusupdate", (eventData) => {
                switch (eventData.detail.operation) {
                    case Codevoid.Storyvoid.InstapaperSyncStatus.start:
                        this._startTrackingSyncForTelemetry(sync, reason);
                        if (!parameters.noEvents) {
                            this.events.dispatchEvent("syncstarting", {
                                message: "Syncing your articles!",
                                cancel: () => cancellationSource.cancel()
                            });
                        }

                        Utilities.Logging.instance.log("Started");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.end:
                        Utilities.Logging.instance.log("Ended");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.foldersStart:
                        Utilities.Logging.instance.log("Folders Started");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.foldersEnd:
                        Utilities.Logging.instance.log("Folders Ended");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksStart:
                        Utilities.Logging.instance.log("Bookmarks Start");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksEnd:
                        Utilities.Logging.instance.log("Bookmarks End");
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.bookmarkFolder:
                        Utilities.Logging.instance.log("Syncing Folder: " + eventData.detail.title);
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.folder:
                        Utilities.Logging.instance.log("Folder Synced: " + eventData.detail.title);
                        break;

                    default:
                        Utilities.Logging.instance.log("Unknown Event: " + eventData.detail.operation);
                        break;
                }
            });

            const [_, folder] = await Promise.all([
                sync.sync({
                    dbInstance: this._instapaperDB,
                    folders: true,
                    bookmarks: true,
                    cancellationSource: cancellationSource
                }),
                Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists),
            ]);
        
            if (parameters.dontWaitForDownloads) {
                if (this._currentSync && this._currentSync.signal) {
                    this._currentSync.signal.complete();
                }
            }

            try {
                const articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, folder);

                Codevoid.Utilities.addEventListeners(articleSync.events, {
                    syncingarticlestarting: (e: Utilities.EventObject<{ title: string }>) => {
                        if (parameters.noEvents) {
                            return;
                        }

                        this.events.dispatchEvent("syncprogressupdate", {
                            message: "Syncing \"" + e.detail.title + "\"",
                        });
                    },
                    syncarticlebodycompleted: logArticleDownloadTime
                });

                if (!parameters.skipArticleDownload && this._instapaperDB) {
                    await articleSync.syncAllArticlesNotDownloaded(this._instapaperDB, cancellationSource);
                }

                if (this._instapaperDB) {
                    await articleSync.removeFilesForNotPresentArticles(this._instapaperDB);
                }

                Utilities.Logging.instance.log("Completed Sync");

                if (!parameters.noEvents) {
                    this._eventSource.dispatchEvent("synccompleted", null);
                }

                if (!parameters.dontWaitForDownloads && this._currentSync && this._currentSync.signal) {
                    this._currentSync.signal.complete();
                }
            } catch (e) {
                if (!parameters.dontWaitForDownloads && this._currentSync && this._currentSync.signal) {
                    this._currentSync.signal.error(e);
                }

                // Make sure we hide the sync status if there is an error
                if (!parameters.noEvents) {
                    this._eventSource.dispatchEvent("synccompleted", null);
                }

                Utilities.Logging.instance.log("Failed Sync:");
                Utilities.Logging.instance.log(JSON.stringify(e, null, 2), true);
            }

            const completionPromise = this._currentSync.signal.promise;
            this._clearCurrentSync();

            return completionPromise;
        }

        public async clearDb(): Promise<void> {
            this.disposeDB();
            const idb = new Codevoid.Storyvoid.InstapaperDB();

            try {
                await idb.initialize();
            } catch (e) { }

            idb.deleteAllData();
        }

        public async dumpDb(): Promise<string> {
            let dumpData = {};

            const database = await db.open({
                server: Codevoid.Storyvoid.InstapaperDB.DBName,
                version: Codevoid.Storyvoid.InstapaperDB.DBVersion,
            });

            const tablePromises: PromiseLike<any>[] = [];

            for (let i = 0; i < database.objectStoreNames.length; i++) {
                let tableName = database.objectStoreNames[i];
                tablePromises.push(
                    database.query(tableName).execute<any>().then((results) => dumpData[tableName] = results)
                );
            }

            await Promise.all(tablePromises);
            return JSON.stringify(dumpData, null, 2);
        }

        public showDbFiddler(): void {
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(new DbFiddlerViewModel(this._instapaperDB));
        }

        public async listFolders(): Promise<Codevoid.Storyvoid.IFolder[]> {
            let folders = await this._instapaperDB.listCurrentFolders();
            folders = folders.filter((item) => {
                if (item.localOnly) {
                    return false;
                }

                return true;
            });

            folders.sort((firstFolder: IFolder, secondFolder: IFolder): number => {
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

            return folders;
        }

        public async getDetailsForFolder(folderId: number): Promise<IFolderDetails> {
            const [folder, bookmarks] = await Promise.all([
                this._instapaperDB.getFolderByDbId(folderId),
                this._instapaperDB.listCurrentBookmarks(folderId),
            ]);

            // Save base list of bookmarks locally so we can mutate it based
            // on change notifications.
            this._currentBookmarks = new WinJS.Binding.List<IBookmark>(bookmarks);

            // However, return the projection to the person asking for the *sorted* list of bookmarks.
            return {
                folder: folder,
                bookmarks: this._currentBookmarks.createSorted(SignedInViewModel.sorts[this._currentSort].comparer),
                hasBookmarks: (bookmarks.length > 0)
            };
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

        public async refreshCurrentFolder(): Promise<void> {
            this._eventSource.dispatchEvent("folderchanging", null);

            try {
                const result = await this.getDetailsForFolder(this._currentFolderDbId);
                this._currentFolder = result;
                this._eventSource.dispatchEvent("folderchanged", result);
            } catch (e) {
                this._currentFolderDbId = -1;
            }
        }

        public changeSortTo(newSort: SortOption): void {
            if (this._currentSort === newSort) {
                return;
            }

            this._currentSort = newSort;
            this._eventSource.dispatchEvent("sortchanged", newSort);

            this.refreshCurrentFolder();
        }

        private async syncSingleArticle(bookmark: IBookmark): Promise<IBookmark> {
            const folder = await Windows.Storage.ApplicationData.current.localFolder.createFolderAsync("Articles", Windows.Storage.CreationCollisionOption.openIfExists);
            const articleSync = new Codevoid.Storyvoid.InstapaperArticleSync(this._clientInformation, folder);
            Utilities.addEventListeners(articleSync.events, { syncarticlebodycompleted: logArticleDownloadTime });

            const syncdBookmark = await articleSync.syncSingleArticle(bookmark.bookmark_id, this._instapaperDB, new Utilities.CancellationSource());
            Utilities.Logging.instance.log("File saved to: " + syncdBookmark.localFolderRelativePath);
            return syncdBookmark;
        }

        public getCommandInformationForBookmarks(bookmarks: IBookmark[]): ICommandOptions[] {
            const commands: ICommandOptions[] = [];

            if (bookmarks.length === 1) {
                const openInBrowser = {
                    label: "Open in browser",
                    icon: "globe",
                    tooltip: "Open article in your browser (V)",
                    onclick: () => {
                        Telemetry.instance.track("OpenInBrowser", toPropertySet({ location: "ArticleList" }));
                        Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmarks[0].url));

                        this.raiseCommandInvokedEvent();
                    },
                    keyCode: WinJS.Utilities.Key.v,
                }

                let isValidUri = true;
                try {
                    (new Windows.Foundation.Uri(bookmarks[0].url));
                } catch (e) {
                    isValidUri = false;
                }

                if (isValidUri) {
                    commands.push(openInBrowser);
                }

                const downloadCommand = {
                    label: "Download",
                    icon: "download",
                    tooltip: "Download article (D)",
                    onclick: () => {
                        Telemetry.instance.track("DownloadBookmark", toPropertySet({ location: "ArticleList" }));
                        this.syncSingleArticle(bookmarks[0]);
                        this.raiseCommandInvokedEvent();
                    },
                    keyCode: WinJS.Utilities.Key.d,
                };

                commands.push(downloadCommand);

                Sharing.instance.bookmarkToShare = bookmarks[0];
                const shareCommand = Sharing.instance.getShareCommand();
                shareCommand.tooltip = "Share article (S)";
                commands.push(shareCommand);
            }

            if (this._currentFolderDbId === this.commonFolderDbIds.liked) {
                const unlikeCommand = {
                    label: "Unlike",
                    icon: "\uEA92",
                    tooltip: "Unlike article(s) (L)",
                    onclick: () => {
                        this.unlike(bookmarks);
                        this.raiseCommandInvokedEvent();
                    },
                    keyCode: WinJS.Utilities.Key.u,
                };

                commands.push(unlikeCommand);
            } else {
                const deleteCommand = {
                    label: "Delete",
                    icon: "delete",
                    tooltip: "Delete article(s) (Delete)",
                    onclick: () => {
                        Telemetry.instance.track("DeletedBookmark", toPropertySet({ location: "ArticleList" }));
                        this.delete(bookmarks);
                        this.raiseCommandInvokedEvent();
                    },
                    keyCode: WinJS.Utilities.Key.deleteKey,
                };

                commands.push(deleteCommand);
            }

            const moveCommand = {
                label: "Move",
                icon: "movetofolder",
                tooltip: "Move to another folder (M)",
                onclick: async (e: UIEvent) => {
                    const moveViewModel = new MoveToFolderViewModel(this._instapaperDB);
                    const result = await moveViewModel.move(bookmarks, <HTMLElement>e.currentTarget);
                    this.raiseCommandInvokedEvent();

                    if (!result) {
                        return;
                    }

                    Telemetry.instance.track("MovedBookmark", toPropertySet({ location: "ArticleList" }));
                },
                keyCode: WinJS.Utilities.Key.m,
            };

            commands.push(moveCommand);

            if (this._currentFolderDbId !== this.commonFolderDbIds.archive) {
                const archiveCommand = {
                    label: "Archive",
                    icon: "\uE7B8",
                    tooltip: "Archive article(s) (A)",
                    onclick: () => {
                        Telemetry.instance.track("ArchiveBookmark", toPropertySet({ location: "ArticleList" }));

                        this.archive(bookmarks);
                        this.raiseCommandInvokedEvent();
                    },
                    keyCode: WinJS.Utilities.Key.a,
                };

                commands.push(archiveCommand);
            }

            return commands;
        }

        public getCommandsForSelection(bookmarks: IBookmark[]): WinJS.UI.ICommand[] {
            const commandInfo = this.getCommandInformationForBookmarks(bookmarks);
            const commands = commandInfo.map((options: any) => {
                const instance = new WinJS.UI.Command(null, options);
                return instance;
            });
            
            return commands;
        }

        public delete(bookmarksToDelete: IBookmark[]): void {
            Utilities.serialize(bookmarksToDelete, (bookmark: IBookmark, index: number): PromiseLike<any> => {
                return this._instapaperDB.removeBookmark(bookmark.bookmark_id);
            });
        }

        public unlike(bookmarksToUnlike: IBookmark[]): void {
            Utilities.serialize(bookmarksToUnlike, (bookmark: IBookmark, index: number): PromiseLike<any> => {
                return this._instapaperDB.unlikeBookmark(bookmark.bookmark_id);
            });
        }

        public archive(bookmarksToArchive: IBookmark[]): void {
            Utilities.serialize(bookmarksToArchive, (bookmark: IBookmark, index: number): PromiseLike<any> => {
                return this._instapaperDB.moveBookmark(bookmark.bookmark_id, this.commonFolderDbIds.archive);
            });
        }

        public showArticle(bookmark: IBookmark, restoring: boolean): PromiseLike<any> {
            // Sometimes the article has gone, but we thought we were viewing it, so
            // handle it by no-oping after clearing the saved article ID.
            if (!bookmark) {
                (new Settings.TransientSettings()).clearLastViewedArticleId();
                return Promise.resolve();
            }

            // if the local file path has gone AWOL, lets not load, and complete silently.
            if (!bookmark.localFolderRelativePath) {
                return this._promptToOpenBrowser(bookmark);
            }

            const viewer = new Codevoid.Storyvoid.UI.ArticleViewerViewModel(bookmark,
                this._instapaperDB);
            viewer.isRestoring = restoring;
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(viewer);

            let toDispose = Utilities.addEventListeners(viewer.eventSource, {
                closed: () => {
                    if (!toDispose) {
                        return;
                    }

                    toDispose.cancel();
                    toDispose = null;
                    this.events.dispatchEvent("articleclosed", null);
                }
            });

            return viewer.displayed;
        }

        private _promptToOpenBrowser(bookmark: IBookmark): PromiseLike<any> {
            const prompt = new Windows.UI.Popups.MessageDialog("This article wasn't able to be downloaded, would you like to open it in a web browser, or attempt to download it?", "Open in a web browser?");
            const commands = prompt.commands;

            let isValidUri = true;
            try {
                (new Windows.Foundation.Uri(bookmark.url));
            } catch (e) {
                isValidUri = false;
            }

            if (!isValidUri) {
                prompt.content = "This article can't be opened, sorry! It looks like it's not valid. Go to the original site to read it.";
                prompt.title = "Ruh-Roh!"

                return prompt.showAsync();
            }

            commands.clear();

            const open = new Windows.UI.Popups.UICommand();
            open.label = "Open";
            open.invoked = (command: Windows.UI.Popups.UICommand) => {
                Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(bookmark.url));
            };

            commands.push(open);

            const download = new Windows.UI.Popups.UICommand();
            download.label = "Download";
            download.invoked = (command: Windows.UI.Popups.UICommand) => {
                this.syncSingleArticle(bookmark);
            };

            commands.push(download);

            commands.push(new Windows.UI.Popups.UICommand("No"));

            prompt.cancelCommandIndex = 2;
            prompt.defaultCommandIndex = 0;

            return prompt.showAsync();
        }

        public async showSettings(): Promise<void> {
            const settingsAvailable = !!WinJS.Utilities.getMember("Codevoid.Storyvoid.UI.SettingsPopupExperience");

            // If settings namespace wasn't available, then we can assume
            // that the script file needs to be added in.
            if (!settingsAvailable) {
                const signal = new Codevoid.Utilities.Signal();

                const scriptTag = document.createElement("script");
                scriptTag.addEventListener("load", () => {
                    signal.complete();
                });

                scriptTag.src = "/js/ui/SettingsPopupExperience.js";

                document.head.appendChild(scriptTag);

                await signal.promise;
            }


            const settings = new Codevoid.Storyvoid.UI.SettingsPopupViewModel(this);
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(settings);
        }

        public uiPresented(): void {
            this.events.dispatchEvent("uipresented", null);
        }

        private raiseCommandInvokedEvent(): void {
            this._eventSource.dispatchEvent("commandInvoked", null);
        }

        public static get sorts(): ISortsInfo[] {
            if (!SignedInViewModel._sorts) {
                SignedInViewModel._sorts = [
                    { label: "Oldest", sort: SortOption.Oldest, comparer: sortOldestFirst },
                    { label: "Newest", sort: SortOption.Newest, comparer: sortNewestFirst },
                    { label: "Progress", sort: SortOption.Progress, comparer: sortMostProgressFirst },
                ];
            }

            return SignedInViewModel._sorts;
        }
    }
}