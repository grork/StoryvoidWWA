(function () {
    "use strict";
    
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
    var pendingDbs = [];
    
    function cleanUpOpenDbs() {
        pendingDbs.forEach(function (idb) {
            idb.dispose();
        });

        pendingDbs = [];
    }

    function getNewInstapaperDBAndInit() {
        return new InstapaperDB().initialize().then(function (idb) {
            pendingDbs.push(idb);

            return idb;
        });
    }

    function startOnSuccessOfPromise() {
        cleanUpOpenDbs();
        start();
    }

    function startOnFailureOfPromise(error) {
        debugger;
        ok(false, "Failed: " + error.toString() + "\n" + error.stack);
        cleanUpOpenDbs();
        start();
    }

    function promiseTest(name, func) {
        asyncTest(name, function () {
            WinJS.Promise.as(func()).done(startOnSuccessOfPromise, startOnFailureOfPromise);
        });
    }

    function expectNoPendingFolderEdits(idb) {
        return idb.getPendingFolderEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    function expectNoPendingBookmarkEdits(idb) {
        return idb.getPendingBookmarkEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    function deleteDb() {
        pendingDbs.forEach(function (idb) {
            idb.dispose();
        });

        pendingDbs = [];

        return WinJS.Promise.timeout().then(function () {
            return db.deleteDb(InstapaperDB.DBName);
        }).then(function () {
            ok(true);
        });
    }

    WinJS.Namespace.define("InstapaperTestUtilities", {
        getNewInstapaperDBAndInit: getNewInstapaperDBAndInit,
        startOnSuccessOfPromise: startOnSuccessOfPromise,
        startOnFailureOfPromise: startOnFailureOfPromise,
        promiseTest: promiseTest,
        expectNoPendingFolderEdits: expectNoPendingFolderEdits,
        expectNoPendingBookmarkEdits: expectNoPendingBookmarkEdits,
        deleteDb: deleteDb,
    });
})();