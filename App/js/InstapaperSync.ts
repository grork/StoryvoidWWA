namespace Codevoid.Storyvoid {
    import InstapaperApi = Codevoid.Storyvoid.InstapaperApi;
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;

    const SYNC_STATUS_UPDATE_EVENT_NAME = "syncstatusupdate";

    function isDefaultFolder(id: string): boolean {
        switch (id) {
            case InstapaperDBCommonFolderIds.Archive:
            case InstapaperDBCommonFolderIds.Liked:
            case InstapaperDBCommonFolderIds.Unread:
            case InstapaperDBCommonFolderIds.Orphaned:
                return true;

            default:
                return false;
        }
    }

    function handleRemoteInvalidOrMissingBookmarkIdError(err: { error: number }): void {
        // 1241 = Invalid or missing booimark ID
        if (err.error === 1241) {
            return;
        }

        throw err;
    }

    interface IFolderSyncOptions {
        readonly singleFolder: boolean;
        readonly folder: number;
        readonly cancellationSource: Utilities.CancellationSource;
        readonly didSyncFolders: boolean;
        readonly _testPerFolderCallback: Function;
        readonly skipOrphanCleanup: boolean;
    }

    export interface ISyncStatusUpdate {
        operation: string;
        title?: string;
    }

    export interface ISyncOptions {
        dbInstance?: InstapaperDB;
        folders?: boolean,
        bookmarks?: boolean,
        singleFolder?: boolean,
        folder?: number,
        cancellationSource?: Codevoid.Utilities.CancellationSource;
        skipOrphanCleanup?: boolean;
        _testPerFolderCallback?: any;
    }

    export enum InstapaperSyncStatus {
        start = "start",
        end = "end",
        foldersStart = "foldersStart",
        foldersEnd = "foldersEnd",
        bookmarksStart = "bookmarksStart",
        bookmarksEnd = "bookmarksEnd",
        bookmarkFolder = "bookmarkFolder",
        folder = "folder",
        bookmark = "bookmark",
    }

    export interface InstapaperSync {
        addEventListener(name: "syncstatusupdate", handler: (eventData: Utilities.EventObject<ISyncStatusUpdate>) => any, useCapture?: boolean): void;
    }

    export class InstapaperSync extends Utilities.EventSource {
        private _foldersStorage: Codevoid.Storyvoid.InstapaperApi.Folders = null;
        private _bookmarksStorage: Codevoid.Storyvoid.InstapaperApi.Bookmarks = null;

        public perFolderBookmarkLimits: { [id: string]: number } = { unread: 250 };
        public defaultBookmarkLimit: number = 10;

        constructor(private _clientInformation: Codevoid.OAuth.ClientInformation) {
            super();
        }

        private get _folders(): InstapaperApi.Folders {
            if (!this._foldersStorage) {
                this._foldersStorage = new InstapaperApi.Folders(this._clientInformation);
            }

            return this._foldersStorage;
        }

        private get _bookmarks(): InstapaperApi.Bookmarks {
            if (!this._bookmarksStorage) {
                this._bookmarksStorage = new InstapaperApi.Bookmarks(this._clientInformation);
            }

            return this._bookmarksStorage;
        }

        /// <summary>
        /// Used for pushing up a folder add that is local.
        /// This is needed because of the possibility that
        /// the folder we just added might be there already
        /// and we want to normalize what the faff is going
        /// on so that downstream handlers can have a
        /// consistent view of the world.
        ///
        /// Has mirror method for removing a folder.
        /// </summary>
        private async _addFolderPendingEdit(edit: IFolderPendingEdit, db: InstapaperDB): Promise<IFolder> {
            const localFolderOperation = db.getFolderByDbId(edit.folder_dbid);
            const remoteAddOperation = this._folders.add(edit.title);

            const local = await localFolderOperation;
            let remote: IFolder;
            try {
                remote = await remoteAddOperation;
            } catch (error) {
                // Error 1251 is the error that the folder with that name
                // is already on the server. If it's not that then theres
                // something else we'll need to do.
                if (error.error !== 1251/*User Folder has a folder with the same name*/) {
                    throw error;
                }

                // It was 1251, so lets find the folder on the server
                // (which requires the full list since theres no other
                // way to get a specific folder), and then return *that*
                // folders information to that the values of this promise
                // can complete and let us sync all the data.
                const remoteFolders = await this._folders.list()
                // reduce it down to the folder that was already there. note
                // that if we dont find it -- which we should -- all
                // hell is gonna break loose here.
                remote = remoteFolders.reduce((result, folder) => {
                    if (result) {
                        return result;
                    }

                    if (folder.title === edit.title) {
                        return folder;
                    }

                    return null;
                }, null);
            }

            // Copy properties over
            for (let key in remote) {
                local[key] = remote[key];
            }

            return db.updateFolder(local);
        }

        /// <summary>
        /// Used for pushing up a folder add that is local.
        /// This is needed because of the possibility that
        /// the folder we just added might be there already
        /// and we want to normalize what the faff is going
        /// on so that downstream handlers can have a
        /// consistent view of the world.
        ///
        /// Has mirror method for removing a folder.
        /// </summary>
        private async _removeFolderPendingEdit(edit: IFolderPendingEdit): Promise<void> {
            try {
                await this._folders.deleteFolder(edit.removedFolderId);
            } catch (error) {
                // Folder isn't present on the server, and since we're trying
                // to delete the thing anyway, this is ok.
                // 1242 = Invalid or missing folder ID
                // 1250 = Unexpected error
                if (error && (error.error === 1242 || error.error === 1250)) {
                    return;
                }

                throw error;
            }
        }

        private async _syncFolders(db: InstapaperDB, cancellationSource: Utilities.CancellationSource): Promise<void> {
            this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.foldersStart });

            const pendingEdits = await db.getPendingFolderEdits()
            await Codevoid.Utilities.serialize(pendingEdits, async (edit: IFolderPendingEdit) => {
                switch (edit.type) {
                    case InstapaperDBFolderChangeTypes.ADD:
                        await this._addFolderPendingEdit(edit, db);
                        break;

                    case InstapaperDBFolderChangeTypes.DELETE:
                        await this._removeFolderPendingEdit(edit);
                        break;

                    default:
                        window.appfail("Shouldn't see other edit types");
                        break;
                }

                await db.deletePendingFolderEdit(edit.id);
            }, 0, cancellationSource);

            const [remoteFolders, localFolders] = await Promise.all([
                this._folders.list(),
                db.listCurrentFolders()
            ]);

            if (cancellationSource.cancelled) {
                throw new Error("Folder Sync Cancelled after remote listing");
            }

            // Find all the changes from the remote server
            // that aren't locally for folders on the server
            const addFromRemote = remoteFolders.map(async (rf) => {
                const lf = await db.getFolderFromFolderId(rf.folder_id);

                // Notify that the remote folder w/ name had some changes
                this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, {
                    operation: Codevoid.Storyvoid.InstapaperSyncStatus.folder,
                    title: rf.title,
                });

                if (!lf) {
                    await db.addFolder(rf, true);
                } else {
                    // if the title or position has changed
                    // update those details locally
                    if ((rf.title !== lf.title) || (rf.position !== lf.position)) {
                        lf.title = rf.title;
                        lf.position = rf.position;
                        await db.updateFolder(lf);
                    }
                }
            });

            // Find all the folders that are not on the server, that
            // we have locally.
            const removeFromLocal = localFolders.map(async (item) => {
                // Default folders are ignored for any syncing behaviour
                // since they're uneditable.
                if (isDefaultFolder(item.folder_id)) {
                    return;
                }

                const isInRemote = remoteFolders.some((remoteItem) => remoteItem.folder_id === item.folder_id);

                if (!isInRemote) {
                    await db.removeFolder(item.id, true);
                }
            });

            await Promise.all(addFromRemote.concat(removeFromLocal));

            // Make sure there aren't any pending local edits, given we should have
            // sync'd everything.

            const edits = await db.getPendingFolderEdits();

            this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.foldersEnd });
            // No edits? NO worries!
            if (!edits || (edits.length < 1)) {
                return;
            }

            debugger;
            throw new Error("There are pending folder edits. Didn't expect any pending folder edits");
        }

        private async _syncBookmarks(db: InstapaperDB, options: IFolderSyncOptions): Promise<void> {
            let folders: IFolder[];
            let promise = Codevoid.Utilities.as();
            this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksStart });

            if (!options.singleFolder) {
                await this._syncBookmarkPendingAdds(db);
                const allFolders = await db.listCurrentFolders();
                let priorityFolder: IFolder;
                let priorityFolderIndex = -1;

                // When we're not syncing a single folder, but we're
                // still supplied with a folder, we're going to prioritize
                // that folder to be the first. The shuffle below basically
                // "sorts" the folder by placing the specific folder first.
                if (options.folder) {
                    priorityFolder = allFolders.filter((f, index) => {
                        if (f.folder_dbid === options.folder) {
                            priorityFolderIndex = index;
                            return true;
                        }

                        return false;
                    })[0];

                    // Now take the folder found and put it first.
                    if (priorityFolder && (priorityFolderIndex > -1)) {
                        allFolders.splice(priorityFolderIndex, 1);
                        allFolders.unshift(priorityFolder);
                    }
                }

                folders = allFolders;
            } else {
                const folder = await db.getFolderByDbId(options.folder);
                folders = [folder];
                if (!folder.folder_id) {
                    const edits = await db.getPendingFolderEdits();
                    const edit = edits.filter((e) => e.folder_dbid === folder.id)[0];

                    if (!edit) {
                        window.appfail("Even though the folder had no folder ID, it had no pending edit either...");
                        throw new Error("No pending edit for a folder with no folder ID");
                    }

                    // Before we do any other work, we need to make sure
                    // the the pending folder add was pushed up to the service.
                    await this._addFolderPendingEdit(edit, db)
                    const syncedFolder = await db.getFolderByDbId(folder.id)
                    folders = [syncedFolder];
                }
            }

            if (options.cancellationSource.cancelled) {
                throw new Error("Syncing Bookmarks Cancelled: After folders sync");
            }

            // If we've just sync'd the remote folders, theres no point
            // in us getting the remote list *AGAIN*, so just let it filter
            // based on the local folders
            let remoteFolders = folders;
            if (!options.didSyncFolders) {
                remoteFolders = await this._folders.list();
            }

            const remoteFolderIds: string[] = remoteFolders.map((rFolder) => rFolder.folder_id);
            const currentFolders = folders.filter((folder) => {
                switch (folder.folder_id) {
                    case InstapaperDBCommonFolderIds.Liked:
                    case InstapaperDBCommonFolderIds.Orphaned:
                        return false;

                    default:
                        return true;
                }
            });

            if (options.cancellationSource.cancelled) {
                throw new Error("Syncing Bookmarks Cancelled: After relisting remote folders");
            }

            // Folder by folder, sync the changes for that folder
            await Codevoid.Utilities.serialize(currentFolders, async (folder: IFolder) => {
                if (!isDefaultFolder(folder.folder_id)
                    && (remoteFolderIds.indexOf(folder.folder_id) === -1)) {
                    // If it's not a default folder, and the folder we're trying to sync
                    // isn't available remotely (E.g it's been deleted, or it's not there yet)
                    // we're going to give up for this specific folder
                    return;
                }

                this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarkFolder, title: folder.title });

                // No need to pass the cancellation source here because we're in
                // a serialized call so will be broken after each foler.
                await this._syncBookmarksForFolder(db, folder.id);

                if (options._testPerFolderCallback) {
                    options._testPerFolderCallback(folder.id);
                }
            }, 0, options.cancellationSource);

            await this._syncLikes(db);

            if (!options.skipOrphanCleanup && !options.singleFolder) {
                const orphans = await db.listCurrentBookmarks(db.commonFolderDbIds.orphaned);
                await Codevoid.Utilities.serialize(orphans, (orphan) => db.removeBookmark(orphan.bookmark_id, true));
            }

            const edits = db.getPendingBookmarkEdits((options.singleFolder ? options.folder : null));
            // Check that there are no orphaned pending edits for bookmarks. If there are, something has
            // gone very wrong
            let mergedEdits = [];

            Object.keys(edits).forEach((p) => {
                // No edits to merge
                if (!Array.isArray(edits[p])) {
                    return;
                }

                mergedEdits = mergedEdits.concat(edits[p]);
            });

            this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksEnd });

            if (!mergedEdits.length) {
                return;
            }

            debugger;
            throw new Error("There pending bookmark edits still found. Incomplete sync");
        }

        private async _syncBookmarkPendingAdds(db: InstapaperDB): Promise<void> {
            const b = this._bookmarks;

            const pendingAdds = await db.getPendingBookmarkAdds();
            await Codevoid.Utilities.serialize(pendingAdds, async (add: IBookmarkPendingEdit) => {
                await b.add({ url: add.url, title: add.title });
                await db.deletePendingBookmarkEdit(add.id);
            });
        }

        private async _syncBookmarksForFolder(db: InstapaperDB, dbIdOfFolderToSync: number): Promise<void> {
            const b = this._bookmarks;
            // First get the pending edits to work on
            const pendingEdits = await db.getPendingBookmarkEdits(dbIdOfFolderToSync);

            if (pendingEdits.moves) {
                await Codevoid.Utilities.serialize(pendingEdits.moves, async (move: IBookmarkPendingEdit) => {
                    switch (move.destinationfolder_dbid) {
                        case db.commonFolderDbIds.archive:
                            try {
                                await b.archive(move.bookmark_id);
                            } catch (e) { handleRemoteInvalidOrMissingBookmarkIdError(e); }
                            break;

                        case db.commonFolderDbIds.unread:
                            const bookmark = await db.getBookmarkByBookmarkId(move.bookmark_id);
                            await b.add({ url: bookmark.url });
                            break;

                        default:
                            const folder = await db.getFolderByDbId(move.destinationfolder_dbid);
                            if (folder) {
                                try {
                                    await b.move({ bookmark_id: move.bookmark_id, destination: folder.folder_id });
                                } catch (err) {
                                    if (err.error !== 1242 && err.error !== 1500) {
                                        handleRemoteInvalidOrMissingBookmarkIdError(err);
                                    }
                                }

                            }
                            break;
                    }

                    await db.deletePendingBookmarkEdit(move.id);
                });
            }

            // *Remote* Deletes
            if (pendingEdits.deletes) {
                await Codevoid.Utilities.serialize(pendingEdits.deletes, async (del: IBookmarkPendingEdit) => {
                    try {
                        await b.deleteBookmark(del.bookmark_id);
                    } catch (e) { handleRemoteInvalidOrMissingBookmarkIdError(e) }

                    await db.deletePendingBookmarkEdit(del.id);
                });
            }

            // Get the local data so we can look for oprphaned bookmarks
            const [folder, localBookmarks] = await Promise.all([
                db.getFolderByDbId(dbIdOfFolderToSync),
                db.listCurrentBookmarks(dbIdOfFolderToSync),
            ]);

            // Build the list of local "haves" for the folder we're
            // syncing, so that the server can update it's read progress
            // and tell us of any bookmarks that might have been removed
            // on the server, or also added.
            const folderId = folder.folder_id;
            const haves = localBookmarks.map<InstapaperApi.IHaveStatus>((bookmark) => {
                return {
                    id: bookmark.bookmark_id,
                    hash: bookmark.hash,
                    progress: bookmark.progress,
                    progressLastChanged: bookmark.progress_timestamp,
                };
            });

            const result = await b.list({
                folder_id: folderId,
                have: haves,
                limit: this.perFolderBookmarkLimits[folderId] || this.defaultBookmarkLimit,
            });

            // Now we've told the server what our local state is, and it's telling
            // us whats *different* from that state.
            const rb = result.bookmarks;
            const rd = result.meta || { delete_ids: null };
            let operations: PromiseLike<any>[] = [];

            this.dispatchEvent("bookmarkslistcompleted", { duration: result.duration });

            // Process any existing bookmarks. Note that this can included bookmarks
            // in this folder we aren't currently aware of (e.g. added), and ones we
            // think are in another folder. This also includes updating read progress
            // and other details.
            if (rb && rb.length) {
                operations = rb.map(async (bookmark) => {
                    let currentBookmark = await db.getBookmarkByBookmarkId(bookmark.bookmark_id);
                    if (!currentBookmark) {
                        bookmark.folder_dbid = dbIdOfFolderToSync;
                        bookmark.folder_id = folderId;
                    } else if (currentBookmark.folder_dbid !== dbIdOfFolderToSync) {
                        currentBookmark = await db.moveBookmark(bookmark.bookmark_id, dbIdOfFolderToSync, true);
                    }

                    // Since the server gave us the data in a non-typed format, lets
                    // faff with it and get into something that looks typed.
                    bookmark.starred = parseInt((<any>bookmark.starred), 10);
                    bookmark.progress = parseFloat(<any>bookmark.progress);

                    if (!currentBookmark) {
                        await db.addBookmark(bookmark);
                        return;
                    }

                    // The key here is to layer the updated values from the server
                    // on to the bookmark that we're about to put in the database.
                    // This is significant because otherwise, the put call will
                    // *REPLACE* the data for that key losing the folder information etc.
                    Object.keys(bookmark).forEach((p) => currentBookmark[p] = bookmark[p]);

                    await db.updateBookmark(currentBookmark);
                });
            }

            // The server returns any deletes in the folder as a string separated
            // by ,'s. So we need to split that apart for the bookmark_id's, and
            // then go remove them from the local database.
            if (rd.delete_ids) {
                // Note, the reduce is to _append_ the operations we're gonna wait on
                operations = operations.concat(rd.delete_ids.split(",").map(async (bookmark) => {
                    const bookmark_id = parseInt(bookmark);
                    await db.moveBookmark(bookmark_id, db.commonFolderDbIds.orphaned, true);
                }));
            }

            await Promise.all(operations);
        }

        private async _syncLikes(db: InstapaperDB): Promise<void> {
            const b = this._bookmarks;
            const edits = await db.getPendingBookmarkEdits();

            if (edits.likes && edits.likes.length) {
                // Push likes to the service
                await Codevoid.Utilities.serialize(edits.likes, async (edit: IBookmarkPendingEdit) => {
                    try {
                        await b.star(edit.bookmark_id);
                    } catch (e) {
                        handleRemoteInvalidOrMissingBookmarkIdError(e);
                    }

                    await db.deletePendingBookmarkEdit(edit.id);
                });
            }

            if (edits.unlikes && edits.unlikes.length) {
                // push the unlike edits to the service
                await Codevoid.Utilities.serialize(edits.unlikes, async (edit: IBookmarkPendingEdit) => {
                    try {
                        await b.unstar(edit.bookmark_id);
                    } catch (e) {
                        handleRemoteInvalidOrMissingBookmarkIdError(e);
                    }

                    await db.deletePendingBookmarkEdit(edit.id);
                });
            }

            // Now get the likes from the service.
            // 1. Calculate the haves for the like folder
            const localLikes = await db.listCurrentBookmarks(db.commonFolderDbIds.liked);
            const haves = localLikes.map<InstapaperApi.IHaveStatus>((bookmark) => {
                return {
                    id: bookmark.bookmark_id,
                    hash: bookmark.hash,
                };
            });

            // 2. List the like folder with the have's from the local state
            const remoteData = await b.list({
                folder_id: InstapaperDBCommonFolderIds.Liked,
                have: haves,
                limit: this.perFolderBookmarkLimits[InstapaperDBCommonFolderIds.Liked] || this.defaultBookmarkLimit,
            });

            // 3. Unlike / like as needed
            const rb = remoteData.bookmarks;
            const rd = remoteData.meta;
            // Since we're not going to leave a pending edit, we can just like & unlike the
            // remaining bookmarks irrespective of their existing state.
            let likeOperations = rb.map(async (rb) => {
                await db.likeBookmark(rb.bookmark_id, true, true)
            });

            let deleteOperations: Promise<void>[] = [];
            if (rd.delete_ids) {
                deleteOperations = rd.delete_ids.split(",").map(async (bookmark) => {
                    const bookmark_id = parseInt(bookmark);
                    await db.unlikeBookmark(bookmark_id, true);
                });
            }

            await Promise.all(likeOperations.concat(deleteOperations));
        }

        public async sync(options?: ISyncOptions): Promise<void> {
            options = options || { folders: true, bookmarks: true };
            const cancellationSource = options.cancellationSource || new Codevoid.Utilities.CancellationSource();
            const db = options.dbInstance || new InstapaperDB();

            try {
                if (!options.dbInstance) {
                    await db.initialize();
                }

                this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.start });

                if (options.folders && !cancellationSource.cancelled) {
                    await this._syncFolders(db, cancellationSource);
                }

                
                if (options.bookmarks && !cancellationSource.cancelled) {
                    await this._syncBookmarks(db, {
                        singleFolder: options.singleFolder,
                        folder: options.folder,
                        skipOrphanCleanup: options.skipOrphanCleanup,
                        _testPerFolderCallback: options._testPerFolderCallback,
                        didSyncFolders: options.folders,
                        cancellationSource: cancellationSource
                    });
                }
            } finally {
                this.dispatchEvent(SYNC_STATUS_UPDATE_EVENT_NAME, { operation: Codevoid.Storyvoid.InstapaperSyncStatus.end });
            }
        }
    }
}