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
                    // Folder isn't present on the server, and since we're trying
                    // to delete the thing anyway, this is ok.
                    if (error && (error.error === 1242)) {
                        return;
                    }

                    return WinJS.Promise.wrapError(error);
                });
            },
            _syncFolders: function _syncFolders(db, folders) {
                return db.getPendingFolderEdits().then(function processPendingEdits(pendingEdits) {
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
                                return db.deletePendingFolderEdit(edit.id);
                            }));
                        }
                    }.bind(this));

                    return WinJS.Promise.join(syncs);
                }.bind(this)).then(function () {
                    return WinJS.Promise.join({
                        remoteFolders: this._folders.list(),
                        localFolders: db.listCurrentFolders(),
                    });
                }.bind(this)).then(function (data) {
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
                });
            },
            _syncBookmarks: function _syncBookmarks(db, dbIdOfFolderToSync) {
                var b = this._bookmarks;
                var folderId;
                
                return WinJS.Promise.join({
                    folder: db.getFolderByDbId(dbIdOfFolderToSync),
                    localBookmarks: db.listCurrentBookmarks(dbIdOfFolderToSync),
                }).then(function (data) {
                    folderId = data.folder.folder_id;
                    var localBookmarks = data.localBookmarks;
                    var haves = [];
                    localBookmarks.reduce(function (data, bookmark) {
                        data.push({
                            id: bookmark.bookmark_id,
                            hash: bookmark.hash,
                            progress: bookmark.progress,
                            progresLastChanged: bookmark.progressLastChanged,
                        });

                        return data;
                    }, haves);

                    return b.list({
                        folder_id: folderId,
                        haves: haves,
                    });
                }).then(function (result) {
                    var rb = result.bookmarks;
                    var localAdds = [];
                    rb.reduce(function (data, bookmark) {
                        bookmark.folder_dbid = dbIdOfFolderToSync;
                        bookmark.folder_id = folderId;
                        bookmark.starred = parseInt(bookmark.starred, 10);
                        data.push(db.addBookmark(bookmark, true));
                        return data;
                    }, localAdds);

                    return WinJS.Promise.join(localAdds);
                });
            },
            sync: function sync(options) {
                options = options || { folders: true, bookmarks: true };
                var syncFolders = (options.folders === undefined) ? true : options.folders;
                var syncBookmarks = (options.bookmarks === undefined) ? true : options.bookmarks;

                var db = new InstapaperDB();

                return db.initialize().then(function startSync() {
                    if (!syncFolders) {
                        return;
                    }

                    return this._syncFolders(db);
                }.bind(this)).then(function () {
                    if (!syncBookmarks) {
                        return;
                    }

                    return this._syncBookmarks(db, db.commonFolderDbIds.unread);
                }.bind(this)).then(function () {
                    return WinJS.Promise.timeout();
                });
            },
        }),
    });
})();