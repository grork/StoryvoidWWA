(function () {
    "use strict";

    function noDbError() {
        var error = new Error("Not connected to the server");
        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.NODB;
        return WinJS.Promise.wrapError(error);
    }

    function noClientInformationError() {
        var error = new Error("No client informaton");
        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.NOCLIENTINFORMATION;
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
        }
    }

    WinJS.Namespace.define("Codevoid.ArticleVoid", {
        InstapaperDB: WinJS.Class.mix(WinJS.Class.define(function InstapaperDB_Constructor() {
        }, {
            _db: null,
            commonFolderDbIds: null,
            initialize: function initialize() {
                var schema = {};
                schema[Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable] = {
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

                schema[Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable] = {
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

                schema[Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable] = {
                    key: {
                        keyPath: "id",
                        autoIncrement: true
                    },
                    indexes: {
                        title: {},
                        folder_id: {},
                    }
                };

                schema[Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable] = {
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
                    server: Codevoid.ArticleVoid.InstapaperDB.DBName,
                    version: Codevoid.ArticleVoid.InstapaperDB.DBVersion,
                    schema: schema,
                }, Codevoid.ArticleVoid.InstapaperDB.createDefaultData).then(function saveDbDuringInit(db) {
                    this._db = db;
                }.bind(this)).then(function getDefaultFolderIds() {
                    return WinJS.Promise.join({
                        archive: this.getFolderFromFolderId(Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Archive),
                        liked: this.getFolderFromFolderId(Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Liked),
                        unread: this.getFolderFromFolderId(Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Unread),
                        orphaned: this.getFolderFromFolderId(Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Orphaned),
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
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable).execute();
            }),
            addFolder: checkDb(function addFolder(folder, dontAddPendingEdit) {
                /// <summary>
                /// Adds a folder to the database, and optionally adds a pending edit.
                ///
                /// If the folder is already marked for deletion, it will merely drop
                /// the pending "delete" if there is one.
                /// </summary>
                return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, "title").only(folder.title).then(function addProcessResults(results) {
                    if (!results || !results.length) {
                        return;
                    }

                    // Since we found an existing folder, we're going to error.
                    var error = new Error("Folder with the title '" + folder.title + "' already present");
                    error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE;

                    return WinJS.Promise.wrapError(error);
                }).then(function actuallyAddFolder() {
                    // Look for the pending edit for a folder titled liked this
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, "title").only(folder.title).then(extractFirstItemInArray);
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

                    var completedPromise = this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable,
                                                        folderData).then(extractFirstItemInArray);

                    if (!dontAddPendingEdit && !existingFolderData) {
                        completedPromise = completedPromise.then(this._addPendingFolderEdit.bind(this));
                    }

                    return completedPromise;
                }.bind(this)).then(function (data) {
                    this.dispatchEvent("folderschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.FolderChangeTypes.ADD,
                        folder_dbid: data.id,
                        title: data.title,
                    });
                    return data;
                }.bind(this));
            }),
            getFolderByDbId: checkDb(function getFolderByDbId(folderDbId) {
                return this._db.get(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderDbId);
            }),
            getFolderFromFolderId: checkDb(function getFolderDbIdFromFolderId(folderId) {
                return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, "folder_id").
                    only(folderId).
                    then(extractFirstItemInArray).
                    then(function (folder) {
                        return folder;
                    });
            }),
            updateFolder: checkDb(function updateFolder(folderDetails) {
                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderDetails).then(extractFirstItemInArray).then(function (data) {
                    this.dispatchEvent("folderschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.FolderChangeTypes.UPDATE,
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
                    completePromise = this._db.get(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderId).then(function gotFolderToPerformPendingEdit(folder) {
                        folderBeingRemoved = folder;
                    });
                }

                completePromise = completePromise.then(function actuallyRemoveFolder() {
                    return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderId);
                }.bind(this)).then(function cleanupPendingAddsOnRemove() {
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, "folder_dbid").only(folderId);
                }.bind(this)).then(function checkForExistingUpdate(results) {
                    if (!results || !results.length) {
                        return;
                    }
                    wasUnsyncedEdit = true;
                    appassert(results.length === 1, "Didn't expect to find more than one pending edit for this folder");

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
                            type: Codevoid.ArticleVoid.InstapaperDB.FolderChangeTypes.DELETE,
                            removedFolderId: folderBeingRemoved.folder_id,
                            title: folderBeingRemoved.title,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, pendingEdit)
                    }.bind(this));
                }

                return completePromise.then(function makeSureCallerDoesntGetRandomValue() {
                    this.dispatchEvent("folderschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.FolderChangeTypes.DELETE,
                        folder_dbid: folderId,
                    });

                    // Stop the pending edit making it to the caller.
                    return;
                }.bind(this));
            }),
            getPendingFolderEdits: checkDb(function getPendingFolderEdits() {
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable).execute();
            }),
            _addPendingFolderEdit: checkDb(function _addPendingFolderEdit(folderEditToPend) {
                var pendingEdit = {
                    type: Codevoid.ArticleVoid.InstapaperDB.FolderChangeTypes.ADD,
                    folder_dbid: folderEditToPend.id,
                    title: folderEditToPend.title,
                };

                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, pendingEdit).then(function returnOriginalFolderOnPend() {
                    return folderEditToPend;
                });
            }),
            deletePendingFolderEdit: checkDb(function deletePendingFolderEdit(id) {
                return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, id);
            }),
            getPendingBookmarkEdits: checkDb(function getPendingBookmarkEdits(folder) {
                var edits;
                if (!folder) {
                    edits = this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable).execute();
                } else {
                    edits = WinJS.Promise.join({
                        source: this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, "sourcefolder_dbid").only(folder),
                        destination: this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, "destinationfolder_dbid").only(folder),
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
                            case Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.ADD:
                                appassert(!folder, "Don't support folder specific adds");
                                adds.push(pendingEdit);
                                break;
                            case Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.DELETE:
                                deletes.push(pendingEdit);
                                break;

                            case Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.MOVE:
                                moves.push(pendingEdit);
                                break;

                            case Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE:
                                likes.push(pendingEdit);
                                break;

                            case Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UNLIKE:
                                unlikes.push(pendingEdit);
                                break;

                            default:
                                appfail("Unsupported edit type");
                                break;
                        }
                    });

                    var result = {};

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
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, "starred").only(1);
                } else if (folder_dbid && (folder_dbid !== Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Liked)) {
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, "folder_dbid").only(folder_dbid);
                } else {
                    return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable).execute();
                }
            }),
            addBookmark: checkDb(function addBookmark(bookmark) {
                appassert(bookmark.folder_dbid, "No Folder DB ID provided");

                return this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark).then(extractFirstItemInArray).then(function (added) {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.ADD,
                        bookmark_id: added.bookmark_id,
                        bookmark: added,
                    });

                    return added;
                }.bind(this));
            }),
            addUrl: checkDb(function addUrl(bookmarkToAdd) {
                return this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, {
                    url: bookmarkToAdd.url,
                    title: bookmarkToAdd.title,
                    type: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.ADD
                }).then(extractFirstItemInArray);
            }),
            deletePendingBookmarkEdit: checkDb(function checkdeletePendingBookmarkEdit(id) {
                return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, id);
            }),
            _getPendingEditForBookmarkAndType: checkDb(function _getPendingEditForBookmarkAndType(bookmark, type) {
                return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, "bookmark_id").only(bookmark).then(function (results) {
                    if (!results || !results.length) {
                        return null;
                    }

                    var resultsOfType = results.filter(function (item) {
                        return (item.type === type);
                    });

                    appassert(resultsOfType.length < 2, "Should have only found one edit of specified type");
                    return resultsOfType[0];
                });
            }),
            removeBookmark: checkDb(function removeBookmark(bookmark_id, fromServer) {
                var sourcefolder_dbid;

                var removedPromise = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    sourcefolder_dbid = bookmark.folder_dbid;
                    return WinJS.Promise.join([
                        this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark_id),
                        this._db.index(
                            Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable,
                            "bookmark_id").
                            only(bookmark_id).
                            then(function (pendingEditsForBookmark) {
                                var removedEdits = [];

                                // Find all the pending edits that aren't "likes" and
                                // remove them. Likes are special, and should still be
                                // left for syncing (before any other changes).
                                pendingEditsForBookmark.filter(function (item) {
                                    return item.type !== Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE;
                                }).forEach(function (existingPendingEdit) {
                                    removedEdits.push(this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, existingPendingEdit.id));
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
                            type: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.DELETE,
                            bookmark_id: bookmark_id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this));
                }

                return removedPromise.then(function () {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.DELETE,
                        bookmark_id: bookmark_id,
                    });
                    // Hide the result of the DB operation
                }.bind(this));
            }),
            updateBookmark: checkDb(function updateBookmark(bookmark, dontRaiseChangeNotification) {
                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark).then(extractFirstItemInArray).then(function (updated) {
                    if (!dontRaiseChangeNotification) {
                        this.dispatchEvent("bookmarkschanged", {
                            operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UPDATE,
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
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.FOLDER_NOT_FOUND;
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
                        case Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Liked:
                            var invalidDestinationFolder = new Error();
                            invalidDestinationFolder.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.INVALID_DESTINATION_FOLDER;
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

                        return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable,
                                        "bookmark_id").
                            only(movedBookmark.bookmark_id).
                            then(function (pendingEditsForBookmark) {
                                var removedEdits = [];

                                // Find all the pending edits that are moves
                                // and remove any pending edits so that we can end up
                                // with only one.
                                pendingEditsForBookmark.filter(function (item) {
                                    return item.type === Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.MOVE;
                                }).forEach(function (existingMove) {
                                    removedEdits.push(this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, existingMove.id));
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
                            type: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.MOVE,
                            bookmark_id: data.bookmark.bookmark_id,
                            destinationfolder_dbid: data.folder.id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, pendingEdit).then(function () {
                            return data.bookmark;
                        });
                    }.bind(this));
                }

                return movedBookmark.then(function (bookmark) {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.MOVE,
                        bookmark: bookmark,
                        bookmark_id: bookmark.bookmark_id,
                        destinationfolder_dbid: bookmark.folder_dbid,
                        sourcefolder_dbid: sourcefolder_dbid,
                    });
                    return bookmark;
                }.bind(this));
            }),
            likeBookmark: checkDb(function likeBookmark(bookmark_id, dontAddPendingUpdate) {
                var wasUnsyncedEdit = false;
                var sourcefolder_dbid;
                var updatedBookmark;

                var likedComplete = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    if (!bookmark) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND;
                        error.message = "Didn't find bookmark with ID " + bookmark_id;
                        return WinJS.Promise.wrapError(error);
                    }

                    sourcefolder_dbid = bookmark.folder_dbid;

                    if (bookmark.starred === 1) {
                        return WinJS.Promise.as(bookmark);
                    }

                    bookmark.starred = 1;
                    return this.updateBookmark(bookmark, true);
                }.bind(this)).then(function (bookmark) {
                    updatedBookmark = bookmark;

                    return WinJS.Promise.join({
                        unlike: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UNLIKE),
                        like: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE),
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
                    // Mark sure we dont return the edited bookmark to the caller.
                    return updatedBookmark;
                });

                if (!dontAddPendingUpdate) {
                    likedComplete = likedComplete.then(function () {
                        if (wasUnsyncedEdit) {
                            return;
                        }

                        var edit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE,
                            bookmark_id: bookmark_id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this)).then(function () {
                        // Make sure we return the edited bookmark to the caller
                        return updatedBookmark;
                    });
                }

                return likedComplete.then(function (bookmark) {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE,
                        bookmark_id: bookmark.bookmark_id
                    });

                    return bookmark;
                }.bind(this));
            }),
            unlikeBookmark: checkDb(function unlikeBookmark(bookmark_id, dontAddPendingUpdate) {
                var wasUnsyncedEdit = false;
                var sourcefolder_dbid;
                var updatedBookmark;

                var unlikedBookmark = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    if (!bookmark) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND;
                        return WinJS.Promise.wrapError(error);
                    }
                    sourcefolder_dbid = bookmark.folder_dbid;

                    if (bookmark.starred === 0) {
                        return WinJS.Promise.as(bookmark);
                    }

                    bookmark.starred = 0;
                    return this.updateBookmark(bookmark);
                }.bind(this)).then(function (bookmark) {
                    updatedBookmark = bookmark
                    return WinJS.Promise.join({
                        like: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.LIKE),
                        unlike: this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UNLIKE),
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
                            type: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UNLIKE,
                            bookmark_id: bookmark_id,
                            sourcefolder_dbid: sourcefolder_dbid,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this));
                }

                return unlikedBookmark.then(function () {
                    this.dispatchEvent("bookmarkschanged", {
                        operation: Codevoid.ArticleVoid.InstapaperDB.BookmarkChangeTypes.UNLIKE,
                        bookmark_id: updatedBookmark.bookmark_id
                    }); 
                    return updatedBookmark;
                }.bind(this));
            }),
            updateReadProgress: checkDb(function updateReadProgress(bookmark_id, progress) {
                return this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    if (!bookmark) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND;
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
                return this._db.get(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark_id);
            }),
            deleteAllData: checkDb(function () {
                this.dispose();
                return db.deleteDb(Codevoid.ArticleVoid.InstapaperDB.DBName);
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
                    { folder_id: Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Unread, title: "unread" },
                    { folder_id: Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Liked, title: "liked" },
                    { folder_id: Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Archive, title: "archive" },
                    { folder_id: Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Orphaned, title: "orphaned", localOnly: true },
                ]);
            },
            CommonFolderIds: {
                Unread: "unread",
                Liked: "starred",
                Archive: "archive",
                Orphaned: "orphaned",
            },
            DBName: {
                writable: false,
                value: "ArticleVoid",
            },
            DBVersion: {
                writable: false,
                value: 1,
            },
            DBBookmarksTable: {
                writable: false,
                value: "bookmarks",
            },
            DBBookmarkUpdatesTable: {
                writable: false,
                value: "bookmarkUpdates",
            },
            DBFoldersTable: {
                writable: false,
                value: "folders",
            },
            DBFolderUpdatesTable: {
                writable: false,
                value: "folderUpdates",
            },
            ErrorCodes: {
                NODB: 1,
                NOCLIENTINFORMATION: 2,
                FOLDER_DUPLICATE_TITLE: 3,
                BOOKMARK_NOT_FOUND: 4,
                FOLDER_NOT_FOUND: 5,
                INVALID_DESTINATION_FOLDER: 6,
            },
            FolderChangeTypes: {
                ADD: "add",
                DELETE: "delete",
                UPDATE: "update",
            },
            BookmarkChangeTypes: {
                ADD: "add",
                DELETE: "delete",
                MOVE: "move",
                LIKE: "star",
                UNLIKE: "unstar",
                UPDATE: "update",
            }
        }), WinJS.Utilities.eventMixin)
    });
})();