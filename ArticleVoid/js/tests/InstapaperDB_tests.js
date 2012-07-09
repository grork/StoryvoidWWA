(function () {
    "use strict";
    function startOnSuccessOfPromise() {
        start();
    }

    function startOnFailureOfPromise(error) {
        debugger;
        start();
    }

    function promiseTest(name, func) {
        asyncTest(name, function () {
            WinJS.Promise.as(func()).done(startOnSuccessOfPromise, startOnFailureOfPromise);
        });
    }

    var InstapaperDB = Codevoid.ArticleVoid.DB.InstapaperDB;
    
    module("InstapaperDB");

    function deleteDb() {
        return db.deleteDb(InstapaperDB.DBName).then(function () {
            ok(true);
        });
    }

    function hasDefaultFolders() {
        var expectedFolderIds = ["unread", "starred", "archive"];

        var idb = new InstapaperDB();
        return idb.initialize().then(function (openedDb) {
            idb.dispose();
        }).then(function () {
            return db.open({
                server: InstapaperDB.DBName,
                version: InstapaperDB.DBVersion,
            });
        }).then(function (rawServer) {
            return rawServer.query(InstapaperDB.DBFoldersTable).execute();
        }).then(function (queryResult) {
            ok(queryResult, "Didn't get any results");
            strictEqual(queryResult.length, 3, "Didn't get the folders expected");

            notStrictEqual(expectedFolderIds.indexOf(queryResult[0].folder_id), -1, "Didn't find folder: " + queryResult[0].folder_id);
            notStrictEqual(expectedFolderIds.indexOf(queryResult[1].folder_id), -1, "Didn't find folder: " + queryResult[1].folder_id);
            notStrictEqual(expectedFolderIds.indexOf(queryResult[2].folder_id), -1, "Didn't find folder: " + queryResult[2].folder_id);
        });
    }

    promiseTest("deleteDb", deleteDb);
    promiseTest("defaultDBHasDefaultFolders", hasDefaultFolders);
})();