(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.ArticleVoid.DB", {
        InstapaperDB: WinJS.Class.define(function InstapaperDB_Constructor() {
        }, {
            _server: null,
            initialize: function initialize() {
                var schema = {};
                schema[Codevoid.ArticleVoid.DB.InstapaperDB.DBBoomarksTable] = { key: { keyPath: "bookmark_id" } };
                schema[Codevoid.ArticleVoid.DB.InstapaperDB.DBFoldersTable] = { key: { keyPath: "folder_id" } };

                return db.open({
                    server: Codevoid.ArticleVoid.DB.InstapaperDB.DBName,
                    version: Codevoid.ArticleVoid.DB.InstapaperDB.DBVersion,
                    schema: schema,
                }, Codevoid.ArticleVoid.DB.InstapaperDB.createDefaultData).then(function (server) {
                    this._server = server;
                }.bind(this)).then(function () {
                    return this._server;
                }.bind(this));
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
                    { folder_id: "starred", title: "starred" },
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
            }
        }),
    });
})();