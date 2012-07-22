(function () {
    "use strict";

    function noDbError() {
        var error = new Error("Not connected to the server");
        error.code = Codevoid.ArticleVoid.DB.InstapaperDB.ErrorCodes.NODB;
        return WinJS.Promise.wrapError(error);
    }

    function noClientInformationError() {
        var error = new Error("No client informaton");
        error.code = Codevoid.ArticleVoid.DB.InstapaperDB.ErrorCodes.NOCLIENTINFORMATION;
        return WinJS.Promise.wrapError(error);
    }

    function extractFirstItemInArray(dataArray) {
        return dataArray[0];
    }

    WinJS.Namespace.define("Codevoid.ArticleVoid.DB", {
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
                schema[Codevoid.ArticleVoid.DB.InstapaperDB.DBBoomarksTable] = {
                    key: {
                        keyPath: "id",
                        autoIncrement: true
                    }
                };

                schema[Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable] = {
                    key: {
                        keyPath: "id",
                        autoIncrement: true
                    },
                    indexes: {
                        title: {},
                    }
                };

                schema[Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable] = {
                    key: {
                        keyPath: "id",
                        autoIncrement: true
                    },
                    indexes: {
                        title: {},
                        folderTableId: {},
                    }
                };

                return db.open({
                    server: Codevoid.ArticleVoid.DB.InstapaperDB.DBName,
                    version: Codevoid.ArticleVoid.DB.InstapaperDB.DBVersion,
                    schema: schema,
                }, Codevoid.ArticleVoid.DB.InstapaperDB.createDefaultData).then(function saveDbDuringInit(db) {
                    this._db = db;
                }.bind(this)).then(function returnSelfToChain() {
                    return this;
                }.bind(this));
            },
            listCurrentFolders: function listCurrentFolders() {
                /// <summary>
                /// Returns a snap-shotted state of the current folders. This is
                /// not a live collection, and thus doesn't refect changes
                /// </summary>
                if (!this._db) {
                    return noDbError();
                }

                return this._db.query(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable).execute()
            },
            addFolder: function addFolder(name, dontAddPendingEdit) {
                if (!this._db) {
                    return noDbError();
                }

                return this._db.index(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable, "title").only(name).then(function addProcessResults(results) {
                    if (!results || !results.length) {
                        return;
                    }

                    var error = new Error("Folder with the name '" + name + "' already present");
                    error.code = Codevoid.ArticleVoid.DB.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE;

                    return WinJS.Promise.wrapError(error);
                }).then(function actuallyAddFolder() {
                    return this._db.index(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, "title").only(name).then(extractFirstItemInArray);
                }.bind(this)).then(function resultOfInspectingPendingData(pendingItem) {
                    if (!pendingItem) {
                        return null;
                    }

                    var dataToResurrect = {
                        folder_id: pendingItem.removedFolderId,
                        title: pendingItem.title,
                    };

                    return this._db.remove(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, pendingItem.id).then(function () {
                        return WinJS.Binding.as(dataToResurrect);
                    });
                }.bind(this)).then(function (existingFolderData) {
                    var folderData = existingFolderData || {};
                    folderData.title = name;

                    var completedPromise = this._db.add(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable,
                                                        folderData).then(extractFirstItemInArray);

                    if (!dontAddPendingEdit && !existingFolderData) {
                        completedPromise = completedPromise.then(this._addPendingFolderEdit.bind(this));
                    }

                    return completedPromise;
                }.bind(this));
            },
            getFolderByDbId: function getFolderByDbId(folderId) {
                if (!this._db) {
                    return noDbError();
                }

                return this._db.get(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable, folderId);
            },
            updateFolder: function updateFolder(folderDetails) {
                if (!this._db) {
                    return noDbError();
                }

                return this._db.put(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable, folderDetails);
            },
            removeFolder: function removeFolder(folderId, dontAddPendingEdit) {
                if (!this._db) {
                    return noDbError();
                }

                var completePromise = WinJS.Promise.as();
                var wasUnsyncedEdit = false;

                var folderBeingRemoved;
                if (!dontAddPendingEdit) {
                    completePromise = this._db.get(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable, folderId).then(function gotFolderToPerformPendingEdit(folder) {
                        folderBeingRemoved = folder;
                    });
                }

                completePromise = completePromise.then(function actuallyRemoveFolder() {
                    return this._db.remove(Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable, folderId);
                }.bind(this)).then(function cleanupPendingAddsOnRemove() {
                    return this._db.index(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, "folderTableId").only(folderId);
                }.bind(this)).then(function checkForExistingUpdate(results) {
                    if (!results || !results.length) {
                        return;
                    }
                    wasUnsyncedEdit = true;
                    appassert(results.length === 1, "Didn't expect to find more than one pending edit for this folder");

                    return this._db.remove(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, results[0].id);
                }.bind(this));


                if (!dontAddPendingEdit) {
                    completePromise = completePromise.then(function addPendingEditWhenRemoving() {
                        if (wasUnsyncedEdit) {
                            return;
                        }

                        var pendingEdit = {
                            type: Codevoid.ArticleVoid.DB.InstapaperDB.PendingEditTypes.DELETE,
                            removedFolderId: folderBeingRemoved.folder_id,
                            title: folderBeingRemoved.title,
                        };
                        return this._db.put(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, pendingEdit)
                    }.bind(this));
                }

                return completePromise.then(function makeSureCallerDoesntGetRandomValue() {
                    // Stop the pending edit making it to the caller.
                    return;
                });
            },
            getPendingFolderEdits: function getPendingFolderEdits() {
                if (!this._db) {
                    return noDbError();
                }

                return this._db.query(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable).execute();
            },
            _addPendingFolderEdit: function _addPendingFolderEdit(folderEditToPend) {
                if (!this._db) {
                    return noDbError();
                }

                var pendingEdit = {
                    type: Codevoid.ArticleVoid.DB.InstapaperDB.PendingEditTypes.ADD,
                    folderTableId: folderEditToPend.id,
                    title: folderEditToPend.title,
                };

                return this._db.put(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, pendingEdit).then(function returnOriginalFolderOnPend() {
                    return folderEditToPend;
                });
            },
            _deletePendingFolderEdit: function _deletePendingFolderEdit(id) {
                if (!this._db) {
                    return noDbError();
                }

                return this._db.remove(Codevoid.ArticleVoid.DB.InstapaperDB.DBFolderUpdatesTable, id);
            },
            dispose: function dispose() {
                if (this._server) {
                    this._server.close();
                }
            }
        }, {
            createDefaultData: function createDefaultData(server) {
                // Create Folders
                server.add("folders", [
                    { folder_id: "unread", title: "unread" },
                    { folder_id: "starred", title: "liked" },
                    { folder_id: "archive", title: "archive" }
                ]);
            },
            DBName: {
                writable: false,
                value: "ArticleVoid",
            },
            DBVersion: {
                writable: false,
                value: 1
            },
            DBBookmarksTable: {
                writable: false,
                value: "bookmarks",
            },
            DBFoldersTable: {
                writable: false,
                value: "folders"
            },
            DBFolderUpdatesTable: {
                writable: false,
                value: "folderUpdates"
            },
            ErrorCodes: {
                NODB: 1,
                NOCLIENTINFORMATION: 2,
                FOLDER_DUPLICATE_TITLE: 3,
            },
            PendingEditTypes: {
                ADD: "add",
                DELETE: "delete",
            }
        }),
    });
})();