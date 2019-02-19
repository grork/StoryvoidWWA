interface Error {
    code?: number;
}

declare class db {
    static open(...args: any[]): WinJS.Promise<Server>;
    static deleteDb(...args: any[]): any;
}

declare interface Server {
    add(table: string, records: any[]);
}

namespace Codevoid.Storyvoid {
    export enum InstapaperDBTableNames {
        Bookmarks = "bookmarks",
        BookmarkUpdates = "bookmarkUpdates",
        Folders = "folders",
        FolderUpdates = "folderUpdates",
    }

    function noDbError() {
        var error = new Error("Not connected to the server");
        error.code = InstapaperDBErrorCodes.NODB;
        return WinJS.Promise.wrapError(error);
    }

    function noClientInformationError() {
        var error = new Error("No client informaton");
        error.code = InstapaperDBErrorCodes.NOCLIENTINFORMATION;
        return WinJS.Promise.wrapError(error);
    }

    function extractFirstItemInArray(dataArray) {
        return dataArray[0];
    }

    function checkDb(func) {
        return function checkDbWrapper() {
            if (!this._db) {
                return noDbError();
            }

            return func.apply(this, arguments);
        };
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

    WinJS.Namespace.define("Codevoid.Storyvoid", {
        InstapaperDB: WinJS.Class.mix(WinJS.Class.define(function InstapaperDB_Constructor() {
        }, {
                _db: null,
                _name: null,
                _version: null,
                commonFolderDbIds: null,
                initialize: function initialize(name, version) {
                    this._name = name || Codevoid.Storyvoid.InstapaperDB.DBName;
                    this._version = version || Codevoid.Storyvoid.InstapaperDB.DBVersion;

                    var schema = {};
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
                    }, Codevoid.Storyvoid.InstapaperDB.createDefaultData).then(function saveDbDuringInit(db) {
                        this._db = db;
                    }.bind(this)).then(function getDefaultFolderIds() {
                        return WinJS.Promise.join({
                            archive: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive),
                            liked: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked),
                            unread: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread),
                            orphaned: this.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned),
                        });
                    }.bind(this)).then(function returnSelfToChain(data) {
                        this.commonFolderDbIds = {
                            archive: data.archive.id,
                            liked: data.liked.id,
                            unread: data.unread.id,
                            orphaned: data.orphaned.id,
                        };
                        return this;
                    }.bind(this));
                },
                listCurrentFolders: checkDb(function listCurrentFolders() {
                    /// <summary>
                    /// Returns a snap-shotted state of the current folders. This is
                    /// not a live collection, and thus doesn't refect changes
                    /// </summary>
                    return this._db.query(InstapaperDBTableNames.Folders).execute();
                }),
                addFolder: checkDb(function addFolder(folder, dontAddPendingEdit) {
                    /// <summary>
                    /// Adds a folder to the database, and optionally adds a pending edit.
                    ///
                    /// If the folder is already marked for deletion, it will merely drop
                    /// the pending "delete" if there is one.
                    /// </summary>
                    return this._db.index(InstapaperDBTableNames.Folders, "title").only(folder.title).then(function addProcessResults(results) {
                        if (!results || !results.length) {
                            return;
                        }

                        // Since we found an existing folder, we're going to error.
                        var error = new Error("Folder with the title '" + folder.title + "' already present");
                        error.code = InstapaperDBErrorCodes.FOLDER_DUPLICATE_TITLE;

                        return WinJS.Promise.wrapError(error);
                    }).then(function actuallyAddFolder() {
                        // Look for the pending edit for a folder titled liked this
                        return this._db.index(InstapaperDBTableNames.FolderUpdates, "title").only(folder.title).then(extractFirstItemInArray);
                    }.bind(this)).then(function resultOfInspectingPendingData(pendingItem) {
                        if (!pendingItem) {
                            // There wasn't a pending edit so just move on
                            return null;
                        }

                        // The old data from the DB, which we'll return to allow
                        // the folder to come back.
                        var dataToResurrect = {
                            folder_id: pendingItem.removedFolderId,
                            title: pendingItem.title,
                        };

                        // Throw away the pending edit now that we got the data on it. This means it looks like
                        // the folder had never been removed.
                        return this.deletePendingFolderEdit(pendingItem.id).then(function () {
                            return dataToResurrect;
                        });
                    }.bind(this)).then(function (existingFolderData) {
                        var folderData = existingFolderData || folder;

                        var completedPromise = this._db.add(InstapaperDBTableNames.Folders,
                            folderData).then(extractFirstItemInArray);

                        if (!dontAddPendingEdit && !existingFolderData) {
                            completedPromise = completedPromise.then(this._addPendingFolderEdit.bind(this));
                        }

                        return completedPromise;
                    }.bind(this)).then(function (data) {
                        this.dispatchEvent("folderschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                            folder_dbid: data.id,
                            title: data.title,
                            folder: data,
                        });
                        return data;
                    }.bind(this));
                }),
                getFolderByDbId: checkDb(function getFolderByDbId(folderDbId) {
                    return this._db.get(InstapaperDBTableNames.Folders, folderDbId);
                }),
                getFolderFromFolderId: checkDb(function getFolderDbIdFromFolderId(folderId) {
                    return this._db.index(InstapaperDBTableNames.Folders, "folder_id").
                        only(folderId).
                        then(extractFirstItemInArray).
                        then(function (folder) {
                            return folder;
                        });
                }),
                updateFolder: checkDb(function updateFolder(folderDetails) {
                    return this._db.put(InstapaperDBTableNames.Folders, folderDetails).then(extractFirstItemInArray).then(function (data) {
                        this.dispatchEvent("folderschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.UPDATE,
                            folder_dbid: data.id,
                            folder: data,
                        });

                        return data;
                    }.bind(this));
                }),
                removeFolder: checkDb(function removeFolder(folderId, dontAddPendingEdit) {
                    var completePromise = WinJS.Promise.as();
                    var wasUnsyncedEdit = false;

                    var folderBeingRemoved;
                    if (!dontAddPendingEdit) {
                        completePromise = this._db.get(InstapaperDBTableNames.Folders, folderId).then(function gotFolderToPerformPendingEdit(folder) {
                            folderBeingRemoved = folder;
                        });
                    }

                    completePromise = completePromise.then(function actuallyRemoveFolder() {
                        return this._db.remove(InstapaperDBTableNames.Folders, folderId);
                    }.bind(this)).then(function cleanupPendingAddsOnRemove() {
                        return this._db.index(InstapaperDBTableNames.FolderUpdates, "folder_dbid").only(folderId);
                    }.bind(this)).then(function checkForExistingUpdate(results) {
                        if (!results || !results.length) {
                            return;
                        }
                        wasUnsyncedEdit = true;

                        window.appassert(results.length === 1, "Didn't expect to find more than one pending edit for this folder");
                        return this.deletePendingFolderEdit(results[0].id);
                    }.bind(this));

                    if (!dontAddPendingEdit) {
                        completePromise = completePromise.then(function addPendingEditWhenRemoving() {
                            if (wasUnsyncedEdit) {
                                return;
                            }

                            // Deletes are a little different, so lets not use
                            // the _addPendingFolderEdit method here to ensure that we dont
                            // end up specialcasing that function up the wazoo.
                            var pendingEdit = {
                                type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                                removedFolderId: folderBeingRemoved.folder_id,
                                title: folderBeingRemoved.title,
                            };

                            return this._db.put(InstapaperDBTableNames.FolderUpdates, pendingEdit)
                        }.bind(this));
                    }

                    return completePromise.then(function makeSureCallerDoesntGetRandomValue() {
                        this.dispatchEvent("folderschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE,
                            folder_dbid: folderId,
                        });

                        // Stop the pending edit making it to the caller.
                        return;
                    }.bind(this));
                }),
                getPendingFolderEdits: checkDb(function getPendingFolderEdits() {
                    return this._db.query(InstapaperDBTableNames.FolderUpdates).execute();
                }),
                _addPendingFolderEdit: checkDb(function _addPendingFolderEdit(folderEditToPend) {
                    var pendingEdit = {
                        type: Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD,
                        folder_dbid: folderEditToPend.id,
                        title: folderEditToPend.title,
                    };

                    return this._db.put(InstapaperDBTableNames.FolderUpdates, pendingEdit).then(function returnOriginalFolderOnPend() {
                        return folderEditToPend;
                    });
                }),
                deletePendingFolderEdit: checkDb(function deletePendingFolderEdit(id) {
                    return this._db.remove(InstapaperDBTableNames.FolderUpdates, id);
                }),
                getPendingBookmarkEdits: checkDb(function getPendingBookmarkEdits(folder) {
                    var edits;
                    if (!folder) {
                        edits = this._db.query(InstapaperDBTableNames.BookmarkUpdates).execute();
                    } else {
                        edits = WinJS.Promise.join({
                            source: this._db.index(InstapaperDBTableNames.BookmarkUpdates, "sourcefolder_dbid").only(folder),
                            destination: this._db.index(InstapaperDBTableNames.BookmarkUpdates, "destinationfolder_dbid").only(folder),
                        }).then(function (data) {
                            return data.source.concat(data.destination);
                        });
                    }

                    edits = edits.then(function (pendingEdits) {
                        var adds = [];
                        var deletes = [];
                        var moves = [];
                        var likes = [];
                        var unlikes = [];

                        pendingEdits.forEach(function (pendingEdit) {
                            switch (pendingEdit.type) {
                                case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD:
                                    window.appassert(!folder, "Don't support folder specific adds");
                                    adds.push(pendingEdit);
                                    break;
                                case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE:
                                    deletes.push(pendingEdit);
                                    break;

                                case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE:
                                    moves.push(pendingEdit);
                                    break;

                                case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE:
                                    likes.push(pendingEdit);
                                    break;

                                case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE:
                                    unlikes.push(pendingEdit);
                                    break;

                                default:
                                    window.appfail("Unsupported edit type");
                                    break;
                            }
                        });

                        var result: any = {};

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
                    return edits;
                }),
                getPendingBookmarkAdds: checkDb(function getPendingBookmarkAdds() {
                    return this.getPendingBookmarkEdits().then(function (data) {
                        return data.adds || [];
                    });
                }),
                listCurrentBookmarks: checkDb(function listCurrentBookmarks(folder_dbid) {
                    if (folder_dbid && (folder_dbid === this.commonFolderDbIds.liked)) {
                        return this._db.index(InstapaperDBTableNames.Bookmarks, "starred").only(1);
                    } else if (folder_dbid && (folder_dbid !== Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked)) {
                        return this._db.index(InstapaperDBTableNames.Bookmarks, "folder_dbid").only(folder_dbid);
                    } else {
                        return this._db.query(InstapaperDBTableNames.Bookmarks).execute();
                    }
                }),
                addBookmark: checkDb(function addBookmark(bookmark) {
                    window.appassert(bookmark.folder_dbid, "No Folder DB ID provided");
                    if (!Object.hasOwnProperty(bookmark)) {
                        bookmark.contentAvailableLocally = false;
                    }
                    return this._db.add(InstapaperDBTableNames.Bookmarks, bookmark).then(extractFirstItemInArray).then(function (added) {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD,
                            bookmark_id: added.bookmark_id,
                            bookmark: added,
                        });

                        return added;
                    }.bind(this));
                }),
                addUrl: checkDb(function addUrl(bookmarkToAdd) {
                    return this._db.add(InstapaperDBTableNames.BookmarkUpdates, {
                        url: bookmarkToAdd.url,
                        title: bookmarkToAdd.title,
                        type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD
                    }).then(extractFirstItemInArray);
                }),
                deletePendingBookmarkEdit: checkDb(function checkdeletePendingBookmarkEdit(id) {
                    return this._db.remove(InstapaperDBTableNames.BookmarkUpdates, id);
                }),
                _getPendingEditForBookmarkAndType: checkDb(function _getPendingEditForBookmarkAndType(bookmark, type) {
                    return this._db.index(InstapaperDBTableNames.BookmarkUpdates, "bookmark_id").only(bookmark).then(function (results) {
                        if (!results || !results.length) {
                            return null;
                        }

                        var resultsOfType = results.filter(function (item) {
                            return (item.type === type);
                        });

                        window.appassert(resultsOfType.length < 2, "Should have only found one edit of specified type");
                        return resultsOfType[0];
                    });
                }),
                removeBookmark: checkDb(function removeBookmark(bookmark_id, fromServer) {
                    var sourcefolder_dbid;

                    var removedPromise = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                        sourcefolder_dbid = bookmark.folder_dbid;
                        return WinJS.Promise.join([
                            this._db.remove(InstapaperDBTableNames.Bookmarks, bookmark_id),
                            this._db.index(
                                InstapaperDBTableNames.BookmarkUpdates,
                                "bookmark_id").
                                only(bookmark_id).
                                then(function (pendingEditsForBookmark) {
                                    var removedEdits = [];

                                    // Find all the pending edits that aren't "likes" and
                                    // remove them. Likes are special, and should still be
                                    // left for syncing (before any other changes).
                                    pendingEditsForBookmark.filter(function (item) {
                                        return item.type !== Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE;
                                    }).forEach(function (existingPendingEdit) {
                                        removedEdits.push(this._db.remove(InstapaperDBTableNames.BookmarkUpdates, existingPendingEdit.id));
                                    }.bind(this));

                                    return WinJS.Promise.join(removedEdits);
                                }.bind(this))
                        ]);
                    }.bind(this));

                    // If it's not an edit from the server we need to add a pending
                    // delete that we can later sync to the server.
                    if (!fromServer) {
                        removedPromise = removedPromise.then(function () {
                            var edit = {
                                type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                                bookmark_id: bookmark_id,
                                sourcefolder_dbid: sourcefolder_dbid,
                            };

                            return this._db.put(InstapaperDBTableNames.BookmarkUpdates, edit);
                        }.bind(this));
                    }

                    return removedPromise.then(function () {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE,
                            bookmark_id: bookmark_id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        });
                        // Hide the result of the DB operation
                    }.bind(this));
                }),
                updateBookmark: checkDb(function updateBookmark(bookmark, dontRaiseChangeNotification) {
                    return this._db.put(InstapaperDBTableNames.Bookmarks, bookmark).then(extractFirstItemInArray).then(function (updated) {
                        if (!dontRaiseChangeNotification) {
                            this.dispatchEvent("bookmarkschanged", {
                                operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UPDATE,
                                bookmark_id: updated.bookmark_id,
                                bookmark: updated,
                            });
                        }

                        return updated;
                    }.bind(this));
                }),
                moveBookmark: checkDb(function moveBookmark(bookmark_id, destinationFolderDbId, fromServer) {
                    var data = {
                        bookmark: this.getBookmarkByBookmarkId(bookmark_id),
                        folder: this.getFolderByDbId(destinationFolderDbId),
                    };

                    var sourcefolder_dbid;

                    var movedBookmark = WinJS.Promise.join(data).then(function (data) {
                        if (!data.folder) {
                            var error = new Error();
                            error.code = InstapaperDBErrorCodes.FOLDER_NOT_FOUND;
                            return WinJS.Promise.wrapError(error);
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
                    }.bind(this));

                    if (!fromServer) {
                        movedBookmark = movedBookmark.then(function (movedBookmark) {
                            var completedData = {
                                bookmark: movedBookmark,
                                folder: data.folder,
                            };

                            return this._db.index(InstapaperDBTableNames.BookmarkUpdates,
                                "bookmark_id").
                                only(movedBookmark.bookmark_id).
                                then(function (pendingEditsForBookmark) {
                                    var removedEdits = [];

                                    // Find all the pending edits that are moves
                                    // and remove any pending edits so that we can end up
                                    // with only one.
                                    pendingEditsForBookmark.filter(function (item) {
                                        return item.type === Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE;
                                    }).forEach(function (existingMove) {
                                        removedEdits.push(this._db.remove(InstapaperDBTableNames.BookmarkUpdates, existingMove.id));
                                    }.bind(this));

                                    return WinJS.Promise.join(removedEdits);
                                }.bind(this)).then(function () {
                                    // Cheat and return the already completed promise
                                    // with the data we actually want. Allows the rest of
                                    // this function to behave cleanly.
                                    return WinJS.Promise.join(completedData);
                                });
                        }.bind(this)).then(function (data) {
                            var pendingEdit = {
                                type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                                bookmark_id: data.bookmark.bookmark_id,
                                destinationfolder_dbid: data.folder.id,
                                sourcefolder_dbid: sourcefolder_dbid,
                            };

                            return this._db.put(InstapaperDBTableNames.BookmarkUpdates, pendingEdit).then(function () {
                                return data.bookmark;
                            });
                        }.bind(this));
                    }

                    return movedBookmark.then(function (bookmark) {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE,
                            bookmark: bookmark,
                            bookmark_id: bookmark.bookmark_id,
                            destinationfolder_dbid: bookmark.folder_dbid,
                            sourcefolder_dbid: sourcefolder_dbid,
                        });
                        return bookmark;
                    }.bind(this));
                }),
                likeBookmark: checkDb(function likeBookmark(bookmark_id, dontAddPendingUpdate, ignoreMissingBookmark) {
                    var updatedBookmark = null;
                    var likedComplete = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                        var wasUnsyncedEdit = false;
                        var sourcefolder_dbid;

                        if (!bookmark) {
                            if (ignoreMissingBookmark) {
                                return;
                            }

                            var error = new Error();
                            error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                            error.message = "Didn't find bookmark with ID " + bookmark_id;
                            return WinJS.Promise.wrapError(error);
                        }

                        sourcefolder_dbid = bookmark.folder_dbid;

                        var promise;
                        if (bookmark.starred === 1) {
                            promise = WinJS.Promise.as(bookmark);
                        } else {
                            bookmark.starred = 1;

                            promise = this.updateBookmark(bookmark, true);
                        }

                        return promise.then(function (bookmark) {
                            updatedBookmark = bookmark;

                            return WinJS.Promise.join({
                                unlike: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE),
                                like: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE),
                            });
                        }.bind(this)).then(function (pendingEdits) {
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
                        }.bind(this)).then(function () {
                            var f = WinJS.Promise.as();
                            if (!dontAddPendingUpdate && !wasUnsyncedEdit) {
                                var edit = {
                                    type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE,
                                    bookmark_id: bookmark_id,
                                    sourcefolder_dbid: sourcefolder_dbid,
                                };

                                f = this._db.put(InstapaperDBTableNames.BookmarkUpdates, edit);
                            }

                            return f.then(function (bookmark) {
                                this.dispatchEvent("bookmarkschanged", {
                                    operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE,
                                    bookmark_id: updatedBookmark.bookmark_id,
                                    bookmark: updatedBookmark,
                                });
                            }.bind(this));
                        }.bind(this));
                    }.bind(this));

                    return likedComplete.then(function () {
                        return updatedBookmark;
                    });
                }),
                unlikeBookmark: checkDb(function unlikeBookmark(bookmark_id, dontAddPendingUpdate) {
                    var wasUnsyncedEdit = false;
                    var sourcefolder_dbid;
                    var updatedBookmark;

                    var unlikedBookmark = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                        if (!bookmark) {
                            var error = new Error();
                            error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                            return WinJS.Promise.wrapError(error);
                        }
                        sourcefolder_dbid = bookmark.folder_dbid;

                        if (bookmark.starred === 0) {
                            return WinJS.Promise.as(bookmark);
                        }

                        bookmark.starred = 0;
                        return this.updateBookmark(bookmark, true);
                    }.bind(this)).then(function (bookmark) {
                        updatedBookmark = bookmark
                        return WinJS.Promise.join({
                            like: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE),
                            unlike: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE),
                        });
                    }.bind(this)).then(function (pendingEdits) {
                        if (!pendingEdits.like && !pendingEdits.unlike) {
                            return;
                        }

                        wasUnsyncedEdit = true;

                        if (pendingEdits.unlike) {
                            return;
                        }

                        return this.deletePendingBookmarkEdit(pendingEdits.like.id);
                    }.bind(this));

                    if (!dontAddPendingUpdate) {
                        unlikedBookmark = unlikedBookmark.then(function () {
                            if (wasUnsyncedEdit) {
                                return;
                            }

                            var edit = {
                                type: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                                bookmark_id: bookmark_id,
                                sourcefolder_dbid: sourcefolder_dbid,
                            };

                            return this._db.put(InstapaperDBTableNames.BookmarkUpdates, edit);
                        }.bind(this));
                    }

                    return unlikedBookmark.then(function () {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE,
                            bookmark_id: updatedBookmark.bookmark_id,
                            bookmark: updatedBookmark,
                        });
                        return updatedBookmark;
                    }.bind(this));
                }),
                updateReadProgress: checkDb(function updateReadProgress(bookmark_id, progress) {
                    return this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                        if (!bookmark) {
                            var error = new Error();
                            error.code = InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND;
                            return WinJS.Promise.wrapError(error);
                        }

                        bookmark.progress = progress;
                        bookmark.progress_timestamp = Date.now();
                        // When upating progress locally, we need to invalidate our hash
                        // so that the service sees/thinks we've got different local data
                        // No, I'm not clear why, but thats what they said.
                        bookmark.hash = Math.random();

                        return this.updateBookmark(bookmark);
                    }.bind(this));
                }),
                getBookmarkByBookmarkId: checkDb(function getBookmarkByBookmarkId(bookmark_id) {
                    return this._db.get(InstapaperDBTableNames.Bookmarks, bookmark_id);
                }),
                deleteAllData: checkDb(function () {
                    this.dispose();
                    return db.deleteDb(this._name);
                }),
                dispose: function dispose() {
                    if (this._db) {
                        this._db.close();
                    }
                }
            }, {
                createDefaultData: function createDefaultData(server) {
                    // Create Folders
                    server.add("folders", [
                        { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, title: "Home" },
                        { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, title: "Liked" },
                        { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, title: "Archive" },
                        { folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, title: "orphaned", localOnly: true },
                    ]);
                },
                DBName: {
                    writable: false,
                    value: "Storyvoid",
                },
                DBVersion: {
                    writable: false,
                    value: 1,
                },
            }), WinJS.Utilities.eventMixin)
    });
}