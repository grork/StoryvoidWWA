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
                get: function () {
                    if (!this._bookmarksStorage) {
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
                    // Find all the changes from the remote server
                    // that aren't locally for folders on the server
                    var syncs = data.remoteFolders.reduce(function (data, rf) {
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

                        data.push(synced);
                        return data;
                    }, []);

                    // Find all the folders that are not on the server, that
                    // we have locally.
                    syncs = data.localFolders.reduce(function (promises, item) {
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
                    }, syncs);

                    return WinJS.Promise.join(syncs);
                });
            },
            _syncBookmarks: function _syncBookmarks(db) {
                return this._syncBookmarkPendingAdds(db).then(function () {
                    return WinJS.Promise.join({
                        sync: this._syncBookmarksForFolder(db, db.commonFolderDbIds.unread),
                        timeout: WinJS.Promise.timeout(),
                    });
                }.bind(this)).then(function () {
                    return this._syncLikes(db);
                }.bind(this));
            },
            _syncBookmarkPendingAdds: function _syncBookmarkPendingAdds(db) {
                var b = this._bookmarks;

                return db.getPendingBookmarkAdds().then(function (pendingAdds) {
                    var remoteAdds = pendingAdds.reduce(function (data, add) {
                        var addPromise = b.add({
                            url: add.url,
                            title: add.title,
                        }).then(function () {
                            return db.deletePendingBookmarkEdit(add.id);
                        });

                        data.push(addPromise);
                        return data;
                    }, []);

                    return WinJS.Promise.join(remoteAdds);
                });
            },
            _syncBookmarksForFolder: function _syncBookmarksForFolder(db, dbIdOfFolderToSync) {
                var b = this._bookmarks;
                var folderId;

                return db.getPendingBookmarkEdits(dbIdOfFolderToSync).then(function (pendingEdits) {
                    var operations = [];

                    if(pendingEdits.moves) {
                        pendingEdits.moves.forEach(function(move) {
                            var operation;

                            switch(move.destinationfolder_dbid) {
                                case db.commonFolderDbIds.archive:
                                    operation = b.archive(move.bookmark_id);
                                    break;

                                default:
                                    operation = db.getFolderByDbId(move.destinationfolder_dbid).then(function (folder) {
                                        return b.move({ bookmark_id: move.bookmark_id, destination: folder.folder_id });
                                    });
                                    break;
                            }

                            operations.push(operation.then(function () {
                                return db.deletePendingBookmarkEdit(move.id);
                            }));
                        });
                    }


                    return WinJS.Promise.join({
                        remoteOperations: WinJS.Promise.join(operations),
                        folder: db.getFolderByDbId(dbIdOfFolderToSync),
                        localBookmarks: db.listCurrentBookmarks(dbIdOfFolderToSync),
                    });
                }).then(function (data) {
                    folderId = data.folder.folder_id;
                    var localBookmarks = data.localBookmarks;
                    var haves = localBookmarks.reduce(function (data, bookmark) {
                        data.push({
                            id: bookmark.bookmark_id,
                            hash: bookmark.hash,
                            progress: bookmark.progress,
                            progressLastChanged: bookmark.progress_timestamp,
                        });

                        return data;
                    }, []);

                    return b.list({
                        folder_id: folderId,
                        have: haves,
                    });
                }).then(function (result) {
                    var rb = result.bookmarks;
                    var localAdds = rb.reduce(function (data, bookmark) {
                        bookmark.folder_dbid = dbIdOfFolderToSync;
                        bookmark.folder_id = folderId;
                        bookmark.starred = parseInt(bookmark.starred, 10);
                        bookmark.progress = parseFloat(bookmark.progress);
                        data.push(db.updateBookmark(bookmark));
                        return data;
                    }, []);

                    return WinJS.Promise.join(localAdds);
                });
            },
            _syncLikes: function _syncLikes(db) {
                var b = this._bookmarks;
                var localLikesBeforeSync;

                return db.getPendingBookmarkEdits().then(function (edits) {
                    var operations = [];

                    if (edits.likes && edits.likes.length) {
                        operations = edits.likes.reduce(function (data, edit) {
                            var operation = b.star(edit.bookmark_id).then(function () {
                                return db.deletePendingBookmarkEdit(edit.id);
                            });

                            data.push(operation);
                            return data;
                        }, operations);
                    }

                    if (edits.unlikes && edits.unlikes.length) {
                        operations = edits.unlikes.reduce(function (data, edit) {
                            var operation = b.unstar(edit.bookmark_id).then(function () {
                                return db.deletePendingBookmarkEdit(edit.id);
                            });
                            
                            data.push(operation);

                            return data;
                        }, operations);
                    }

                    return WinJS.Promise.join(operations);
                }).then(function() {
                    return db.listCurrentBookmarks(db.commonFolderDbIds.liked);
                }).then(function (likes) {
                    localLikesBeforeSync = likes;
                    
                    // Don't sync the "have" information here
                    // since this will screw with lots of other
                    // state that we're syncing through other means
                    return b.list({
                        folder_id: InstapaperDB.CommonFolderIds.Liked,
                    });
                }).then(function (remoteData) {
                    var operations = localLikesBeforeSync.reduce(function (data, lb) {
                        var isStillLiked = remoteData.bookmarks.some(function (rb) {
                            return rb.bookmark_id === lb.bookmark_id;
                        });

                        if (!isStillLiked) {
                            data.push(db.unlikeBookmark(lb.bookmark_id, true));
                        }

                        return data;
                    }, []);

                    operations = remoteData.bookmarks.reduce(function (data, bookmark) {
                        data.push(db.likeBookmark(bookmark.bookmark_id, true));
                        return data;
                    }, operations);

                    return WinJS.Promise.join(operations);
                });
            },
            sync: function sync(options) {
                options = options || { folders: true, bookmarks: true };
                var syncFolders = options.folders;
                var syncBookmarks = options.bookmarks;

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

                    return this._syncBookmarks(db);
                }.bind(this)).then(function () {
                    return WinJS.Promise.timeout();
                }.bind(this));
            },
        }),
    });
})();