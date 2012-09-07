(function () {
    "use strict";

    var InstapaperApi = Codevoid.ArticleVoid.InstapaperApi;
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;

    function isDefaultFolder(id) {
        switch (id) {
            case InstapaperDB.CommonFolderIds.Archive:
            case InstapaperDB.CommonFolderIds.Liked:
            case InstapaperDB.CommonFolderIds.Unread:
                return true;

            default:
                return false;
        }
    }

    WinJS.Namespace.define("Codevoid.ArticleVoid", {
        InstapaperSync: WinJS.Class.define(function (clientInformation) {
            this._clientInformation = clientInformation;
        }, {
            _clientInformation: null,
            _foldersStorage: null,
            _folders: {
                get: function () {
                    if (!this._foldersStorage) {
                        this._foldersStorage = new InstapaperApi.Folders(this._clientInformation);
                    }

                    return this._foldersStorage;
                }
            },
            _bookmarksStorage: null,
            _bookmarks: {
                get: function() {
                    if(!this._bookmarksStorage) {
                        this._bookmarksStorage = new InstapaperApi.Bookmarks(this._clientInformation);
                    }

                    return this._bookmarksStorage;
                }
            },
            _addFolderPendingEdit: function _addFolderPendingEdit(edit, db) {
                return WinJS.Promise.join({
                    local: db.getFolderByDbId(edit.folderTableId),
                    remote: this._folders.add(edit.title).then(null, function (error) {
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
                        return this._folders.list().then(function (remoteFolders) {
                            // reduce it down to the folder that was already there. note
                            // that if we dont find it -- which we should -- all
                            // hell is gonna break loose here.
                            return remoteFolders.reduce(function (result, folder) {
                                if (result) {
                                    return result;
                                }

                                if (folder.title === edit.title) {
                                    return folder;
                                }

                                return null;
                            }, null);
                        });
                    }.bind(this)),
                }).then(function (data) {
                    Object.keys(data.remote).forEach(function (key) {
                        data.local[key] = data.remote[key];
                    });

                    return db.updateFolder(data.local);
                });
            },
            _removeFolderPendingEdit: function _removeFolderPendingEdit(edit, db) {
                return this._folders.deleteFolder(edit.removedFolderId).then(null, function (error) {
                    if (error && (error.error === 1242)) {
                        return;
                    }

                    return WinJS.Promise.wrapError(error);
                });
            },
            sync: function sync() {
                var db = new InstapaperDB();
                var f = this._folders;

                return db.initialize().then(function startSync() {
                    return db.getPendingFolderEdits();
                }).then(function processPendingEdits(pendingEdits) {
                    var syncs = [];
                    
                    pendingEdits.forEach(function (edit) {
                        var syncPromise;
                        switch (edit.type) {
                            case InstapaperDB.PendingFolderEditTypes.ADD:
                                syncPromise = this._addFolderPendingEdit(edit, db);
                                break;

                            case InstapaperDB.PendingFolderEditTypes.DELETE:
                                syncPromise = this._removeFolderPendingEdit(edit, db);
                                break;

                            default:
                                appassert(false, "Shouldn't see other edit types");
                                break;
                        }

                        if (syncPromise) {
                            syncs.push(syncPromise.then(function () {
                                return db._deletePendingFolderEdit(edit.id);
                            }));
                        }
                    }.bind(this));

                    return WinJS.Promise.join(syncs);
                }.bind(this)).then(function () {
                    return WinJS.Promise.join({
                        remoteFolders: f.list(),
                        localFolders: db.listCurrentFolders(),
                    });
                }).then(function (data) {
                    var syncs = [];

                    // Find all the changes from the remote server
                    // that aren't locally for folders on the server
                    data.remoteFolders.forEach(function (rf) {
                        var synced = db.getFolderFromFolderId(rf.folder_id).then(function (lf) {
                            var done = WinJS.Promise.as();

                            if (!lf) {
                                done = db.addFolder(rf, true);
                            } else {
                                if (rf.title !== lf.title) {
                                    lf.title = rf.title;
                                    done = db.updateFolder(lf);
                                }
                            }

                            return done;
                        });

                        syncs.push(synced);
                    });

                    // Find all the folders that are not on the server, that
                    // we have locally.
                    var removedFolderPromises = []
                    data.localFolders.reduce(function (promises, item) {
                        // Default folders are ignored for any syncing behaviour
                        // since they're uneditable.
                        if (isDefaultFolder(item.folder_id)) {
                            return promises;
                        }

                        var isInRemote = data.remoteFolders.some(function (remoteItem) {
                            return remoteItem.folder_id === item.folder_id;
                        });

                        if (!isInRemote) {
                            promises.push(db.removeFolder(item.id, true));
                        }
                        return promises;
                    }, removedFolderPromises);

                    syncs = syncs.concat(removedFolderPromises);

                    return WinJS.Promise.join(syncs);
                }).then(function () {
                    return WinJS.Promise.timeout();
                });
            },
        }),
    });
})();