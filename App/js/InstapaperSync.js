(function () {
    "use strict";

    var InstapaperApi = Codevoid.Storyvoid.InstapaperApi;
    var InstapaperDB = Codevoid.Storyvoid.InstapaperDB;

    function isDefaultFolder(id) {
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

    function handleRemote1241Error(err) {
        if (err.error === 1241) {
            return;
        }

        return WinJS.Promise.wrapError(err);
    }

    WinJS.Namespace.define("Codevoid.Storyvoid", {
        InstapaperSync: WinJS.Class.mix(WinJS.Class.define(function (clientInformation) {
            this._clientInformation = clientInformation;
            this.perFolderBookmarkLimits = {
                "unread": 250,
            };
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
            _raiseStatusChanged: function(payload) {
                this.dispatchEvent("syncstatusupdate", payload);
            },
            /// <summary>
            /// Used for pushing up a folder add that is local.
            /// This is needed because of the possibility that
            /// the folder we just added might be there already
            /// and we want to normalize what the fuck is going
            /// on so that downstream handlers can have a
            /// consistent view of the world.
            ///
            /// Has mirror method for removing a folder.
            /// </summary>
            _addFolderPendingEdit: function _addFolderPendingEdit(edit, db) {
                return WinJS.Promise.join({
                    local: db.getFolderByDbId(edit.folder_dbid),
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
                    if (error && (error.error === 1242 || error.error === 1250)) {
                        return;
                    }

                    return WinJS.Promise.wrapError(error);
                });
            },
            _syncFolders: function _syncFolders(db, cancellationSource) {
                this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.foldersStart });

                return db.getPendingFolderEdits().then(function processPendingEdits(pendingEdits) {
                    return Codevoid.Utilities.serialize(pendingEdits, function (edit) {
                        var syncPromise;
                        switch (edit.type) {
                            case InstapaperDB.FolderChangeTypes.ADD:
                                syncPromise = this._addFolderPendingEdit(edit, db);
                                break;

                            case InstapaperDB.FolderChangeTypes.DELETE:
                                syncPromise = this._removeFolderPendingEdit(edit, db);
                                break;

                            default:
                                appfail("Shouldn't see other edit types");
                                break;
                        }

                        if (syncPromise) {
                            return syncPromise.then(function () {
                                return db.deletePendingFolderEdit(edit.id);
                            });
                        }
                    }.bind(this), 0, cancellationSource);
                }.bind(this)).then(function () {
                    return WinJS.Promise.join({
                        remoteFolders: this._folders.list(),
                        localFolders: db.listCurrentFolders(),
                    });
                }.bind(this)).then(function (data) {
                    if (cancellationSource.cancelled) {
                        return WinJS.Promise.wrapError(new Error("Folder Sync Cancelled after remote listing"));
                    }

                    // Find all the changes from the remote server
                    // that aren't locally for folders on the server
                    var syncs = data.remoteFolders.reduce(function (data, rf) {
                        var synced = db.getFolderFromFolderId(rf.folder_id).then(function (lf) {
                            var done = WinJS.Promise.as();

                            // Notify that the remote folder w/ name had some changes
                            this._raiseStatusChanged({
                                operation: Codevoid.Storyvoid.InstapaperSync.Operation.folder,
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
                        }.bind(this));

                        data.push(synced);
                        return data;
                    }.bind(this), []);

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
                }.bind(this)).then(function () {
                    // Make sure there aren't any pending local edits, given we should have
                    // sync'd everything.

                    return db.getPendingFolderEdits().then(function (edits) {
                        this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.foldersEnd });
                        // No edits? NO worries!
                        if (!edits || (edits.length < 1)) {
                            return;
                        }

                        debugger;
                        return WinJS.Promise.wrapError(new Error("There are pending folder edits. Didn't expect any pending folder edits"));
                    }.bind(this));
                }.bind(this));
            },
            _syncBookmarks: function _syncBookmarks(db, options) {
                var promise = WinJS.Promise.as();
                this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksStart });

                if (!options.singleFolder) {
                    promise = this._syncBookmarkPendingAdds(db).then(function () {
                        return db.listCurrentFolders();
                    }).then(function (allFolders) {
                        var priorityFolder;
                        var priorityFolderIndex = -1;

                        // When we're not syncing a single folder, but we're
                        // still supplied with a folder, we're going to prioritize
                        // that folder to be the first. The shuffle below basically
                        // "sorts" the folder by placing the specific folder first.
                        if (options.folder) {
                            priorityFolder = allFolders.filter(function (f, index) {
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
                    promise = db.getFolderByDbId(options.folder).then(function (folder) {
                        if (folder.folder_id) {
                            return [folder];
                        }

                        return db.getPendingFolderEdits().then(function (edits) {
                            var edit = edits.filter(function (e) {
                                return e.folder_dbid === folder.id;
                            })[0];

                            if (!edit) {
                                appfail("Even though the folder had no folder ID, it had no pending edit either...");
                                return WinJS.Promise.wrapError(new Error("No pending edit for a folder with no folder ID"));
                            }

                            // Before we do any other work, we need to make sure
                            // the the pending folder add was pushed up to the service.
                            return this._addFolderPendingEdit(edit, db).then(function () {
                                return db.getFolderByDbId(folder.id);
                            }).then(function (syncedFolder) {
                                return [syncedFolder];
                            });
                        }.bind(this));
                    }.bind(this));
                }

                return promise.then(function (folders) {
                    if (options.cancellationSource.cancelled) {
                        return WinJS.Promise.wrapError(new Error("Syncing Bookmarks Cancelled: After folders sync"));
                    }

                    // If we've just sync'd the remote folders, theres no point
                    // in us getting the remote list *AGAIN*, so just let it filter
                    // based on the local folders
                    var remoteFolders = options.didSyncFolders ? WinJS.Promise.as(folders) : this._folders.list();
                    return WinJS.Promise.join({
                        currentFolders: folders,
                        remoteFolders: remoteFolders.then(function (folders) {
                            // Map the remote folders to easy look up if it's present or not
                            return folders.map(function (folder) {
                                return folder.folder_id;
                            });
                        }),
                    });
                }.bind(this)).then(function (data) {
                    if (options.cancellationSource.cancelled) {
                        return WinJS.Promise.wrapError(new Error("Syncing Bookmarks Cancelled: After relisting remote folders"));
                    }

                    var currentFolders = data.currentFolders.filter(function (folder) {
                        switch (folder.folder_id) {
                            case InstapaperDB.CommonFolderIds.Liked:
                            case InstapaperDB.CommonFolderIds.Orphaned:
                                return false;

                            default:
                                return true;
                        }
                    });

                    return Codevoid.Utilities.serialize(currentFolders, function (folder) {
                        if (!isDefaultFolder(folder.folder_id)
                            && (data.remoteFolders.indexOf(folder.folder_id) === -1)) {
                            // If it's not a default folder, and the folder we're trying to sync
                            // isn't available remotely (E.g it's been deleted, or it's not there yet)
                            // we're going to give up for this specific folder
                            return;
                        }

                        this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.bookmarkFolder, title: folder.title });

                        // No need to pass the cancellation source here because we're in
                        // a serialized call so will be broken after each foler.
                        return this._syncBookmarksForFolder(db, folder.id).then(function () {
                            if (options._testPerFolderCallback) {
                                options._testPerFolderCallback(folder.id);
                            }
                            return WinJS.Promise.timeout();
                        });
                    }.bind(this), 0, options.cancellationSource);
                }.bind(this)).then(function () {
                    return this._syncLikes(db);
                }.bind(this)).then(function () {
                    if (options.skipOrphanCleanup || options.singleFolder) {
                        return;
                    }

                    return db.listCurrentBookmarks(db.commonFolderDbIds.orphaned).then(function (orphans) {
                        return Codevoid.Utilities.serialize(orphans, function (orphan) {
                            return db.removeBookmark(orphan.bookmark_id, true);
                        });
                    });
                }).then(function () {
                    // Check that there are no orphaned pending edits for bookmarks
                    return db.getPendingBookmarkEdits((options.singleFolder ? options.folder : null));
                }).then(function (edits) {
                    var mergedEdits = [];

                    Object.keys(edits).forEach(function (p) {
                        // No edits to merge
                        if (!Array.isArray(edits[p])) {
                            return;
                        }

                        mergedEdits.concat(edits[p]);
                    });

                    this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksEnd });

                    if (!mergedEdits.length) {
                        return;
                    }

                    debugger;
                    return WinJS.Promise.wrapError(new Error("There pending bookmark edits still found. Incomplete sync"));
                }.bind(this));
            },
            _syncBookmarkPendingAdds: function _syncBookmarkPendingAdds(db) {
                var b = this._bookmarks;

                return db.getPendingBookmarkAdds().then(function (pendingAdds) {
                    return Codevoid.Utilities.serialize(pendingAdds, function (add) {
                        return b.add({
                            url: add.url,
                            title: add.title,
                        }).then(function () {
                            return db.deletePendingBookmarkEdit(add.id);
                        });
                    });
                });
            },
            _syncBookmarksForFolder: function _syncBookmarksForFolder(db, dbIdOfFolderToSync) {
                var b = this._bookmarks;
                var folderId;
                var pendingEdits;

                // First get the pending edits to work on
                return db.getPendingBookmarkEdits(dbIdOfFolderToSync).then(function (edits) {
                    pendingEdits = edits;

                    // Moves
                    if (pendingEdits.moves) {
                        return Codevoid.Utilities.serialize(pendingEdits.moves, function (move) {
                            var operation;

                            switch (move.destinationfolder_dbid) {
                                case db.commonFolderDbIds.archive:
                                    operation = b.archive(move.bookmark_id).then(null, handleRemote1241Error);
                                    break;

                                case db.commonFolderDbIds.unread:
                                    operation = db.getBookmarkByBookmarkId(move.bookmark_id).then(function (bookmark) {
                                        return b.add({ url: bookmark.url });
                                    });
                                    break;

                                default:
                                    operation = db.getFolderByDbId(move.destinationfolder_dbid).then(function (folder) {
                                        if (!folder) {
                                            return;
                                        }

                                        return b.move({ bookmark_id: move.bookmark_id, destination: folder.folder_id }).then(null, function (err) {
                                            if (err.error === 1242 || err.error === 1500) {
                                                return;
                                            }

                                            return handleRemote1241Error(err);
                                        });
                                    });
                                    break;
                            }

                            return operation.then(function () {
                                return db.deletePendingBookmarkEdit(move.id);
                            });
                        });
                    }
                }).then(function () {
                    // *Remote* Deletes
                    if (pendingEdits.deletes) {
                        return Codevoid.Utilities.serialize(pendingEdits.deletes, function (del) {
                            return b.deleteBookmark(del.bookmark_id).then(null, handleRemote1241Error).then(function () {
                                return db.deletePendingBookmarkEdit(del.id);
                            });
                        });
                    }
                }).then(function () {
                    // Wait for the operations to complete, and return the local data
                    // so we can look for oprphaned bookmarks
                    return WinJS.Promise.join({
                        folder: db.getFolderByDbId(dbIdOfFolderToSync),
                        localBookmarks: db.listCurrentBookmarks(dbIdOfFolderToSync),
                    });
                }).then(function (data) {
                    // Build the list of local "haves" for the folder we're
                    // syncing, so that the server can update it's read progress
                    // and tell us of any bookmarks that might have been removed
                    // on the server, or also added.
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
                        limit: this.perFolderBookmarkLimits[folderId] ||  this.defaultBookmarkLimit,
                    });
                }.bind(this)).then(function (result) {
                    // Now we've told the server what our local state is, and it's telling
                    // us whats *different* from that state.
                    var rb = result.bookmarks;
                    var rd = result.meta;
                    var operations = [];

                    // Process any existing bookmarks. Note that this can included bookmarks
                    // in this folder we aren't currently aware of (e.g. added), and ones we
                    // think are in another folder. This also includes updating read progress
                    // and other details.
                    if (rb && rb.length) {
                        operations = rb.reduce(function (data, bookmark) {
                            var work = db.getBookmarkByBookmarkId(bookmark.bookmark_id).then(function (currentBookmark) {
                                if (!currentBookmark) {
                                    bookmark.folder_dbid = dbIdOfFolderToSync;
                                    bookmark.folder_id = folderId;
                                    return;
                                }

                                if (currentBookmark.folder_dbid !== dbIdOfFolderToSync) {
                                    return db.moveBookmark(bookmark.bookmark_id, dbIdOfFolderToSync, true);
                                }

                                return currentBookmark;
                            }).then(function (current) {
                                // Since the server gave us the data in a non-typed format, lets
                                // fuck with it and get into something that looks typed.
                                bookmark.starred = parseInt(bookmark.starred, 10);
                                bookmark.progress = parseFloat(bookmark.progress);

                                if (!current) {
                                    return db.addBookmark(bookmark);
                                }

                                // The key here is to layer the updated values from the server
                                // on to the bookmark that we're about to put in the database.
                                // This is significant because otherwise, the put call will
                                // *REPLACE* the data for that key losing the folder information etc.
                                Object.keys(bookmark).forEach(function (p) {
                                    current[p] = bookmark[p];
                                });

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
                        operations = rd.delete_ids.split(",").reduce(function (data, bookmark) {
                            var bookmark_id = parseInt(bookmark);
                            data.push(db.moveBookmark(bookmark_id, db.commonFolderDbIds.orphaned, true));
                            return data;
                        }, operations);
                    }

                    return WinJS.Promise.join(operations);
                });
            },
            _syncLikes: function _syncLikes(db) {
                var b = this._bookmarks;
                var edits;

                // Get the pending edits
                return db.getPendingBookmarkEdits().then(function (pendingEdits) {
                    edits = pendingEdits;

                    // We're only looking at likes & unlikes here
                    if (edits.likes && edits.likes.length) {
                        // Push the like edits remotely
                        return Codevoid.Utilities.serialize(edits.likes, function (edit) {
                            return b.star(edit.bookmark_id).then(null, handleRemote1241Error).then(function () {
                                return db.deletePendingBookmarkEdit(edit.id);
                            });
                        });
                    }
                }).then(function () {
                    if (edits.unlikes && edits.unlikes.length) {
                        // push the unlike edits
                        return Codevoid.Utilities.serialize(edits.unlikes, function (edit) {
                            return b.unstar(edit.bookmark_id).then(null, handleRemote1241Error).then(function () {
                                return db.deletePendingBookmarkEdit(edit.id);
                            });
                        });
                    }
                }).then(function () {
                    return db.listCurrentBookmarks(db.commonFolderDbIds.liked);
                }).then(function (localLikes) {
                    var haves = localLikes.reduce(function (data, bookmark) {
                        data.push({
                            id: bookmark.bookmark_id,
                            hash: bookmark.hash,
                        });

                        return data;
                    }, []);

                    var folderId = InstapaperDB.CommonFolderIds.Liked;
                    return b.list({
                        folder_id: folderId,
                        have: haves,
                        limit: this.perFolderBookmarkLimits[folderId] || this.defaultBookmarkLimit,
                    });
                }.bind(this)).then(function (remoteData) {
                    var rb = remoteData.bookmarks;
                    var rd = remoteData.meta;
                    // Since we're not going to leave a pending edit, we can just like & unlike the
                    // remaining bookmarks irrespective of their existing state.
                    var operations = rb.reduce(function (data, rb) {
                        data.push(db.likeBookmark(rb.bookmark_id, true, true));
                        return data;
                    }, []);

                    if (rd.delete_ids) {
                        operations = rd.delete_ids.split(",").reduce(function (data, bookmark) {
                            var bookmark_id = parseInt(bookmark);
                            data.push(db.unlikeBookmark(bookmark_id, true));
                            return data;
                        }, operations);
                    }
                    return WinJS.Promise.join(operations);
                });
            },
            defaultBookmarkLimit: 10,
            perFolderBookmarkLimits: null,
            sync: function sync(options) {
                options = options || { folders: true, bookmarks: true };
                var syncFolders = options.folders;
                var syncBookmarks = options.bookmarks;
                var cancellationSource = options.cancellationSource || new Codevoid.Utilities.CancellationSource();

                var db = options.dbInstance || new InstapaperDB();
                var initialize = options.dbInstance ? WinJS.Promise.as(db) : db.initialize();

                this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.start });
                return initialize.then(function startSync() {
                    if (!syncFolders || cancellationSource.cancelled) {
                        return;
                    }

                    return this._syncFolders(db, cancellationSource);
                }.bind(this)).then(function () {
                    if (!syncBookmarks || cancellationSource.cancelled) {
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
                }.bind(this)).then(function () {
                    this._raiseStatusChanged({ operation: Codevoid.Storyvoid.InstapaperSync.Operation.end });
                    return WinJS.Promise.timeout();
                }.bind(this));
            },
        }, {
            Operation: {
                start: "start",
                end: "end",
                foldersStart: "foldersStart",
                foldersEnd: "foldersEnd",
                bookmarksStart: "bookmarksStart",
                bookmarksEnd: "bookmarksEnd",
                bookmarkFolder: "bookmarkFolder",
                folder: "folder",
                bookmark: "bookmark",
            }
        }), WinJS.Utilities.eventMixin),
    });
})();