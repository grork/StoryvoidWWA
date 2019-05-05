interface Error {
    code?: number;
}

namespace Codevoid.Storyvoid {
    function noDbError(): void {
        var error = new Error("Not connected to the server");
        error.code = InstapaperDBErrorCodes.NODB;
        throw error;
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

        private async _addPendingFolderEdit(folderEditToPend: IFolder): Promise<IFolderPendingEdit> {
            if (!this._db) {
                noDbError();
            }

            var pendingEdit = {
                type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                folder_dbid: folderEditToPend.id,
                title: folderEditToPend.title,
            };

            const edit = await this._db.put<IFolderPendingEdit>(InstapaperDBTableNames.FolderUpdates, pendingEdit);
            return edit[0];
        }

        public async initialize(name?: string, version?: number): Promise<InstapaperDB> {
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

            this._db = await db.open({
                server: this._name,
                version: this._version,
                schema: schema,
            }, createDefaultData);

            const [archive, liked, unread, orphaned] = await Promise.all([
                this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive),
                this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked),
                this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread),
                this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned),
            ]);

            this.commonFolderDbIds = {
                archive: archive.id,
                liked: liked.id,
                unread: unread.id,
                orphaned: orphaned.id,
            };
            return this;
        }

        public async getFolderFromFolderId(folderId: string): Promise<IFolder> {
            if (!this._db) {
                noDbError();
            }

            const results = await this._db.index(InstapaperDBTableNames.Folders, "folder_id").only<IFolder>(folderId);
            return results[0];
        }

        /// <summary>
        /// Returns a snap-shotted state of the current folders. This is
        /// not a live collection, and thus doesn't refect changes
        /// </summary>
        public async listCurrentFolders(): Promise<IFolder[]> {
            if (!this._db) {
                noDbError();
            }

            const results = await this._db.query(InstapaperDBTableNames.Folders).execute<IFolder>();
            return results;
        }

        /// <summary>
        /// Adds a folder to the database, and optionally adds a pending edit.
        ///
        /// If the folder is already marked for deletion, it will merely drop
        /// the pending "delete" if there is one.
        /// </summary>
        public async addFolder(folder: IFolder, dontAddPendingEdit?: boolean): Promise<IFolder> {
            if (!this._db) {
                noDbError();
            }

            const results = await this._db.index(InstapaperDBTableNames.Folders, "title").only<IFolder>(folder.title);
            if (results && results.length) {
                // Since we found an existing folder, we're going to error.
                const error = new Error(`Folder with the title '${folder.title}' already present`);
                error.code = InstapaperDBErrorCodes.FOLDER_DUPLICATE_TITLE;
                throw error;
            }

            const pendingEdits = await this._db.index(InstapaperDBTableNames.FolderUpdates, "title").only<IFolderPendingEdit>(folder.title);
            const pendingItem = pendingEdits[0];
            if (pendingItem) {
                // The old data from the DB, which we'll return to allow
                // the folder to come back.
                const dataToResurrect = {
                    folder_id: pendingItem.removedFolderId,
                    title: pendingItem.title,
                };

                // Throw away the pending edit now that we got the data on it. This means it looks like
                // the folder had never been removed.
                await this.deletePendingFolderEdit(pendingItem.id);
                folder = dataToResurrect;
            }

            const addResult = await this._db.add(InstapaperDBTableNames.Folders, folder)
            folder = addResult[0];

            if (!dontAddPendingEdit && !pendingItem) {
                await this._addPendingFolderEdit(folder);
            }

            this.dispatchEvent("folderschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                folder_dbid: folder.id,
                title: folder.title,
                folder: folder
            });

            return folder;
        }

        public async deletePendingFolderEdit(pendingFolderEditId: number): Promise<void> {
            if (!this._db) {
                noDbError();
            }

            await this._db.remove(InstapaperDBTableNames.FolderUpdates, pendingFolderEditId);
        }

        public async getFolderByDbId(folderDbId: number): Promise<IFolder> {
            if (!this._db) {
                noDbError();
            }

            const result = await this._db.get<IFolder>(InstapaperDBTableNames.Folders, folderDbId);
            return result;
        }

        public async getFolderDbIdFromFolderId(folderId: string): Promise<IFolder> {
            if (!this._db) {
                noDbError();
            }

            const result = await this._db.index(InstapaperDBTableNames.Folders, "folder_id").only<IFolder>(folderId);
            return result[0];
        }

        public async updateFolder(folderDetails: IFolder): Promise<IFolder> {
            if (!this._db) {
                noDbError();
            }

            const data = (await this._db.put(InstapaperDBTableNames.Folders, folderDetails))[0];
            this.dispatchEvent("folderschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.UPDATE,
                folder_dbid: data.id,
                folder: data,
            });

            return data;
        }

        public async removeFolder(folderDbId: number, dontAddPendingEdit?: boolean): Promise<void> {
            if (!this._db) {
                noDbError();
            }

            let wasUnsyncedEdit = false;

            let folderBeingRemoved: IFolder;
            if (!dontAddPendingEdit) {
                folderBeingRemoved = await this._db.get<IFolder>(InstapaperDBTableNames.Folders, folderDbId);
            }

            await this._db.remove(InstapaperDBTableNames.Folders, folderDbId);
            const pendingEdits = await this._db.index(InstapaperDBTableNames.FolderUpdates, "folder_dbid").only<IFolderPendingEdit>(folderDbId);
            if (pendingEdits && pendingEdits.length) {
                wasUnsyncedEdit = true;
                window.appassert(pendingEdits.length === 1, "Didn't expect to find more than one pending edit for this folder");
                await this.deletePendingFolderEdit(pendingEdits[0].id);
            }


            // If we're adding a pending edit, and we aren't removing a folder add we hadn't
            // synced yet, then lets go do that pending edit thing
            if (!dontAddPendingEdit && !wasUnsyncedEdit) {
                // Deletes are a little different, so lets not use
                // the _addPendingFolderEdit method here to ensure that we dont
                // end up special casing that function up the wazoo.
                const pendingEdit: any = {
                    type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                    removedFolderId: folderBeingRemoved.folder_id,
                    title: folderBeingRemoved.title,
                };

                await this._db.put<IFolderPendingEdit>(InstapaperDBTableNames.FolderUpdates, pendingEdit);
            }

            this.dispatchEvent("folderschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                folder_dbid: folderDbId,
            });
        }

        public async getPendingFolderEdits(): Promise<IFolderPendingEdit[]> {
            if (!this._db) {
                noDbError();
            }

            const result = await this._db.query(InstapaperDBTableNames.FolderUpdates).execute<IFolderPendingEdit>();
            return result;
        }

        public async getPendingBookmarkEdits(folderDbId?: number): Promise<IBookmarkPendingEdits> {
            if (!this._db) {
                noDbError();
            }

            let pendingEdits: IBookmarkPendingEdit[];
            if (!folderDbId) {
                pendingEdits = await this._db.query(InstapaperDBTableNames.BookmarkUpdates).execute<IBookmarkPendingEdit>();
            } else {
                const [source, destination] = await Promise.all([
                    this._db.index(InstapaperDBTableNames.BookmarkUpdates, "sourcefolder_dbid").only<IBookmarkPendingEdit>(folderDbId),
                    this._db.index(InstapaperDBTableNames.BookmarkUpdates, "destinationfolder_dbid").only<IBookmarkPendingEdit>(folderDbId),
                ]);
                pendingEdits = source.concat(destination);
            }

            const adds: IBookmarkPendingEdit[] = [];
            const deletes: IBookmarkPendingEdit[] = [];
            const moves: IBookmarkPendingEdit[] = [];
            const likes: IBookmarkPendingEdit[] = [];
            const unlikes: IBookmarkPendingEdit[] = [];

            for (let pendingEdit of pendingEdits) {
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
            }

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
        }

        public async getPendingBookmarkAdds(): Promise<IBookmarkPendingEdit[]> {
            if (!this._db) {
                noDbError();
            }

            const data = await this.getPendingBookmarkEdits();
            return (data.adds || []);
        }

        public async listCurrentBookmarks(folder_dbid?: number | string): Promise<IBookmark[]> {
            if (!this._db) {
                noDbError();
            }

            if (folder_dbid && (folder_dbid === this.commonFolderDbIds.liked)) {
                return await this._db.index(InstapaperDBTableNames.Bookmarks, "starred").only<IBookmark>(1);
            } else if (folder_dbid && (folder_dbid !== Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked)) {
                return await this._db.index(InstapaperDBTableNames.Bookmarks, "folder_dbid").only<IBookmark>(folder_dbid);
            }

            return await this._db.query(InstapaperDBTableNames.Bookmarks).execute<IBookmark>();
        }

        public async addBookmark(bookmark: IBookmark): Promise<IBookmark> {
            window.appassert(!!bookmark.folder_dbid, "No Folder DB ID provided");

            if (!this._db) {
                noDbError();
            }

            if (!bookmark.hasOwnProperty("contentAvailableLocally")) {
                bookmark.contentAvailableLocally = false;
            }

            const added = (await this._db.add(InstapaperDBTableNames.Bookmarks, bookmark))[0];
            this.dispatchEvent("bookmarkschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD,
                bookmark_id: added.bookmark_id,
                bookmark: added,
            });

            return added;
        }

        public async addUrl(bookmarkToAdd: { url: string; title: string }): Promise<IBookmarkPendingEdit> {
            if (!this._db) {
                noDbError();
            }

            const results = await this._db.add<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>{
                url: bookmarkToAdd.url,
                title: bookmarkToAdd.title,
                type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD
            });

            return results[0];
        }

        public async deletePendingBookmarkEdit(pendingBookmarkEditId: number): Promise<void> {
            if (!this._db) {
                noDbError();
            }

            await this._db.remove(InstapaperDBTableNames.BookmarkUpdates, pendingBookmarkEditId);
        }

        private async _getPendingEditForBookmarkAndType(bookmark: number, type: InstapaperDBBookmarkChangeTypes): Promise<IBookmarkPendingEdit> {
            if (!this._db) {
                noDbError();
            }

            const results = await this._db.index(InstapaperDBTableNames.BookmarkUpdates, "bookmark_id").only<IBookmarkPendingEdit>(bookmark);
            if (!results || !results.length) {
                return null;
            }

            var resultsOfType = results.filter((item) => item.type === type);
            window.appassert(resultsOfType.length < 2, "Should have only found one edit of specified type");
            return resultsOfType[0];
        }

        public async getBookmarkByBookmarkId(bookmark_id: number): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            return await this._db.get<IBookmark>(InstapaperDBTableNames.Bookmarks, bookmark_id);
        }

        public async removeBookmark(bookmark_id: number, fromServer?: boolean): Promise<void> {
            if (!this._db) {
                noDbError();
            }

            const bookmark = await this.getBookmarkByBookmarkId(bookmark_id);
            const sourcefolder_dbid = bookmark.folder_dbid;

            const removeBookmarkOperation = this._db.remove(InstapaperDBTableNames.Bookmarks, bookmark_id);
            const pendingEditsForBookmark = await this._db.index(InstapaperDBTableNames.BookmarkUpdates, "bookmark_id").only<IBookmarkPendingEdit>(bookmark_id);

            // Find all the pending edits that aren't "likes" and
            // remove them. Likes are special, and should still be
            // left for syncing (before any other changes).
            const nonLikePendingEdits = pendingEditsForBookmark.filter((item) => item.type !== InstapaperDBBookmarkChangeTypes.LIKE);
            const removedEdits = nonLikePendingEdits.map((p) => this._db.remove(InstapaperDBTableNames.BookmarkUpdates, p.id));

            await Promise.all(removedEdits);

            // If it's not an edit from the server we need to add a pending
            // delete that we can later sync to the server.
            if (!fromServer) {
                const edit = {
                    type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                    bookmark_id: bookmark_id,
                    sourcefolder_dbid: sourcefolder_dbid,
                };

                await this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>edit);
            }

            this.dispatchEvent("bookmarkschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                bookmark_id: bookmark_id,
                sourcefolder_dbid: sourcefolder_dbid,
            });
        }

        public async updateBookmark(bookmark: IBookmark, dontRaiseChangeNotification?: boolean): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            const updated = (await this._db.put(InstapaperDBTableNames.Bookmarks, bookmark))[0];
            if (!dontRaiseChangeNotification) {
                this.dispatchEvent("bookmarkschanged", {
                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UPDATE,
                    bookmark_id: updated.bookmark_id,
                    bookmark: updated,
                });
            }

            return updated;
        }

        public async moveBookmark(bookmark_id: number, destinationFolderDbId: number, fromServer?: boolean): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            const [bookmark, folder] = await Promise.all([
                this.getBookmarkByBookmarkId(bookmark_id),
                this.getFolderByDbId(destinationFolderDbId),
            ]);

            if (!folder) {
                var error = new Error();
                error.code = InstapaperDBErrorCodes.FOLDER_NOT_FOUND;
                throw error;
            }

            // If we've got an existing folder ID, set it to that
            // otherwise, just leave it blank, and we'll get it fixed
            // up later when we actually do a proper sync and update
            // the folder id's correctly.
            if (folder.folder_id) {
                bookmark.folder_id = folder.folder_id;
            } else {
                bookmark.folder_id = null;
            }

            switch (folder.folder_id) {
                case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked:
                    var invalidDestinationFolder = new Error();
                    invalidDestinationFolder.code = InstapaperDBErrorCodes.INVALID_DESTINATION_FOLDER;
                    throw invalidDestinationFolder;

                default:
                    break;
            }

            const sourcefolder_dbid = bookmark.folder_dbid;
            bookmark.folder_dbid = folder.id;

            const movedBookmark = await this.updateBookmark(bookmark, true);

            if (!fromServer) {
                const pendingEditsForBookmark = await this._db.index(InstapaperDBTableNames.BookmarkUpdates, "bookmark_id").only<IBookmarkPendingEdit>(movedBookmark.bookmark_id);
                // Find all the pending edits that are moves
                // and remove any pending edits so that we can end up
                // with only one.
                const movedPendingEdits = pendingEditsForBookmark.filter((item) => item.type === InstapaperDBBookmarkChangeTypes.MOVE);
                const removedEdits = movedPendingEdits.map((em) => this._db.remove(InstapaperDBTableNames.BookmarkUpdates, em.id));
                await Promise.all(removedEdits);

                const pendingEdit = {
                    type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                    bookmark_id: movedBookmark.bookmark_id,
                    destinationfolder_dbid: folder.id,
                    sourcefolder_dbid: sourcefolder_dbid,
                };

                await this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>pendingEdit);
            }

            this.dispatchEvent("bookmarkschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                bookmark: movedBookmark,
                bookmark_id: movedBookmark.bookmark_id,
                destinationfolder_dbid: movedBookmark.folder_dbid,
                sourcefolder_dbid: sourcefolder_dbid,
            });
            return movedBookmark;
        }

        public async likeBookmark(bookmark_id: number, dontAddPendingUpdate?: boolean, ignoreMissingBookmark?: boolean): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            const bookmark = await this.getBookmarkByBookmarkId(bookmark_id);
            let wasUnsyncedEdit = false;

            if (!bookmark) {
                if (ignoreMissingBookmark) {
                    return null;
                }

                const error = new Error();
                error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                error.message = "Didn't find bookmark with ID " + bookmark_id;
                throw error;
            }

            const sourcefolder_dbid = bookmark.folder_dbid;
            let updatedBookmark = bookmark;
            if (bookmark.starred !== 1) {
                bookmark.starred = 1;
                updatedBookmark = await this.updateBookmark(bookmark, true);
            }

            const [unlike, like] = await Promise.all([
                this._getPendingEditForBookmarkAndType(bookmark_id, InstapaperDBBookmarkChangeTypes.UNLIKE),
                this._getPendingEditForBookmarkAndType(bookmark_id, InstapaperDBBookmarkChangeTypes.LIKE),
            ]);

            if (unlike || like) {
                wasUnsyncedEdit = true;

                // If it's already a like, then theres nothing else for us to do here
                // so lets just move on.
                if (!like) {
                    await this.deletePendingBookmarkEdit(unlike.id);
                }
            }

            if (!dontAddPendingUpdate && !wasUnsyncedEdit) {
                const edit = {
                    type: InstapaperDBBookmarkChangeTypes.LIKE,
                    bookmark_id: bookmark_id,
                    sourcefolder_dbid: sourcefolder_dbid,
                };

                await this._db.put(InstapaperDBTableNames.BookmarkUpdates, edit);
            }

            this.dispatchEvent("bookmarkschanged", {
                operation: InstapaperDBBookmarkChangeTypes.LIKE,
                bookmark_id: updatedBookmark.bookmark_id,
                bookmark: updatedBookmark,
            });

            return updatedBookmark;
        }

        public async unlikeBookmark(bookmark_id: number, dontAddPendingUpdate?: boolean): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            let wasUnsyncedEdit = false;

            const bookmark = await this.getBookmarkByBookmarkId(bookmark_id);
            if (!bookmark) {
                var error = new Error();
                error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                throw error;
            }
            let updatedBookmark = bookmark;
            const sourcefolder_dbid = bookmark.folder_dbid;
            if (bookmark.starred !== 0) {
                bookmark.starred = 0;
                updatedBookmark = await this.updateBookmark(bookmark, true);
            }

            const [like, unlike] = await Promise.all([
                this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE),
                this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE),
            ]);

            if (like || unlike) {
                wasUnsyncedEdit = true;

                if (!unlike) {
                    await this.deletePendingBookmarkEdit(like.id);
                }
            }

            if (!dontAddPendingUpdate && !wasUnsyncedEdit) {
                const edit = {
                    type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                    bookmark_id: bookmark_id,
                    sourcefolder_dbid: sourcefolder_dbid,
                };

                await this._db.put<IBookmarkPendingEdit>(InstapaperDBTableNames.BookmarkUpdates, <any>edit);
            }

            this.dispatchEvent("bookmarkschanged", {
                operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                bookmark_id: updatedBookmark.bookmark_id,
                bookmark: updatedBookmark,
            });
            return updatedBookmark;
        }

        public async updateReadProgress(bookmark_id: number, progress: number): Promise<IBookmark> {
            if (!this._db) {
                noDbError();
            }

            const bookmark = await this.getBookmarkByBookmarkId(bookmark_id);
            if (!bookmark) {
                const error = new Error();
                error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                throw error;
            }

            bookmark.progress = progress;
            bookmark.progress_timestamp = Date.now();
            // When upating progress locally, we need to invalidate our hash
            // so that the service sees/thinks we've got different local data
            // No, I'm not clear why, but thats what they said.
            bookmark.hash = Math.random().toString();

            return await this.updateBookmark(bookmark);
        }

        public async deleteAllData(): Promise<void> {
            if (!this._db) {
                noDbError();
            }

            this.dispose();
            await db.deleteDb(this._name);
        }

        public dispose() {
            if (this._db) {
                this._db.close();
            }
        }
    }

    export interface InstapaperDB {
        addEventListener(name: "folderschanged", handler: (eventData: Utilities.EventObject<IFoldersChangedEvent>) => any, useCapture?: boolean): void;
        addEventListener(name: "bookmarkschanged", handler: (eventData: Utilities.EventObject<IBookmarksChangedEvent>) => any, useCapture?: boolean): void;
    }
}