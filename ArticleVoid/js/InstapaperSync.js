(function () {
    "use strict";

    var InstapaperApi = Codevoid.ArticleVoid.InstapaperApi;
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;

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

                return db.initialize().then(function() {
                    return f.list();
                }).then(function (remoteFolders) {
                    var syncs = [];
                    remoteFolders.forEach(function (rf) {
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

                    return WinJS.Promise.join(syncs);
                });
            },
        }),
    });
})();