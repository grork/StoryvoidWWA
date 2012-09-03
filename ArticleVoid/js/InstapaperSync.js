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
            sync: function sync() {
                var db = new InstapaperDB();
                var f = this._folders;
                var remoteFoldersPromise = f.list();

                return db.initialize().then(function () {
                    return WinJS.Promise.join({
                        remoteFolders: remoteFoldersPromise,
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