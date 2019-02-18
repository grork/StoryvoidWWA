namespace Codevoid.Storyvoid {
    import InstapaperApi = Codevoid.Storyvoid.InstapaperApi;
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;

    function isDefaultFolder(id: string): boolean {
        switch (id) {
            case InstapaperDB.CommonFolderIds.Archive:
            case InstapaperDB.CommonFolderIds.Liked:
            case InstapaperDB.CommonFolderIds.Unread:
            case InstapaperDB.CommonFolderIds.Orphaned:
                return true;

            default:
                return false;
        }
    }

    function handleRemote1241Error(err: { error: number }): WinJS.Promise<any> {
        if (err.error === 1241) {
            return;
        }

        return WinJS.Promise.wrapError(err);
    }

    interface IFolderSyncOptions {
        readonly singleFolder: boolean;
        readonly folder: number;
        readonly cancellationSource: Utilities.CancellationSource;
        readonly didSyncFolders: boolean;
        readonly _testPerFolderCallback: Function;
        readonly skipOrphanCleanup: boolean;
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

        private _raiseStatusChanged(payload: ISyncStatusUpdate): void {
            this.dispatchEvent("syncstatusupdate", payload);
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
        private _addFolderPendingEdit(edit: IFolderPendingEdit, db: InstapaperDB): WinJS.Promise<IFolder> {
            return WinJS.Promise.join({
                local: db.getFolderByDbId(edit.folder_dbid),
                remote: this._folders.add(edit.title).then(null, (error) => {
                    // Error 1251 is the error that the folder with that name
                    // is already on the server. If it's not that then theres
                    // something else we'll need to do.
                    if (error.error !== 1251) {
                        return WinJS.Promise.wrapError(error);
                    }

                    // It was 1251, so lets find the folder on the server
                    // (which requires the full list since theres no other
                    // way to get a specific folder), and then return *that*
                    // folders information to that the values of this promise
                    // can complete and let us sync all the data.
                    return this._folders.list().then((remoteFolders) => {
                        // reduce it down to the folder that was already there. note
                        // that if we dont find it -- which we should -- all
                        // hell is gonna break loose here.
                        return remoteFolders.reduce((result, folder) => {
                            if (result) {
                                return result;
                            }

                            if (folder.title === edit.title) {
                                return folder;
                            }

                            return null;
                        }, null);
                    });
                }),
            }).then((data) => {
                Object.keys(data.remote).forEach((key) => {
                    data.local[key] = data.remote[key];
                });

                return db.updateFolder(data.local);
            });
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
        private _removeFolderPendingEdit(edit: IFolderPendingEdit): WinJS.Promise<void> {
            return this._folders.deleteFolder(edit.removedFolderId).then(null, (error) => {
                // Folder isn't present on the server, and since we're trying
                // to delete the thing anyway, this is ok.
                if (error && (error.error === 1242 || error.error === 1250)) {
                    return;
                }

                return WinJS.Promise.wrapError(error);
            });
        }

        private _syncFolders(db: InstapaperDB, cancellationSource: Utilities.CancellationSource): WinJS.Promise<void> {
            this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.foldersStart });

            return db.getPendingFolderEdits().then((pendingEdits) => {
                return Codevoid.Utilities.serialize(pendingEdits, (edit) => {
                    let syncPromise;
                    switch (edit.type) {
                        case InstapaperDB.FolderChangeTypes.ADD:
                            syncPromise = this._addFolderPendingEdit(edit, db);
                            break;

                        case InstapaperDB.FolderChangeTypes.DELETE:
                            syncPromise = this._removeFolderPendingEdit(edit);
                            break;

                        default:
                            window.appfail("Shouldn't see other edit types");
                            break;
                    }

                    if (syncPromise) {
                        return syncPromise.then(() => db.deletePendingFolderEdit(edit.id));
                    }
                }, 0, cancellationSource);
            }).then(() => {
                return WinJS.Promise.join({
                    remoteFolders: this._folders.list(),
                    localFolders: db.listCurrentFolders(),
                });
            }).then((data: { remoteFolders: IFolder[]; localFolders: IFolder[] }) => {
                if (cancellationSource.cancelled) {
                    return WinJS.Promise.wrapError(new Error("Folder Sync Cancelled after remote listing"));
                }

                // Find all the changes from the remote server
                // that aren't locally for folders on the server
                let syncs = data.remoteFolders.reduce<WinJS.Promise<any>[]>((data, rf) => {
                    const synced = db.getFolderFromFolderId(rf.folder_id).then((lf) => {
                        let done: WinJS.Promise<IFolder> = WinJS.Promise.as();

                        // Notify that the remote folder w/ name had some changes
                        this._raiseStatusChanged({
                            operation: Codevoid.Storyvoid.InstapaperSyncStatus.folder,
                            title: rf.title,
                        });

                        if (!lf) {
                            done = db.addFolder(rf, true);
                        } else {
                            // if the title or position has changed
                            // update those details locally
                            if ((rf.title !== lf.title) || (rf.position !== lf.position)) {
                                lf.title = rf.title;
                                lf.position = rf.position;
                                done = db.updateFolder(lf);
                            }
                        }

                        return done;
                    });

                    data.push(synced);
                    return data;
                }, []);

                // Find all the folders that are not on the server, that
                // we have locally.
                syncs = data.localFolders.reduce((promises, item) => {
                    // Default folders are ignored for any syncing behaviour
                    // since they're uneditable.
                    if (isDefaultFolder(item.folder_id)) {
                        return promises;
                    }

                    const isInRemote = data.remoteFolders.some((remoteItem) => remoteItem.folder_id === item.folder_id);

                    if (!isInRemote) {
                        promises.push(db.removeFolder(item.id, true));
                    }
                    return promises;
                }, syncs);

                return WinJS.Promise.join(syncs);
            }).then(() => {
                // Make sure there aren't any pending local edits, given we should have
                // sync'd everything.

                return db.getPendingFolderEdits().then((edits) => {
                    this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.foldersEnd });
                    // No edits? NO worries!
                    if (!edits || (edits.length < 1)) {
                        return;
                    }

                    debugger;
                    return <any>WinJS.Promise.wrapError(new Error("There are pending folder edits. Didn't expect any pending folder edits"));
                });
            });
        }

        private _syncBookmarks(db: InstapaperDB, options: IFolderSyncOptions): WinJS.Promise<void> {
            let promise = WinJS.Promise.as();
            this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksStart });

            if (!options.singleFolder) {
                promise = this._syncBookmarkPendingAdds(db).then(() => db.listCurrentFolders()).then((allFolders) => {
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

                    return allFolders;
                });
            } else {
                promise = db.getFolderByDbId(options.folder).then((folder) => {
                    if (folder.folder_id) {
                        return [folder];
                    }

                    return db.getPendingFolderEdits().then((edits) => {
                        const edit = edits.filter((e) => e.folder_dbid === folder.id)[0];

                        if (!edit) {
                            window.appfail("Even though the folder had no folder ID, it had no pending edit either...");
                            return WinJS.Promise.wrapError(new Error("No pending edit for a folder with no folder ID"));
                        }

                        // Before we do any other work, we need to make sure
                        // the the pending folder add was pushed up to the service.
                        return this._addFolderPendingEdit(edit, db).then(() => db.getFolderByDbId(folder.id)).then((syncedFolder) => [syncedFolder]);
                    });
                });
            }

            return promise.then((folders: IFolder[]) => {
                if (options.cancellationSource.cancelled) {
                    return WinJS.Promise.wrapError(new Error("Syncing Bookmarks Cancelled: After folders sync"));
                }

                // If we've just sync'd the remote folders, theres no point
                // in us getting the remote list *AGAIN*, so just let it filter
                // based on the local folders
                const remoteFolders = options.didSyncFolders ? WinJS.Promise.as(folders) : this._folders.list();
                return WinJS.Promise.join({
                    currentFolders: folders,
                    // Map the remote folders to easy look up if it's present or not
                    remoteFolders: remoteFolders.then((rFolders) => rFolders.map((rFolder) => rFolder.folder_id)),
                });
            }).then((data: { currentFolders: IFolder[]; remoteFolders: string[] }) => {
                if (options.cancellationSource.cancelled) {
                    return WinJS.Promise.wrapError(new Error("Syncing Bookmarks Cancelled: After relisting remote folders"));
                }

                const currentFolders = data.currentFolders.filter((folder) => {
                    switch (folder.folder_id) {
                        case InstapaperDB.CommonFolderIds.Liked:
                        case InstapaperDB.CommonFolderIds.Orphaned:
                            return false;

                        default:
                            return true;
                    }
                });

                return Codevoid.Utilities.serialize(currentFolders, (folder: IFolder) => {
                    if (!isDefaultFolder(folder.folder_id)
                        && (data.remoteFolders.indexOf(folder.folder_id) === -1)) {
                        // If it's not a default folder, and the folder we're trying to sync
                        // isn't available remotely (E.g it's been deleted, or it's not there yet)
                        // we're going to give up for this specific folder
                        return;
                    }

                    this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarkFolder, title: folder.title });

                    // No need to pass the cancellation source here because we're in
                    // a serialized call so will be broken after each foler.
                    return this._syncBookmarksForFolder(db, folder.id).then(() => {
                        if (options._testPerFolderCallback) {
                            options._testPerFolderCallback(folder.id);
                        }

                        return WinJS.Promise.timeout();
                    });
                }, 0, options.cancellationSource);
            }).then(() => this._syncLikes(db)).then(() => {
                if (options.skipOrphanCleanup || options.singleFolder) {
                    return;
                }

                return db.listCurrentBookmarks(db.commonFolderDbIds.orphaned).then((orphans) => {
                    return Codevoid.Utilities.serialize(orphans, (orphan) => db.removeBookmark(orphan.bookmark_id, true));
                });
            }).then(() => db.getPendingBookmarkEdits((options.singleFolder ? options.folder : null))).then((edits) => {
                // Check that there are no orphaned pending edits for bookmarks. If there are, something has
                // gone very wrong
                const mergedEdits = [];

                Object.keys(edits).forEach((p) => {
                    // No edits to merge
                    if (!Array.isArray(edits[p])) {
                        return;
                    }

                    mergedEdits.concat(edits[p]);
                });

                this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksEnd });

                if (!mergedEdits.length) {
                    return;
                }

                debugger;
                return <any>WinJS.Promise.wrapError(new Error("There pending bookmark edits still found. Incomplete sync"));
            });
        }

        private _syncBookmarkPendingAdds(db: InstapaperDB): WinJS.Promise<void> {
            const b = this._bookmarks;

            return db.getPendingBookmarkAdds().then((pendingAdds) => {
                return Codevoid.Utilities.serialize(pendingAdds, (add: IBookmarkPendingEdit) => {
                    return b.add({
                        url: add.url,
                        title: add.title,
                    }).then(() => db.deletePendingBookmarkEdit(add.id));
                });
            });
        }

        private _syncBookmarksForFolder(db: InstapaperDB, dbIdOfFolderToSync: number): WinJS.Promise<void> {
            const b = this._bookmarks;
            let folderId: string;
            let pendingEdits: IBookmarkPendingEdits;

            // First get the pending edits to work on
            return db.getPendingBookmarkEdits(dbIdOfFolderToSync).then((edits) => {
                pendingEdits = edits;

                // Moves
                if (!pendingEdits.moves) {
                    return;
                }

                return Codevoid.Utilities.serialize(pendingEdits.moves, (move: IBookmarkPendingEdit) => {
                    let operation: WinJS.Promise<IBookmark | IFolder>;

                    switch (move.destinationfolder_dbid) {
                        case db.commonFolderDbIds.archive:
                            operation = b.archive(move.bookmark_id).then(null, handleRemote1241Error);
                            break;

                        case db.commonFolderDbIds.unread:
                            operation = db.getBookmarkByBookmarkId(move.bookmark_id).then((bookmark) => b.add({ url: bookmark.url }));
                            break;

                        default:
                            operation = db.getFolderByDbId(move.destinationfolder_dbid).then((folder) => {
                                if (!folder) {
                                    return;
                                }

                                return b.move({ bookmark_id: move.bookmark_id, destination: folder.folder_id }).then(null, (err) => {
                                    if (err.error === 1242 || err.error === 1500) {
                                        return;
                                    }

                                    return handleRemote1241Error(err);
                                });
                            });
                            break;
                    }

                    return operation.then(() => db.deletePendingBookmarkEdit(move.id));
                });
            }).then(() => {
                // *Remote* Deletes
                if (!pendingEdits.deletes) {
                    return;
                }

                return Codevoid.Utilities.serialize(pendingEdits.deletes, (del: IBookmarkPendingEdit) => {
                    return b.deleteBookmark(del.bookmark_id).then(null, handleRemote1241Error).then(() => db.deletePendingBookmarkEdit(del.id));
                });
            }).then(() => {
                // Wait for the operations to complete, and return the local data
                // so we can look for oprphaned bookmarks
                return WinJS.Promise.join({
                    folder: db.getFolderByDbId(dbIdOfFolderToSync),
                    localBookmarks: db.listCurrentBookmarks(dbIdOfFolderToSync),
                });
            }).then((data: { folder: IFolder; localBookmarks: IBookmark[] }) => {
                // Build the list of local "haves" for the folder we're
                // syncing, so that the server can update it's read progress
                // and tell us of any bookmarks that might have been removed
                // on the server, or also added.
                folderId = data.folder.folder_id;
                const localBookmarks = data.localBookmarks;
                const haves = localBookmarks.map<InstapaperApi.IHaveStatus>((bookmark) => {
                    return {
                        id: bookmark.bookmark_id,
                        hash: bookmark.hash,
                        progress: bookmark.progress,
                        progressLastChanged: bookmark.progress_timestamp,
                    };
                });

                return b.list({
                    folder_id: folderId,
                    have: haves,
                    limit: this.perFolderBookmarkLimits[folderId] || this.defaultBookmarkLimit,
                });
            }).then((result: InstapaperApi.IBookmarkListResult) => {
                // Now we've told the server what our local state is, and it's telling
                // us whats *different* from that state.
                const rb = result.bookmarks;
                const rd = result.meta || { delete_ids: null };
                let operations: WinJS.Promise<IBookmark>[] = [];

                this.dispatchEvent("bookmarkslistcompleted", { duration: result.duration });

                // Process any existing bookmarks. Note that this can included bookmarks
                // in this folder we aren't currently aware of (e.g. added), and ones we
                // think are in another folder. This also includes updating read progress
                // and other details.
                if (rb && rb.length) {
                    operations = rb.reduce((data, bookmark) => {
                        const work = db.getBookmarkByBookmarkId(bookmark.bookmark_id).then((currentBookmark) => {
                            if (!currentBookmark) {
                                bookmark.folder_dbid = dbIdOfFolderToSync;
                                bookmark.folder_id = folderId;
                                return;
                            }

                            if (currentBookmark.folder_dbid !== dbIdOfFolderToSync) {
                                return db.moveBookmark(bookmark.bookmark_id, dbIdOfFolderToSync, true);
                            }

                            return currentBookmark;
                        }).then((current: IBookmark) =>{
                            // Since the server gave us the data in a non-typed format, lets
                            // faff with it and get into something that looks typed.
                            bookmark.starred = parseInt((<any>bookmark.starred), 10);
                            bookmark.progress = parseFloat(<any>bookmark.progress);

                            if (!current) {
                                return db.addBookmark(bookmark);
                            }

                            // The key here is to layer the updated values from the server
                            // on to the bookmark that we're about to put in the database.
                            // This is significant because otherwise, the put call will
                            // *REPLACE* the data for that key losing the folder information etc.
                            Object.keys(bookmark).forEach((p) => current[p] = bookmark[p]);

                            return db.updateBookmark(current);
                        });

                        // Do the update
                        data.push(work);
                        return data;
                    }, operations);
                }

                // The server returns any deletes in the folder as a string separated
                // by ,'s. So we need to split that apart for the bookmark_id's, and
                // then go remove them from the local database.
                if (rd.delete_ids) {
                    // Note, the reduce is to _append_ the operations we're gonna wait on
                    operations = rd.delete_ids.split(",").reduce((data, bookmark) => {
                        const bookmark_id = parseInt(bookmark);
                        data.push(db.moveBookmark(bookmark_id, db.commonFolderDbIds.orphaned, true));
                        return data;
                    }, operations);
                }

                return WinJS.Promise.join(operations);
            });
        }

        private _syncLikes(db: InstapaperDB) {
            const b = this._bookmarks;
            let edits: IBookmarkPendingEdits;

            // Get the pending edits
            return db.getPendingBookmarkEdits().then((pendingEdits) => {
                edits = pendingEdits;

                if (!(edits.likes && edits.likes.length)) {
                    // No likes? No work!
                    return;
                }

                // Push the like edits remotely
                return Codevoid.Utilities.serialize(edits.likes, (edit) => {
                    return b.star(edit.bookmark_id).then(null, handleRemote1241Error).then(() => db.deletePendingBookmarkEdit(edit.id));
                });
            }).then(() => {
                if (!(edits.unlikes && edits.unlikes.length)) {
                    // No unlikes? No work!
                    return;
                }

                // push the unlike edits
                return Codevoid.Utilities.serialize(edits.unlikes, (edit) => {
                    return b.unstar(edit.bookmark_id).then(null, handleRemote1241Error).then(() => db.deletePendingBookmarkEdit(edit.id));
                });
            }).then(() => db.listCurrentBookmarks(db.commonFolderDbIds.liked)).then((localLikes) => {
                const haves = localLikes.map<InstapaperApi.IHaveStatus>((bookmark) => {
                    return {
                        id: bookmark.bookmark_id,
                        hash: bookmark.hash,
                    };
                });

                const folderId = InstapaperDB.CommonFolderIds.Liked;
                return b.list({
                    folder_id: folderId,
                    have: haves,
                    limit: this.perFolderBookmarkLimits[folderId] || this.defaultBookmarkLimit,
                });
            }).then((remoteData) => {
                const rb = remoteData.bookmarks;
                const rd = remoteData.meta;
                // Since we're not going to leave a pending edit, we can just like & unlike the
                // remaining bookmarks irrespective of their existing state.
                let operations = rb.reduce((data, rb) => {
                    data.push(db.likeBookmark(rb.bookmark_id, true, true));
                    return data;
                }, []);

                if (rd.delete_ids) {
                    operations = rd.delete_ids.split(",").reduce((data, bookmark) => {
                        const bookmark_id = parseInt(bookmark);
                        data.push(db.unlikeBookmark(bookmark_id, true));
                        return data;
                    }, operations);
                }
                return WinJS.Promise.join(operations);
            });
        }

        public sync(options: ISyncOptions): WinJS.Promise<void> {
            options = options || { folders: true, bookmarks: true };
            const cancellationSource = options.cancellationSource || new Codevoid.Utilities.CancellationSource();
            const db = options.dbInstance || new InstapaperDB();
            const initialize = options.dbInstance ? WinJS.Promise.as(db) : db.initialize();

            this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.start });

            return initialize.then(() => {
                if (!options.folders || cancellationSource.cancelled) {
                    return;
                }

                return this._syncFolders(db, cancellationSource);
            }).then(() => {
                if (!options.bookmarks || cancellationSource.cancelled) {
                    return;
                }

                return this._syncBookmarks(db, {
                    singleFolder: options.singleFolder,
                    folder: options.folder,
                    skipOrphanCleanup: options.skipOrphanCleanup,
                    _testPerFolderCallback: options._testPerFolderCallback,
                    didSyncFolders: options.folders,
                    cancellationSource: cancellationSource
                });
            }).then(() => {
                this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSyncStatus.end });
                return WinJS.Promise.timeout();
            });
        }
    }
}