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
        InstapaperDB: WinJS.Class.define(function InstapaperDB_Constructor(clientInformation) {
            this._clientInformation = clientInformation;
        }, {
            _db: null,
            _clientInformation: null,
            _remoteClients: null,
            _initRemoteClients: function _initRemoteClients() {
                if(!this._clientInformation) {
                    return;
                }

                this._remoteClients = {
                    bookmarks: new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(this._clientInformation),
                    folders: new Codevoid.ArticleVoid.InstapaperApi.Folders(this._clientInformation),
                };
            },
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
                        type: {}
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
                        folderTableId: {},
                        type: {},
                    }
                };

                return db.open({
                    server: Codevoid.ArticleVoid.InstapaperDB.DBName,
                    version: Codevoid.ArticleVoid.InstapaperDB.DBVersion,
                    schema: schema,
                }, Codevoid.ArticleVoid.InstapaperDB.createDefaultData).then(function saveDbDuringInit(db) {
                    this._db = db;
                }.bind(this)).then(function returnSelfToChain() {
                    return this;
                }.bind(this));
            },
            listCurrentFolders: checkDb(function listCurrentFolders() {
                /// <summary>
                /// Returns a snap-shotted state of the current folders. This is
                /// not a live collection, and thus doesn't refect changes
                /// </summary>
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable).execute()
            }),
            addFolder: checkDb(function addFolder(name, dontAddPendingEdit) {
                return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, "title").only(name).then(function addProcessResults(results) {
                    if (!results || !results.length) {
                        return;
                    }

                    var error = new Error("Folder with the name '" + name + "' already present");
                    error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE;

                    return WinJS.Promise.wrapError(error);
                }).then(function actuallyAddFolder() {
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, "title").only(name).then(extractFirstItemInArray);
                }.bind(this)).then(function resultOfInspectingPendingData(pendingItem) {
                    if (!pendingItem) {
                        return null;
                    }

                    var dataToResurrect = {
                        folder_id: pendingItem.removedFolderId,
                        title: pendingItem.title,
                    };

                    return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, pendingItem.id).then(function () {
                        return WinJS.Binding.as(dataToResurrect);
                    });
                }.bind(this)).then(function (existingFolderData) {
                    var folderData = existingFolderData || {};
                    folderData.title = name;

                    var completedPromise = this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable,
                                                        folderData).then(extractFirstItemInArray);

                    if (!dontAddPendingEdit && !existingFolderData) {
                        completedPromise = completedPromise.then(this._addPendingFolderEdit.bind(this));
                    }

                    return completedPromise;
                }.bind(this));
            }),
            getFolderByDbId: checkDb(function getFolderByDbId(folderId) {
                return this._db.get(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderId);
            }),
            updateFolder: checkDb(function updateFolder(folderDetails) {
                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFoldersTable, folderDetails);
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
                    return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, "folderTableId").only(folderId);
                }.bind(this)).then(function checkForExistingUpdate(results) {
                    if (!results || !results.length) {
                        return;
                    }
                    wasUnsyncedEdit = true;
                    appassert(results.length === 1, "Didn't expect to find more than one pending edit for this folder");

                    return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, results[0].id);
                }.bind(this));


                if (!dontAddPendingEdit) {
                    completePromise = completePromise.then(function addPendingEditWhenRemoving() {
                        if (wasUnsyncedEdit) {
                            return;
                        }

                        var pendingEdit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.PendingFolderEditTypes.DELETE,
                            removedFolderId: folderBeingRemoved.folder_id,
                            title: folderBeingRemoved.title,
                        };
                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, pendingEdit)
                    }.bind(this));
                }

                return completePromise.then(function makeSureCallerDoesntGetRandomValue() {
                    // Stop the pending edit making it to the caller.
                    return;
                });
            }),
            getPendingFolderEdits: checkDb(function getPendingFolderEdits() {
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable).execute();
            }),
            _addPendingFolderEdit: checkDb(function _addPendingFolderEdit(folderEditToPend) {
                var pendingEdit = {
                    type: Codevoid.ArticleVoid.InstapaperDB.PendingFolderEditTypes.ADD,
                    folderTableId: folderEditToPend.id,
                    title: folderEditToPend.title,
                };

                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, pendingEdit).then(function returnOriginalFolderOnPend() {
                    return folderEditToPend;
                });
            }),
            _deletePendingFolderEdit: checkDb(function _deletePendingFolderEdit(id) {
                return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBFolderUpdatesTable, id);
            }),
            getPendingBookmarkEdits: checkDb(function getPendingBookmarkEdits() {
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable).execute();
            }),
            listCurrentBookmarks: checkDb(function listCurrentBookmarks(folder_id) {
                return this._db.query(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable).execute();
            }),
            addBookmark: checkDb(function addBookmark(bookmark) {
                return this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark).then(extractFirstItemInArray);
            }),
            addUrl: checkDb(function addUrl(bookmarkToAdd) {
                return this._db.add(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, {
                    url: bookmarkToAdd.url,
                    title: bookmarkToAdd.title,
                    type: Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.ADD
                }).then(extractFirstItemInArray);
            }),
            _deletePendingBookmarkEdit: checkDb(function check_deletePendingBookmarkedit(id) {
                return this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, id);
            }),
            _getPendingEditForBookmarkAndType: checkDb(function _getPendingEditForBookmarkAndType(bookmark, type) {
                return this._db.index(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, "bookmark_id").only(bookmark).then(function (results) {
                    if(!results || !results.length) {
                        return null;
                    }

                    var resultsOfType = results.filter(function (item) {
                        return (item.type === type);
                    });

                    appassert(resultsOfType.length === 1, "Should have only found one edit of specified type");
                    return resultsOfType[0];
                });
            }),
            removeBookmark: checkDb(function removeBookmark(bookmark_id, fromServer) {
                var removedPromise = this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark_id)
                
                // If it's not an edit from the server we need to add a pending
                // delete that we can later sync to the server.
                if (!fromServer) {
                    removedPromise = removedPromise.then(function () {
                        var edit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.DELETE,
                            bookmark_id: bookmark_id,
                        };

                        this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this));
                }

                return removedPromise.then(function () {
                    // Hide the result of the DB operation
                });
            }),
            updateBookmark: checkDb(function updateBookmark(bookmark) {
                return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark).then(extractFirstItemInArray);
            }),
            moveBookmark: checkDb(function moveBookmark(bookmark_id, destinationFolderDbId, fromServer) {
                var data = {
                    bookmark: this.getBookmarkByBookmarkId(bookmark_id),
                    folder: this.getFolderByDbId(destinationFolderDbId),
                };

                var movedBookmark = WinJS.Promise.join(data).then(function (data) {
                    if (!data.folder) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.FOLDER_NOT_FOUND;
                        return WinJS.Promise.wrapError(error);
                    }

                    if (data.folder.folder_id) {
                        data.bookmark.folder_id = data.folder.folder_id;
                    } else {
                        data.bookmark.folder_id = null;
                    }

                    data.bookmark.folder_dbid = data.folder.id;

                    return this.updateBookmark(data.bookmark);
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
                                pendingEditsForBookmark.filter(function (item) {
                                    return item.type === Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.MOVE;
                                }).forEach(function(existingMove) {
                                    removedEdits.push(this._db.remove(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, existingMove.id));
                                }.bind(this));

                                return WinJS.Promise.join(removedEdits);
                            }.bind(this)).then(function() {
                                return WinJS.Promise.join(completedData);
                            });
                    }.bind(this)).then(function(data) {
                        var pendingEdit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.MOVE,
                            bookmark_id: data.bookmark.bookmark_id,
                            destinationfolder_dbid: data.folder.id,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, pendingEdit).then(function () {
                            return data.bookmark;
                        });
                    }.bind(this));
                }

                return movedBookmark;
            }),
            likeBookmark: checkDb(function likeBookmark(bookmark_id, dontAddPendingUpdate) {
                var wasUnsyncedEdit = false;

                var likedComplete = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    if (!bookmark) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND;
                        return WinJS.Promise.wrapError(error);
                    }

                    if (bookmark.starred === 1) {
                        return WinJS.Promise.as(bookmark);
                    }

                    bookmark.starred = 1;
                    return this.updateBookmark(bookmark);
                }.bind(this)).then(function () {
                    return this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.UNSTAR);
                }.bind(this)).then(function (pendingEdit) {
                    if (!pendingEdit) {
                        return;
                    }

                    wasUnsyncedEdit = true;

                    return this._deletePendingBookmarkEdit(pendingEdit.id);
                }.bind(this));

                if (!dontAddPendingUpdate) {
                    likedComplete = likedComplete.then(function () {
                        if (wasUnsyncedEdit) {
                            return;
                        }

                        var edit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.STAR,
                            bookmark_id: bookmark_id,
                        };

                        return this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this));
                }

                return likedComplete;
            }),
            unlikeBookmark: checkDb(function unlikeBookmark(bookmark_id, dontAddPendingUpdate) {
                var wasUnsyncedEdit = false;

                var unlikedBookmark = this.getBookmarkByBookmarkId(bookmark_id).then(function (bookmark) {
                    if (!bookmark) {
                        var error = new Error();
                        error.code = Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND;
                        return WinJS.Promise.wrapError(error);
                    }

                    if (bookmark.starred === 0) {
                        return WinJS.Promise.as(bookmark);
                    }

                    bookmark.starred = 0;
                    return this.updateBookmark(bookmark);
                }.bind(this)).then(function () {
                    return this._getPendingEditForBookmarkAndType(bookmark_id, Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.STAR);
                }.bind(this)).then(function (pendingEdit) {
                    if (!pendingEdit) {
                        return;
                    }

                    wasUnsyncedEdit = true;
                    
                    return this._deletePendingBookmarkEdit(pendingEdit.id);
                }.bind(this));

                if (!dontAddPendingUpdate) {
                    unlikedBookmark = unlikedBookmark.then(function () {
                        if (wasUnsyncedEdit) {
                            return;
                        }

                        var edit = {
                            type: Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.UNSTAR,
                            bookmark_id: bookmark_id,
                        };

                        this._db.put(Codevoid.ArticleVoid.InstapaperDB.DBBookmarkUpdatesTable, edit);
                    }.bind(this));
                }

                return unlikedBookmark;
            }),
            getBookmarkByBookmarkId: checkDb(function getBookmarkByBookmarkId(bookmark_id) {
                return this._db.get(Codevoid.ArticleVoid.InstapaperDB.DBBookmarksTable, bookmark_id);
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
                    { folder_id: Codevoid.ArticleVoid.InstapaperDB.CommonFolderIds.Archive, title: "archive" }
                ]);
            },
            CommonFolderIds: {
                Unread: "unread",
                Liked: "starred",
                Archive: "archive",
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
                FOLDER_NOT_FOUND: 5
            },
            PendingFolderEditTypes: {
                ADD: "add",
                DELETE: "delete",
            },
            PendingBookmarkEditTypes: {
                ADD: "add",
                DELETE: "delete",
                MOVE: "move",
                STAR: "star",
                UNSTAR: "unstar",
                ARCHIVE: "archive",
                UNARCHIVE: "unarchive",
            }
        }),
    });
})();