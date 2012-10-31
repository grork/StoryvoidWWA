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

    function promiseTest(name, func, delay) {
        asyncTest(name, function () {
            var promise = WinJS.Promise.as(func());

            if(delay) {
                promise = promise.then(function() {
                    return WinJS.Promise.timeout(delay);
                });
            }

            promise.done(startOnSuccessOfPromise, startOnFailureOfPromise);
        });
    }

    function expectNoPendingFolderEdits(idb) {
        return idb.getPendingFolderEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    function expectNoPendingBookmarkEdits(idb) {
        return colludePendingBookmarkEdits(idb.getPendingBookmarkEdits()).then(function (pendingEdits) {
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
    
    function colludePendingBookmarkEdits(pendingEditPromise) {
        return pendingEditPromise.then(function (edits) {
            if (Array.isArray(edits)) {
                return edits;
            }

            var colluded = [];
            if (edits.adds && edits.adds.length) {
                colluded = colluded.concat(edits.adds);
            }

            if (edits.deletes && edits.deletes.length) {
                colluded = colluded.concat(edits.deletes);
            }

            if (edits.moves && edits.moves.length) {
                colluded = colluded.concat(edits.moves);
            }

            if (edits.likes && edits.likes.length) {
                colluded = colluded.concat(edits.likes);
            }

            if (edits.unlikes && edits.unlikes.length) {
                colluded = colluded.concat(edits.unlikes);
            }

            colluded.sort(function (a, b) {
                if (a.id === b.id) {
                    return 0;
                } else if (a.id < b.id) {
                    return -1;
                } else {
                    return 1;
                }
            });

            return colluded;
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
        colludePendingBookmarkEdits: colludePendingBookmarkEdits,
    });
})();