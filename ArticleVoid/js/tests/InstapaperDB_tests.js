(function () {
    "use strict";
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive];

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
        ok(false, "Failed: " + error.toString());
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

    var pendingDbs = [];

    module("InstapaperDBFolders");

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

    function hasDefaultFolders() {
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

            notStrictEqual(defaultFolderIds.indexOf(queryResult[0].folder_id), -1, "Didn't find folder: " + queryResult[0].folder_id);
            notStrictEqual(defaultFolderIds.indexOf(queryResult[1].folder_id), -1, "Didn't find folder: " + queryResult[1].folder_id);
            notStrictEqual(defaultFolderIds.indexOf(queryResult[2].folder_id), -1, "Didn't find folder: " + queryResult[2].folder_id);
        });
    }

    function canEnumerateDefaultFolders() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.listCurrentFolders();
        }).then(function (folders) {
            ok(folders, "Didn't get any folders");
            strictEqual(folders.length, 3, "Got unexpected number of folders");

            notStrictEqual(defaultFolderIds.indexOf(folders[0].folder_id), -1, "Didn't find folder: " + folders[0].folder_id);
            notStrictEqual(defaultFolderIds.indexOf(folders[1].folder_id), -1, "Didn't find folder: " + folders[1].folder_id);
            notStrictEqual(defaultFolderIds.indexOf(folders[2].folder_id), -1, "Didn't find folder: " + folders[2].folder_id);
        });
    }

    var addedFolderDbId;

    function canAddFolderNoPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(folderName, true);
        }).then(function (createdFolder) {
            addedFolderDbId = createdFolder.id;
            return WinJS.Promise.timeout();
        }).then(function () {
            return instapaperDB.listCurrentFolders();
        }).then(function (folders) {
            var folderFound;
            ok(folders, "no folders returned");
            folders.forEach(function (folder) {
                if (folder.title === folderName) {
                    folderFound = true;
                }
            });

            ok(folderFound, "Didn't find the folder we just made");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function canGetAddedFolderByDbId() {
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderByDbId(addedFolderDbId);
        }).then(function (retrievedFolder) {
            ok(retrievedFolder, "No folder found");
            strictEqual(retrievedFolder.title, folderName);
            strictEqual(retrievedFolder.id, addedFolderDbId);
        });
    }

    function canUpdateFolder() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getFolderByDbId(addedFolderDbId);
        }).then(function (retrievedFolder) {
            ok(retrievedFolder, "No folder found");
            strictEqual(retrievedFolder.title, folderName);
            strictEqual(retrievedFolder.id, addedFolderDbId);

            retrievedFolder.folder_id = "xxx";

            return instapaperDB.updateFolder(retrievedFolder);
        }).then(function () {
            return instapaperDB.getFolderByDbId(addedFolderDbId);
        }).then(function (updatedFolderInformation) {
            ok(updatedFolderInformation, "No updated folder information");
            strictEqual(updatedFolderInformation.folder_id, "xxx", "Folder ID didn't match");
        });
    }

    function addExistingFolderNameFailsAndLeavesNoPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(folderName, true);
        }).then(function () {
            ok(false, "Should have failed");
        }, function (error) {
            strictEqual(error.code, Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE, "Wrong error code");
            ok(true, "Should fail here");
        }).then(function (folders) {
            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function canRemoveFolderNoPendingEdit() {
        var instapaperDB;
        var folderId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            ok(folders, "didn't find any folders in db");
            folders.forEach(function (folder) {
                if (defaultFolderIds.indexOf(folder.folder_id) === -1) {
                    folderId = folder.id;
                }
            });

            return instapaperDB.removeFolder(folderId, true);
        }).then(function () {
            return instapaperDB.listCurrentFolders();
        }).then(function (folders) {
            var folderFound;
            folders.forEach(function (folder) {
                if (folder.id === folderId) {
                    folderFound = true;
                }
            });

            ok(!folderFound, "Found folder, expected it to be gone");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function canAddFolderWithPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder";
        var addFolderResult;
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(folderName);
        }).then(function (createdFolder) {
            addFolderResult = createdFolder;
        }).then(function () {
            return instapaperDB.listCurrentFolders();
        }).then(function (folders) {
            var folderFound;
            ok(folders, "no folders returned");
            folders.forEach(function (folder) {
                if (folder.title === folderName) {
                    folderFound = folder;
                }
            });

            ok(folderFound, "Didn't find the folder we just made");
            strictEqual(folderFound.title, folderName, "Folder name didn't match");
            strictEqual(folderFound.id, addFolderResult.id, "Folder ID didn't match");
            ok(!folderFound.folder_id, "Shouldn't have had folder. Nothing sync'd");

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            ok(pendingEdits, "Expected some pending edits");
            strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            var pendingEdit = pendingEdits[0];
            strictEqual(pendingEdit.type, Codevoid.ArticleVoid.InstapaperDB.PendingFolderEditTypes.ADD, "Expected to be ADD edit type");
            strictEqual(pendingEdit.folderTableId, addFolderResult.id, "Pending edit wasn't for the folder we added");

            return instapaperDB._deletePendingFolderEdit(pendingEdit.id);
        });
    }

    function canRemoveFolderWithPendingEdit() {
        var instapaperDB;
        var folderToRemove;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            ok(folders, "didn't find any folders in db");
            folders.forEach(function (folder) {
                if (defaultFolderIds.indexOf(folder.folder_id) === -1) {
                    folderToRemove = folder;
                }
            });

            return instapaperDB.removeFolder(folderToRemove.id);
        }).then(function () {
            return instapaperDB.listCurrentFolders();
        }).then(function (folders) {
            var folderFound;
            folders.forEach(function (folder) {
                if (folder.id === folderToRemove.id) {
                    folderFound = true;
                }
            });

            ok(!folderFound, "Found folder, expected it to be gone");

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            ok(pendingEdits, "Expected some pending edits");
            strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            var pendingEdit = pendingEdits[0];
            strictEqual(pendingEdit.type, Codevoid.ArticleVoid.InstapaperDB.PendingFolderEditTypes.DELETE, "Expected to be DELETE edit type");
            strictEqual(pendingEdit.removedFolderId, folderToRemove.folder_id, "Pending edit wasn't for the folder we added");
            strictEqual(pendingEdit.title, folderToRemove.title, "Didn't didn't match");

            return instapaperDB._deletePendingFolderEdit(pendingEdit.id);
        });
    }

    function deletingUnsyncedAddededFolderNoOps() {
        var instapaperDB = new InstapaperDB();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return instapaperDB.addFolder("shouldntBeSyncd");
        }).then(function (addedFolder) {
            return WinJS.Promise.join({
                timeout: WinJS.Promise.timeout(),
                folder: WinJS.Promise.as(addedFolder),
            });
        }).then(function (data) {
            return WinJS.Promise.join([instapaperDB.removeFolder(data.folder.id), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function addingDeletedFolderWithoutSyncBringsBackFolderId() {
        var instapaperDB = new InstapaperDB();
        var folderTitle = "shouldntBeSyncd";
        var addedFolder;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return instapaperDB.addFolder(folderTitle, true);
        }).then(function (folder) {
            addedFolder = folder;
            return WinJS.Promise.timeout();
        }).then(function () {
            // Need to give the folder a fake ID to make sure we can resurect it
            // We don't want to sync things in these simple tests
            addedFolder.folder_id = Date.now();
            return WinJS.Promise.join([instapaperDB.updateFolder(addedFolder), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingFolderEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.removeFolder(addedFolder.id), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getFolderByDbId(addedFolder.id);
        }).then(function (data) {
            ok(!data, "Didn't expect any data");

            return WinJS.Promise.join({
                folder: instapaperDB.addFolder(folderTitle),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (data) {
            strictEqual(data.folder.folder_id, addedFolder.folder_id, "Added Folder ID wasn't the same");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    promiseTest("deleteDb", deleteDb);
    promiseTest("hasDefaultFolders", hasDefaultFolders);
    promiseTest("canEnumerateDefaultFolders", canEnumerateDefaultFolders);
    promiseTest("canAddFolderNoPendingEdit", canAddFolderNoPendingEdit);
    promiseTest("canGetAddedFolderByDbId", canGetAddedFolderByDbId);
    promiseTest("canUpdateFolder", canUpdateFolder);
    promiseTest("addExistingFolderNameFailsAndLeavesNoPendingEdit", addExistingFolderNameFailsAndLeavesNoPendingEdit);
    promiseTest("canRemoveFolderNoPendingEdit", canRemoveFolderNoPendingEdit);
    promiseTest("canAddFolderWithPendingEdit", canAddFolderWithPendingEdit);
    promiseTest("canRemoveFolderWithPendingEdit", canRemoveFolderWithPendingEdit);
    promiseTest("deletingUnsyncedAddededFolderNoOps", deletingUnsyncedAddededFolderNoOps);
    promiseTest("addingDeletedFolderWithoutSyncBringsBackFolderId", addingDeletedFolderWithoutSyncBringsBackFolderId);

    module("InstapaperDBBookmarks");


    function emptyUnreadBookmarksTableReturnsEmptyData() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            pendingDbs.push(idb);
            return idb.listCurrentBookmarks(InstapaperDB.CommonFolderIds.Unread);
        }).then(function (results) {
            ok(results, "expected result array"),
            strictEqual(results.length, 0, "Didn't expect to get any results");
        });
    }

    function canAddBookmarkNoPendingEdit() {
        var instapaperDB;
        var bookmark = {
            title: "LocalBookmark",
            bookmark_id: "local_id",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addBookmark(bookmark);
        }).then(function (addedBookmark) {
            ok(addedBookmark, "Didn't get bookmark back");
            strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");
            return WinJS.Promise.timeout();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            ok(currentBookmarks, "no folders returned");
            strictEqual(currentBookmarks.length, 1, "Only expected 1 bookmark");

            strictEqual(currentBookmarks[0].bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
            strictEqual(currentBookmarks[0].folder_id, bookmark.folder_id, "Folder ID didn't match");
            strictEqual(currentBookmarks[0].title, bookmark.title, "Folder ID didn't match");
        });
    }

    function canUpdateBookmarkInformationNoPendingEdits() {
        var instapaperDB;
        var bookmark_id = "local_id";

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getBookmarkByBookmarkId(bookmark_id);
        }).then(function (bookmark) {
            notStrictEqual(bookmark.url, "http://www.bing.com", "URL shouldn't have been that which we're about to set it to");
            bookmark.url = "http://www.bing.com";
            return WinJS.Promise.join([instapaperDB.updateBookmark(bookmark), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(bookmark_id);
        }).then(function (updatedBookmark) {
            ok(updatedBookmark, "no bookmark returned");
            strictEqual(updatedBookmark.url, "http://www.bing.com", "Incorrect Url");
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    function addingNewUrlDoesntShowUpInBookmarks() {
        var instapaperDB;
        var pendingId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join([idb.addUrl({
                url: "http://www.microsoft.com",
                title: "Microsoft",
            }), WinJS.Promise.timeout()]);
        }).then(function (result) {
            pendingId = result[0].id;
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            ok(pendingEdits, "Expected some pending edits");
            ok(pendingEdits.length, 1, "Expected only 1 pending edit");

            var pendingEdit = pendingEdits[0];
            strictEqual(pendingEdit.url, "http://www.microsoft.com", "Incorrect pended URL");
            strictEqual(pendingEdit.title, "Microsoft", "incorrect pended title");
            strictEqual(pendingEdit.type, Codevoid.ArticleVoid.InstapaperDB.PendingBookmarkEditTypes.ADD, "Wrong pended edit type");

            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            ok(currentBookmarks, "Expected bookmarks result set");
            strictEqual(currentBookmarks.length, 0, "Expected no bookmarks");

            return WinJS.Promise.timeout();
        }).then(function () {
            return instapaperDB._deletePendingBookmarkEdit(pendingId);
        });
    }

    function canLikeBookmarkNoPendingEdit() {
        var instapaperDB;
        var bookmark = {
            title: "LocalBookmark",
            bookmark_id: "local_id",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            starred: 0,
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addBookmark(bookmark, true);
        }).then(function (addedBookmark) {
            ok(addedBookmark, "Didn't get bookmark back");
            strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");
            return WinJS.Promise.timeout();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.likeBookmark(bookmark.bookmark_id, true), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            ok(bookmark, "no bookmark returned");

            strictEqual(newBookmark.bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
            strictEqual(newBookmark.folder_id, bookmark.folder_id, "Folder ID didn't match");
            strictEqual(newBookmark.title, bookmark.title, "Folder ID didn't match");
            strictEqual(newBookmark.starred, 1, "Didn't get starred");
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    function likeingNonExistantBookmarkErrors() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.likeBookmark(Date.now());
        }).then(function () {
            ok(false, "shouldn't have succeeded");
        }, function (error) {
            ok(error, "didn't get error object");
            strictEqual(error.code, Codevoid.ArticleVoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND, "Incorrect Error code");
        });
    }

    function canUnlikeBookmarkNoPendingEdit() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getBookmarkByBookmarkId("local_id");
        }).then(function (bookmark) {
            ok(bookmark, "Didn't get bookmark");
            ok(bookmark.starred, 1, "Bookmark needs to be liked to unlike it");

            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id", true), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id")
        }).then(function (unlikedBookmark) {
            ok(unlikedBookmark, "no bookmark found");

            strictEqual(unlikedBookmark.starred, 0, "Bookmark was still liked");
        });
    }

    function canRemoveBookmarkNoPendingEdit() {
        var instapaperDB;
        var bookmark_id = "local_id";

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.removeBookmark(bookmark_id, true);
        }).then(function (addedBookmark) {
            return WinJS.Promise.timeout();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            ok(currentBookmarks, "no bookmarks returned");
            strictEqual(currentBookmarks.length, 0, "Didn't expect bookmarks");
        });
    }

    promiseTest("emptyUnreadBookmarksTableReturnsEmptyData", emptyUnreadBookmarksTableReturnsEmptyData);
    promiseTest("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);
    promiseTest("canUpdateBookmarkInformationNoPendingEdits", canUpdateBookmarkInformationNoPendingEdits);
    promiseTest("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);
    promiseTest("addingNewUrlDoesntShowUpInBookmarks", addingNewUrlDoesntShowUpInBookmarks);
    promiseTest("canLikeBookmarkNoPendingEdit", canLikeBookmarkNoPendingEdit);
    promiseTest("likeingNonExistantBookmarkErrors", likeingNonExistantBookmarkErrors);
    promiseTest("canUnlikeBookmarkNoPendingEdit", canUnlikeBookmarkNoPendingEdit);

    // Remove the just futzed with bookmark
    promiseTest("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);

    // Re-add a bookmark to work with
    promiseTest("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

    function removingBookmarkLeavesPendingEdit() {
        var instapaperDB;
        var pendingEditId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join([instapaperDB.removeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            ok(currentBookmarks, "Didn't get any pending bookmarks");

            strictEqual(currentBookmarks.length, 0, "Only expected to find one DB");
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.DELETE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("removingBookmarkLeavesPendingEdit", removingBookmarkLeavesPendingEdit);
    promiseTest("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

    function likingBookmarkAddsPendingEdit() {
        var instapaperDB;
        var pendingEditId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.likeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            ok(newBookmark, "no bookmark returned");

            strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            strictEqual(newBookmark.starred, 1, "Didn't get starred");

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.STAR, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("likingBookmarkAddsPendingEdit", likingBookmarkAddsPendingEdit);

    function unlikingBookmarkLeavesPendingEdit() {
        var instapaperDB;
        var pendingEditId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join([instapaperDB.likeBookmark("local_id", true), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            ok(newBookmark, "no bookmark returned");

            strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            strictEqual(newBookmark.starred, 0, "Didn't get unstarred");

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNSTAR, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("unlikingBookmarkLeavesPendingEdit", unlikingBookmarkLeavesPendingEdit);

    function unlikingBookmarkWithPendingEditLeavesNoPendingEdit() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.likeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            ok(newBookmark, "no bookmark returned");

            strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            strictEqual(newBookmark.starred, 1, "Didn't get starred");

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.STAR, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
        }).then(function () {
            return instapaperDB.unlikeBookmark("local_id");
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (unlikedBookmark) {
            ok(unlikedBookmark, "Expected a bookmark");
            strictEqual(unlikedBookmark.bookmark_id, "local_id");
            strictEqual(unlikedBookmark.starred, 0, "Shouldn't have been liked");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("unlikingBookmarkWithPendingEditLeavesNoPendingEdit", unlikingBookmarkWithPendingEditLeavesNoPendingEdit);

    function likingBookmarkWithPendingEditLeavesNoPendingEdit() {
        var instapaperDB;

        return new InstapaperDB().initialize().then(function (idb) {
            pendingDbs.push(idb);
            instapaperDB = idb;

            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            ok(newBookmark, "no bookmark returned");

            strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            strictEqual(newBookmark.starred, 0, "Didn't get unstarred");

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNSTAR, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
        }).then(function () {
            return instapaperDB.likeBookmark("local_id");
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (unlikedBookmark) {
            ok(unlikedBookmark, "Expected a bookmark");
            strictEqual(unlikedBookmark.bookmark_id, "local_id");
            strictEqual(unlikedBookmark.starred, 1, "Shouldn't have been unliked");

            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            instapaperDB.dispose();
        });
    }

    promiseTest("likingBookmarkWithPendingEditLeavesNoPendingEdit", likingBookmarkWithPendingEditLeavesNoPendingEdit);

    // We're about to do the folder test, so we want to make sure we've got
    // a clean slate.
    promiseTest("deleteDb", deleteDb);

    var sampleFolders = [{
        title: "Folder1",
        folder_id: "Folder1",
    }, {
        title: "Folder2",
        folder_id: "Folder2",
    }];


    function addSampleFolders() {
        var instapaperDB;
        var expectedFolderIds = defaultFolderIds.concat([]);

        notStrictEqual(sampleFolders.length, 0, "Need more than 0 sample folders to create");

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            var addedFolders = [];
            sampleFolders.forEach(function (folder) {
                addedFolders.push(idb.addFolder(folder.title, true).then(function (addedFolder) {
                    addedFolder.folder_id = folder.folder_id;
                    expectedFolderIds.push(folder.folder_id);
                    return idb.updateFolder(addedFolder);
                }));
            });

            return WinJS.Promise.join(addedFolders);
        }).then(function () {
            return instapaperDB.listCurrentFolders();
        }).then(function (currentFolders) {
            ok(currentFolders, "Didn't get any added Folders");
            strictEqual(currentFolders.length, defaultFolderIds.length + sampleFolders.length, "Unexpected number of folders");


            var notFoundFolders = currentFolders.filter(function (folder) {
                expectedFolderIds.indexOf(folder.folder_id) === -1;
            });

            strictEqual(notFoundFolders.length, 0, "Didn't expect to find unmatched folders");
        });
    }

    promiseTest("addSampleFolders", addSampleFolders);
})();