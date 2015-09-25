﻿(function () {
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

    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive, InstapaperDB.CommonFolderIds.Orphaned];

    function destroyRemoteAccountData(clientInformation) {
        /// <summary>
        /// Adds "cost" -- there is a limit of 120 per day -- so rather than
        /// Always nuking them remotely and re-adding them, lets try and keep
        /// what we have remotely and work with those. This involves blowing away
        /// all the folders, an moving the ones left in archive to unread. Also
        /// we need to make sure that we clean up the liked items so everything is
        /// clean & happy.
        /// Finally, we also need to reset the progress.
        /// </summary>
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        // Remove all the folders. If there are any bookmarks in these folders
        // when this happens, the back end will move them to "Archive".
        return folders.list().then(function (serverFolders) {
            return WinJS.Promise.join({
                bookmarks: Codevoid.Utilities.serialize(serverFolders, function (folder) {
                    // We can't delete the default folders, so skip them
                    if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                        return;
                    }

                    return bookmarks.list({ folder_id: folder.folder_id });
                }),
                folders: serverFolders,
            });
        }).then(function (data) {
            var allBookmarks = [];
            data.bookmarks.forEach(function (folderOfBookmarks) {
                allBookmarks = allBookmarks.concat(folderOfBookmarks.bookmarks);
            });

            return Codevoid.Utilities.serialize(allBookmarks, function (bookmark) {
                return bookmarks.unarchive(bookmark.bookmark_id);
            }).then(function () {
                return data.folders;
            });
        }).then(function (serverFolders) {
            return Codevoid.Utilities.serialize(serverFolders, function (folder) {
                if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                    return;
                }

                return folders.deleteFolder(folder.folder_id);
            });
        }).then(function () {
            // Find all the now-in-archive folders, and...
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (archivedBookmarks) {
            // ... unarchive them. This will put them in "unread"
            return Codevoid.Utilities.serialize(archivedBookmarks.bookmarks, function (bookmark) {
                return bookmarks.unarchive(bookmark.bookmark_id);
            });
        }).then(function () {
            // Find anything that has a "like" on it...
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (likes) {
            return Codevoid.Utilities.serialize(likes.bookmarks, function (liked) {
                return bookmarks.unstar(liked.bookmark_id);
            });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread });
        }).then(function (remoteBookmarks) {
            return Codevoid.Utilities.serialize(remoteBookmarks.bookmarks, function (rb) {
                return bookmarks.updateReadProgress({
                    bookmark_id: rb.bookmark_id,
                    progress: 0.0,
                    progress_timestamp: Date.now(),
                });
            });
        }).then(function () {
            ok(true, "It went very very wrong");
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
        destroyRemoteData: destroyRemoteAccountData,
        defaultFolderIds: defaultFolderIds,
        cleanupExperienceHost: function () {
            Codevoid.UICore.Experiences.initializeHost(null);
        },
        getPlayground: function getPlayground() {
            var playground = document.getElementById("qunit-fixture");

            return playground.appendChild(document.createElement("div"));
        },
    });
})();