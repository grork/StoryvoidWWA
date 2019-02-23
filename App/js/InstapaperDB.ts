interface Error {
    code?: number;
}

interface IndexQuery {
    only<T>(value: any): WinJS.Promise<T[]>;
}

interface Query {
    execute<T>(): WinJS.Promise<T[]>;
}

declare class db {
    static open(parameters: { server: string; version: number; schema: any }, upgradeCallback: (server: Server, versionChange: IDBVersionChangeEvent) => void): WinJS.Promise<Server>;
    static deleteDb(name: string): WinJS.Promise<void>; 
}

interface Server {
    add<T>(table: string, records: T | T[]): WinJS.Promise<T[]>;
    put<T>(table: string, records: T | T[]): WinJS.Promise<T[]>;
    index(table: string, index: string): IndexQuery;
    query(table: string): Query;
    remove(table: string, id: any): WinJS.Promise<void>;
    get<T>(table: string, id: any): WinJS.Promise<T>;
    close(): void;
}

namespace Codevoid.Storyvoid {
    function noDbError(): WinJS.Promise<any> {
        var error = new Error("Not connected to the server");
        error.code = InstapaperDBErrorCodes.NODB;
        return WinJS.Promise.wrapError(error);
    }

    function noClientInformationError(): WinJS.Promise<any> {
        var error = new Error("No client informaton");
        error.code = InstapaperDBErrorCodes.NOCLIENTINFORMATION;
        return WinJS.Promise.wrapError(error);
    }

    function extractFirstItemInArray<T>(dataArray: T[]): T {
        return dataArray[0];
    }

    function createDefaultData(server: Server, upgradeEvent: IDBVersionChangeEvent): void {
        // Create Folders
        server.add("folders", [
            { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, title: "Home" },
            { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, title: "Liked" },
            { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, title: "Archive" },
            { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, title: "orphaned", localOnly: true },
        ]);
    }

    export enum InstapaperDBTableNames {
        Bookmarks = "bookmarks",
        BookmarkUpdates = "bookmarkUpdates",
        Folders = "folders",
        FolderUpdates = "folderUpdates",
    }

    export enum InstapaperDBErrorCodes {
        NODB = 1,
        NOCLIENTINFORMATION = 2,
        FOLDER_DUPLICATE_TITLE = 3,
        BOOKMARK_NOT_FOUND = 4,
        FOLDER_NOT_FOUND = 5,
        INVALID_DESTINATION_FOLDER = 6,
    }

    export enum InstapaperDBCommonFolderIds {
        Unread = "unread",
        Liked = "starred",
        Archive = "archive",
        Orphaned = "orphaned",
    }

    export enum InstapaperDBFolderChangeTypes {
        ADD = "add",
        DELETE = "delete",
        UPDATE = "update",
    }

    export enum InstapaperDBBookmarkChangeTypes {
        ADD = "add",
        DELETE = "delete",
        MOVE = "move",
        LIKE = "star",
        UNLIKE = "unstar",
        UPDATE = "update",
    }

    interface InstapaperDBCommonFolderDBIds {
        readonly archive: number;
        readonly liked: number;
        readonly unread: number;
        readonly orphaned: number;
    }

    export interface IFoldersChangedEvent {
        operation: string;
        folder_dbid: number;
        title: string;
        folder: IFolder;
    }

    export interface IBookmarksChangedEvent {
        operation: string;
        bookmark_id: number;
        bookmark: IBookmark;
        destinationfolder_dbid: number;
        sourcefolder_dbid: number;
    }

    export interface IFolderPendingEdit {
        readonly id?: number;
        readonly type: string;
        readonly folder_dbid: number;
        readonly title: string;
        readonly removedFolderId?: string;
    }

    export interface IBookmarkPendingEdit {
        readonly id: number;
        readonly url: string;
        readonly title: string;
        readonly type: string;
        readonly bookmark_id: number;
        readonly sourcefolder_dbid: number;
        readonly destinationfolder_dbid: number;
    }

    export interface IBookmarkPendingEdits {
        readonly adds: IBookmarkPendingEdit[];
        readonly deletes: IBookmarkPendingEdit[];
        readonly moves: IBookmarkPendingEdit[];
        readonly likes: IBookmarkPendingEdit[];
        readonly unlikes: IBookmarkPendingEdit[];
    }

    export class InstapaperDB extends Utilities.EventSource {
        public static readonly DBName = "Storyvoid";
        public static readonly DBVersion = 1;

        private _db: Server;
        private _name: string;
        private _version: number;

        public commonFolderDbIds: InstapaperDBCommonFolderDBIds;

        private _addPendingFolderEdit(folderEditToPend: IFolder): WinJS.Promise<IFolderPendingEdit> {
            if (!this._db) {
                return noDbError();
            }

            var pendingEdit = {
                type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                folder_dbid: folderEditToPend.id,
                title: folderEditToPend.title,
            };

            return this._db.put<IFolderPendingEdit>(InstapaperDBTableNames.FolderUpdates, pendingEdit).then(extractFirstItemInArray);
        }

        public initialize(name?: string, version?: number): WinJS.Promise<InstapaperDB> {
            this._name = name || Codevoid.Storyvoid.InstapaperDB.DBName;
            this._version = version || Codevoid.Storyvoid.InstapaperDB.DBVersion;

            const schema = {};
            schema[InstapaperDBTableNames.Bookmarks] = {
                key: {
                    keyPath: "bookmark_id",
                    autoIncrement: false
                },
                indexes: {
                    folder_id: {},
                    folder_dbid: {},
                    starred: {},
                    url: {},
                }
            };

            schema[InstapaperDBTableNames.BookmarkUpdates] = {
                key: {
                    keyPath: "id",
                    autoIncrement: true
                },
                indexes: {
                    bookmark_id: {},
                    type: {},
                    sourcefolder_dbid: {},
                    destinationfolder_dbid: {},
                }
            };

            schema[InstapaperDBTableNames.Folders] = {
                key: {
                    keyPath: "id",
                    autoIncrement: true
                },
                indexes: {
                    title: {},
                    folder_id: {},
                }
            };

            schema[InstapaperDBTableNames.FolderUpdates] = {
                key: {
                    keyPath: "id",
                    autoIncrement: true
                },
                indexes: {
                    title: {},
                    folder_dbid: {},
                    type: {},
                }
            };

            return db.open({
                server: this._name,
                version: this._version,
                schema: schema,
            }, createDefaultData).then((db) => this._db = db).then(() => {
                return WinJS.Promise.join({
                    archive: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive),
                    liked: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked),
                    unread: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread),
                    orphaned: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned),
                });
            }).then((data) => {
                this.commonFolderDbIds = {
                    archive: data.archive.id,
                    liked: data.liked.id,
                    unread: data.unread.id,
                    orphaned: data.orphaned.id,
                };
                return this;
            });
        }

        public getFolderFromFolderId(folderId: string): WinJS.Promise<IFolder> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.index(InstapaperDBTableNames.Folders, "folder_id").
                only<IFolder>(folderId).then(extractFirstItemInArray);
        }

        /// <summary>
        /// Returns a snap-shotted state of the current folders. This is
        /// not a live collection, and thus doesn't refect changes
        /// </summary>
        public listCurrentFolders(): WinJS.Promise<IFolder[]> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.query(InstapaperDBTableNames.Folders).execute();
        }

        /// <summary>
        /// Adds a folder to the database, and optionally adds a pending edit.
        ///
        /// If the folder is already marked for deletion, it will merely drop
        /// the pending "delete" if there is one.
        /// </summary>
        public addFolder(folder: IFolder, dontAddPendingEdit?: boolean): WinJS.Promise<IFolder> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.index(InstapaperDBTableNames.Folders, "title").only<IFolder>(folder.title).then((results) => {
                if (!results || !results.length) {
                    return;
                }

                // Since we found an existing folder, we're going to error.
                const error = new Error(`Folder with the title '${folder.title}' already present`);
                error.code = InstapaperDBErrorCodes.FOLDER_DUPLICATE_TITLE;

                return WinJS.Promise.wrapError(error);
            }).then(() => this._db.index(InstapaperDBTableNames.FolderUpdates, "title").only<IFolderPendingEdit>(folder.title)).then(extractFirstItemInArray).then(
                (pendingItem) => {
                    if (!pendingItem) {
                        // There wasn't a pending edit so just move on
                        return null;
                    }

                    // The old data from the DB, which we'll return to allow
                    // the folder to come back.
                    const dataToResurrect = {
                        folder_id: pendingItem.removedFolderId,
                        title: pendingItem.title,
                    };

                    // Throw away the pending edit now that we got the data on it. This means it looks like
                    // the folder had never been removed.
                    return this.deletePendingFolderEdit(pendingItem.id).then(() => dataToResurrect);
                }).then((existingFolderData) => {
                    var folderData = existingFolderData || folder;

                    let completedPromise = this._db.add(InstapaperDBTableNames.Folders, folderData).then(extractFirstItemInArray);

                    if (!dontAddPendingEdit && !existingFolderData) {
                        completedPromise = completedPromise.then((folder) => this._addPendingFolderEdit(folder).then(() => folder));
                    }

                    return completedPromise;
                }).then((data: IFolder) => {
                    this.dispatchEvent("folderschanged", {
                        operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                        folder_dbid: data.id,
                        title: data.title,
                        folder: data,
                    });
                    return data;
                });
        }

        public deletePendingFolderEdit(pendingFolderEditId: number): WinJS.Promise<void> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.remove(InstapaperDBTableNames.FolderUpdates, pendingFolderEditId);
        }

        public getFolderByDbId(folderDbId: number): WinJS.Promise<IFolder> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.get(InstapaperDBTableNames.Folders, folderDbId);
        }

        public getFolderDbIdFromFolderId(folderId: string): WinJS.Promise<IFolder> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.index(InstapaperDBTableNames.Folders, "folder_id").
                only<IFolder>(folderId).
                then(extractFirstItemInArray);
        }

        public updateFolder(folderDetails: IFolder): WinJS.Promise<IFolder> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.put(InstapaperDBTableNames.Folders, folderDetails).then(extractFirstItemInArray).then((data) => {
                this.dispatchEvent("folderschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.UPDATE,
                    folder_dbid: data.id,
                    folder: data,
                });

                return data;
            });
        }

        public removeFolder(folderDbId: number, dontAddPendingEdit?: boolean): WinJS.Promise<void> {
            if (!this._db) {
                return noDbError();
            }

            let completePromise: WinJS.Promise<any> = WinJS.Promise.as();
            let wasUnsyncedEdit = false;

            let folderBeingRemoved: IFolder;
            if (!dontAddPendingEdit) {
                completePromise = this._db.get<IFolder>(InstapaperDBTableNames.Folders, folderDbId).then((folder) => folderBeingRemoved = folder);
            }

            completePromise = completePromise.then(() => this._db.remove(InstapaperDBTableNames.Folders, folderDbId)).
                then(() => this._db.index(InstapaperDBTableNames.FolderUpdates, "folder_dbid").only<IFolderPendingEdit>(folderDbId)).
                then((results) => {
                    if (!results || !results.length) {
                        return;
                    }

                    wasUnsyncedEdit = true;

                    window.appassert(results.length === 1, "Didn't expect to find more than one pending edit for this folder");
                    return this.deletePendingFolderEdit(results[0].id);
                });

            if (!dontAddPendingEdit) {
                completePromise = completePromise.then(() => {
                    if (wasUnsyncedEdit) {
                        return;
                    }

                    // Deletes are a little different, so lets not use
                    // the _addPendingFolderEdit method here to ensure that we dont
                    // end up specialcasing that function up the wazoo.
                    const pendingEdit: any = {
                        type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                        removedFolderId: folderBeingRemoved.folder_id,
                        title: folderBeingRemoved.title,
                    };

                    return this._db.put<IFolderPendingEdit>(InstapaperDBTableNames.FolderUpdates, pendingEdit)
                });
            }

            return completePromise.then(() => {
                this.dispatchEvent("folderschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                    folder_dbid: folderDbId,
                });

                // Stop the pending edit making it to the caller.
                return;
            });
        }

        public getPendingFolderEdits(): WinJS.Promise<IFolderPendingEdit[]> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.query(InstapaperDBTableNames.FolderUpdates).execute<IFolderPendingEdit>();
        }

        public getPendingBookmarkEdits(folderDbId?: number): WinJS.Promise<IBookmarkPendingEdits> {
            if (!this._db) {
                return noDbError();
            }

            let edits: WinJS.Promise<IBookmarkPendingEdit[]>;
            if (!folderDbId) {
                edits = this._db.query(InstapaperDBTableNames.BookmarkUpdates).execute<IBookmarkPendingEdit>();
            } else {
                edits = WinJS.Promise.join({
                    source: this._db.index(InstapaperDBTableNames.BookmarkUpdates, "sourcefolder_dbid").only(folderDbId),
                    destination: this._db.index(InstapaperDBTableNames.BookmarkUpdates, "destinationfolder_dbid").only(folderDbId),
                }).then((data: { source: IBookmarkPendingEdit[]; destination: IBookmarkPendingEdit[] }) => data.source.concat(data.destination));
            }

            return edits.then((pendingEdits) => {
                const adds: IBookmarkPendingEdit[] = [];
                const deletes: IBookmarkPendingEdit[] = [];
                const moves: IBookmarkPendingEdit[] = [];
                const likes: IBookmarkPendingEdit[] = [];
                const unlikes: IBookmarkPendingEdit[] = [];

                pendingEdits.forEach((pendingEdit) => {
                    switch (pendingEdit.type) {
                        case InstapaperDBBookmarkChangeTypes.ADD:
                            window.appassert(!folderDbId, "Don't support folder specific adds");
                            adds.push(pendingEdit);
                            break;
                        case InstapaperDBBookmarkChangeTypes.DELETE:
                            deletes.push(pendingEdit);
                            break;

                        case InstapaperDBBookmarkChangeTypes.MOVE:
                            moves.push(pendingEdit);
                            break;

                        case InstapaperDBBookmarkChangeTypes.LIKE:
                            likes.push(pendingEdit);
                            break;

                        case InstapaperDBBookmarkChangeTypes.UNLIKE:
                            unlikes.push(pendingEdit);
                            break;

                        default:
                            window.appfail("Unsupported edit type");
                            break;
                    }
                });

                const result = {
                    adds: null,
                    deletes: null,
                    moves: null,
                    likes: null,
                    unlikes: null,
                };

                if (adds.length) {
                    result.adds = adds;
                }

                if (deletes.length) {
                    result.deletes = deletes;
                }

                if (moves.length) {
                    result.moves = moves;
                }

                if (likes.length) {
                    result.likes = likes;
                }

                if (unlikes.length) {
                    result.unlikes = unlikes;
                }

                return result;
            });
        }

        public getPendingBookmarkAdds(): WinJS.Promise<IBookmarkPendingEdit[]> {
            if (!this._db) {
                return noDbError();
            }

            return this.getPendingBookmarkEdits().then((data) => data.adds || []);
        }

        public listCurrentBookmarks(folder_dbid?: number | string): WinJS.Promise<IBookmark[]> {
            if (!this._db) {
                return noDbError();
            }

            if (folder_dbid && (folder_dbid === this.commonFolderDbIds.liked)) {
                return this._db.index(InstapaperDBTableNames.Bookmarks, "starred").only(1);
            } else if (folder_dbid && (folder_dbid !== Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked)) {
                return this._db.index(InstapaperDBTableNames.Bookmarks, "folder_dbid").only(folder_dbid);
            }

            return this._db.query(InstapaperDBTableNames.Bookmarks).execute();
        }

        public addBookmark(bookmark: IBookmark): WinJS.Promise<IBookmark> {
            window.appassert(!!bookmark.folder_dbid, "No Folder DB ID provided");

            if (!this._db) {
                return noDbError();
            }

            if (!bookmark.hasOwnProperty("contentAvailableLocally")) {
                bookmark.contentAvailableLocally = false;
            }

            return this._db.add(InstapaperDBTableNames.Bookmarks, bookmark).then(extractFirstItemInArray).then((added) => {
                this.dispatchEvent("bookmarkschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD,
                    bookmark_id: added.bookmark_id,
                    bookmark: added,
                });

                return added;
            });
        }

        public addUrl(bookmarkToAdd: { url: string; title: string }): WinJS.Promise<IBookmarkPendingEdit> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.add<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>{
                url: bookmarkToAdd.url,
                title: bookmarkToAdd.title,
                type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD
            }).then(extractFirstItemInArray);
        }

        public deletePendingBookmarkEdit(pendingBookmarkEditId: number): WinJS.Promise<void> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.remove(InstapaperDBTableNames.BookmarkUpdates, pendingBookmarkEditId);
        }

        private _getPendingEditForBookmarkAndType(bookmark: number, type: InstapaperDBBookmarkChangeTypes): WinJS.Promise<IBookmarkPendingEdit> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.index(InstapaperDBTableNames.BookmarkUpdates, "bookmark_id").only<IBookmarkPendingEdit>(bookmark).then((results) => {
                if (!results || !results.length) {
                    return null;
                }

                var resultsOfType = results.filter((item) => item.type === type);
                window.appassert(resultsOfType.length < 2, "Should have only found one edit of specified type");
                return resultsOfType[0];
            });
        }

        public getBookmarkByBookmarkId(bookmark_id: number): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.get<IBookmark>(InstapaperDBTableNames.Bookmarks, bookmark_id);
        }

        public removeBookmark(bookmark_id: number, fromServer?: boolean): WinJS.Promise<void> {
            if (!this._db) {
                return noDbError();
            }

            let sourcefolder_dbid;
            let removedPromise = this.getBookmarkByBookmarkId(bookmark_id).then((bookmark) => {
                sourcefolder_dbid = bookmark.folder_dbid;
                return WinJS.Promise.join([
                    this._db.remove(InstapaperDBTableNames.Bookmarks, bookmark_id),
                    this._db.index(
                        InstapaperDBTableNames.BookmarkUpdates,
                        "bookmark_id").
                        only<IBookmarkPendingEdit>(bookmark_id).
                        then((pendingEditsForBookmark) => {
                            // Find all the pending edits that aren't "likes" and
                            // remove them. Likes are special, and should still be
                            // left for syncing (before any other changes).
                            const removedEdits = pendingEditsForBookmark.filter((item) => item.type !== InstapaperDBBookmarkChangeTypes.LIKE).
                                map((existingPendingEdit) => this._db.remove(InstapaperDBTableNames.BookmarkUpdates, existingPendingEdit.id));

                            return WinJS.Promise.join(removedEdits);
                        })
                ]);
            });

            // If it's not an edit from the server we need to add a pending
            // delete that we can later sync to the server.
            if (!fromServer) {
                removedPromise = removedPromise.then(() => {
                    const edit = {
                        type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                        bookmark_id: bookmark_id,
                        sourcefolder_dbid: sourcefolder_dbid,
                    };

                    return this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>edit);
                });
            }

            return removedPromise.then(() => {
                this.dispatchEvent("bookmarkschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                    bookmark_id: bookmark_id,
                    sourcefolder_dbid: sourcefolder_dbid,
                });
                // Hide the result of the DB operation
            });
        }

        public updateBookmark(bookmark: IBookmark, dontRaiseChangeNotification?: boolean): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            return this._db.put(InstapaperDBTableNames.Bookmarks, bookmark).then(extractFirstItemInArray).then((updated) => {
                if (!dontRaiseChangeNotification) {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UPDATE,
                        bookmark_id: updated.bookmark_id,
                        bookmark: updated,
                    });
                }

                return updated;
            });
        }

        public moveBookmark(bookmark_id: number, destinationFolderDbId: number, fromServer?: boolean): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            const data = {
                bookmark: this.getBookmarkByBookmarkId(bookmark_id),
                folder: this.getFolderByDbId(destinationFolderDbId),
            };

            let sourcefolder_dbid: number;

            var movedBookmark: WinJS.Promise<IBookmark> = WinJS.Promise.join(data).then((data: { bookmark: IBookmark; folder: IFolder }) => {
                if (!data.folder) {
                    var error = new Error();
                    error.code = InstapaperDBErrorCodes.FOLDER_NOT_FOUND;
                    return <any>WinJS.Promise.wrapError(error);
                }

                // If we've got an existing folder ID, set it to that
                // otherwise, just leave it blank, and we'll get it fixed
                // up later when we actually do a proper sync and update
                // the folder id's correctly.
                if (data.folder.folder_id) {
                    data.bookmark.folder_id = data.folder.folder_id;
                } else {
                    data.bookmark.folder_id = null;
                }

                switch (data.folder.folder_id) {
                    case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked:
                        var invalidDestinationFolder = new Error();
                        invalidDestinationFolder.code = InstapaperDBErrorCodes.INVALID_DESTINATION_FOLDER;
                        return WinJS.Promise.wrapError(invalidDestinationFolder);

                    default:
                        break;
                }

                sourcefolder_dbid = data.bookmark.folder_dbid;
                data.bookmark.folder_dbid = data.folder.id;

                return this.updateBookmark(data.bookmark, true);
            });

            if (!fromServer) {
                movedBookmark = movedBookmark.then((movedBookmark) => {
                    const completedData = {
                        bookmark: movedBookmark,
                        folder: data.folder,
                    };

                    return this._db.index(InstapaperDBTableNames.BookmarkUpdates,
                        "bookmark_id").
                        only<IBookmarkPendingEdit>(movedBookmark.bookmark_id).
                        then((pendingEditsForBookmark) => {
                            // Find all the pending edits that are moves
                            // and remove any pending edits so that we can end up
                            // with only one.
                            const removedEdits = pendingEditsForBookmark.filter((item) => item.type === InstapaperDBBookmarkChangeTypes.MOVE).
                                map((existingMove) => this._db.remove(InstapaperDBTableNames.BookmarkUpdates, existingMove.id));

                            return WinJS.Promise.join(removedEdits);
                        }).then(() => {
                            // Cheat and return the already completed promise
                            // with the data we actually want. Allows the rest of
                            // this function to behave cleanly.
                            return WinJS.Promise.join(completedData);
                        });
                }).then((data: { bookmark: IBookmark; folder: IFolder }) => {
                    const pendingEdit = {
                        type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                        bookmark_id: data.bookmark.bookmark_id,
                        destinationfolder_dbid: data.folder.id,
                        sourcefolder_dbid: sourcefolder_dbid,
                    };

                    return this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>pendingEdit).then(() => data.bookmark);
                });
            }

            return movedBookmark.then((bookmark) => {
                this.dispatchEvent("bookmarkschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                    bookmark: bookmark,
                    bookmark_id: bookmark.bookmark_id,
                    destinationfolder_dbid: bookmark.folder_dbid,
                    sourcefolder_dbid: sourcefolder_dbid,
                });
                return bookmark;
            });
        }

        public likeBookmark(bookmark_id: number, dontAddPendingUpdate?: boolean, ignoreMissingBookmark?: boolean): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            let updatedBookmark: IBookmark = null;
            let likedComplete = this.getBookmarkByBookmarkId(bookmark_id).then((bookmark) => {
                let wasUnsyncedEdit = false;
                let sourcefolder_dbid: number;

                if (!bookmark) {
                    if (ignoreMissingBookmark) {
                        return;
                    }

                    const error = new Error();
                    error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                    error.message = "Didn't find bookmark with ID " + bookmark_id;
                    return <any>WinJS.Promise.wrapError(error);
                }

                sourcefolder_dbid = bookmark.folder_dbid;

                let promise: WinJS.Promise<IBookmark>;
                if (bookmark.starred === 1) {
                    promise = WinJS.Promise.as(bookmark);
                } else {
                    bookmark.starred = 1;
                    promise = this.updateBookmark(bookmark, true);
                }

                return promise.then((bookmark) => {
                    updatedBookmark = bookmark;

                    return WinJS.Promise.join({
                        unlike: this._getPendingEditForBookmarkAndType(bookmark_id, InstapaperDBBookmarkChangeTypes.UNLIKE),
                        like: this._getPendingEditForBookmarkAndType(bookmark_id, InstapaperDBBookmarkChangeTypes.LIKE),
                    });
                }).then((pendingEdits: { unlike: IBookmarkPendingEdit; like: IBookmarkPendingEdit }) => {
                    if (!pendingEdits.unlike && !pendingEdits.like) {
                        return;
                    }

                    wasUnsyncedEdit = true;

                    // If it's already a like, then theres nothing else for us to do here
                    // so lets just move on.
                    if (pendingEdits.like) {
                        return;
                    }

                    return this.deletePendingBookmarkEdit(pendingEdits.unlike.id);
                }).then(() => {
                    var f = WinJS.Promise.as();
                    if (!dontAddPendingUpdate && !wasUnsyncedEdit) {
                        const edit = {
                            type: InstapaperDBBookmarkChangeTypes.LIKE,
                            bookmark_id: bookmark_id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        };

                        f = this._db.put(InstapaperDBTableNames.BookmarkUpdates, edit);
                    }

                    return f.then(() => {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDBBookmarkChangeTypes.LIKE,
                            bookmark_id: updatedBookmark.bookmark_id,
                            bookmark: updatedBookmark,
                        });
                    });
                });
            });

            return likedComplete.then(() => updatedBookmark);
        }

        public unlikeBookmark(bookmark_id: number, dontAddPendingUpdate?: boolean): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            let wasUnsyncedEdit = false;
            let sourcefolder_dbid: number;
            let updatedBookmark: IBookmark;

            let unlikedBookmark = this.getBookmarkByBookmarkId(bookmark_id).then((bookmark): WinJS.Promise<IBookmark> => {
                if (!bookmark) {
                    var error = new Error();
                    error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                    return <any>WinJS.Promise.wrapError(error);
                }

                sourcefolder_dbid = bookmark.folder_dbid;

                if (bookmark.starred === 0) {
                    return WinJS.Promise.as(bookmark);
                }

                bookmark.starred = 0;
                return this.updateBookmark(bookmark, true);
            }).then((bookmark) => {
                updatedBookmark = bookmark
                return WinJS.Promise.join({
                    like: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE),
                    unlike: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE),
                });
            }).then((pendingEdits: { like: IBookmarkPendingEdit; unlike: IBookmarkPendingEdit }) => {
                if (!pendingEdits.like && !pendingEdits.unlike) {
                    return;
                }

                wasUnsyncedEdit = true;

                if (pendingEdits.unlike) {
                    return;
                }

                return this.deletePendingBookmarkEdit(pendingEdits.like.id);
            });

            if (!dontAddPendingUpdate) {
                unlikedBookmark = unlikedBookmark.then(() => {
                    if (wasUnsyncedEdit) {
                        return;
                    }

                    const edit = {
                        type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                        bookmark_id: bookmark_id,
                        sourcefolder_dbid: sourcefolder_dbid,
                    };

                    return <any>this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>edit);
                });
            }

            return unlikedBookmark.then(() => {
                this.dispatchEvent("bookmarkschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                    bookmark_id: updatedBookmark.bookmark_id,
                    bookmark: updatedBookmark,
                });
                return updatedBookmark;
            });
        }

        public updateReadProgress(bookmark_id: number, progress: number): WinJS.Promise<IBookmark> {
            if (!this._db) {
                return noDbError();
            }

            return this.getBookmarkByBookmarkId(bookmark_id).then((bookmark) => {
                if (!bookmark) {
                    var error = new Error();
                    error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                    return <any>WinJS.Promise.wrapError(error);
                }

                bookmark.progress = progress;
                bookmark.progress_timestamp = Date.now();
                // When upating progress locally, we need to invalidate our hash
                // so that the service sees/thinks we've got different local data
                // No, I'm not clear why, but thats what they said.
                bookmark.hash = Math.random().toString();

                return this.updateBookmark(bookmark);
            });
        }

        public deleteAllData(): WinJS.Promise<void> {
            if (!this._db) {
                return noDbError();
            }

            this.dispose();
            return db.deleteDb(this._name);
        }

        public dispose() {
            if (this._db) {
                this._db.close();
            }
        }
    }

    export interface InstapaperDB {
        addEventListener(name: "folderschanged", handler: (eventData: Utilities.EventObject<IFoldersChangedEvent>) => any, useCapture?: boolean): void;
    }
}