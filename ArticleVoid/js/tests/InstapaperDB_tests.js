(function () {
    "use strict";

    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive];

    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    var expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var deleteDb = InstapaperTestUtilities.deleteDb;

    module("InstapaperDBFolders");

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
            return idb.addFolder({ title: folderName }, true);
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

    function canGetFolderFromFolderId() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderFromFolderId("xxx");
        }).then(function (folder) {
            strictEqual(folder.id, addedFolderDbId, "incorrect folder DB ID");
        });
    }

    function cantGetFolderDbIdFromInvalidFolderId() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderFromFolderId("yyy");
        }).then(function (folder) {
            strictEqual(folder, undefined, "should get 'undefined' for folder db id if it's not in the DB");
        });
    }

    function addExistingFolderNameFailsAndLeavesNoPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder({ title: folderName }, true);
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
            return idb.addFolder({ title: folderName });
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
            return instapaperDB.addFolder({ title: "shouldntBeSyncd" });
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
            return instapaperDB.addFolder({ title: folderTitle }, true);
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
                folder: instapaperDB.addFolder({ title: folderTitle }),
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
    promiseTest("canGetFolderFromFolderId", canGetFolderFromFolderId);
    promiseTest("cantGetFolderDbIdFromInvalidFolderId", cantGetFolderDbIdFromInvalidFolderId);
    promiseTest("addExistingFolderNameFailsAndLeavesNoPendingEdit", addExistingFolderNameFailsAndLeavesNoPendingEdit);
    promiseTest("canRemoveFolderNoPendingEdit", canRemoveFolderNoPendingEdit);
    promiseTest("canAddFolderWithPendingEdit", canAddFolderWithPendingEdit);
    promiseTest("canRemoveFolderWithPendingEdit", canRemoveFolderWithPendingEdit);
    promiseTest("deletingUnsyncedAddededFolderNoOps", deletingUnsyncedAddededFolderNoOps);
    promiseTest("addingDeletedFolderWithoutSyncBringsBackFolderId", addingDeletedFolderWithoutSyncBringsBackFolderId);

    module("InstapaperDBBookmarks");


    function emptyUnreadBookmarksTableReturnsEmptyData() {
        return getNewInstapaperDBAndInit().then(function (idb) {
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

    function updatingReadProgressLeavesNoPendingEdit() {
        var instapaperDB;
        var targetProgress = 0.452;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.getBookmarkByBookmarkId("local_id");
        }).then(function (bookmark) {
            notStrictEqual(bookmark.progress, targetProgress, "Bookmark already had the target progress");
            return WinJS.Promise.join({
                bookmark: instapaperDB.updateReadProgress(bookmark.bookmark_id, targetProgress),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (updatedBookmark) {
            strictEqual(updatedBookmark.bookmark.progress, targetProgress, "progress wasn't updated");
            return expectNoPendingBookmarkEdits(instapaperDB);
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
    promiseTest("updatingReadProgressLeavesNoPendingEdit", updatingReadProgressLeavesNoPendingEdit);

    // Remove the just futzed with bookmark
    promiseTest("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);

    // Re-add a bookmark to work with
    promiseTest("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

    function removingBookmarkLeavesPendingEdit() {
        var instapaperDB;
        var pendingEditId;
        var folder_dbid;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getBookmarkByBookmarkId("local_id");
        }).then(function (bookmark) {
            folder_dbid = bookmark.folder_dbid;
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
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");
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
        var folder_dbid;

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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.LIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked for the correct folder");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("likingBookmarkAddsPendingEdit", likingBookmarkAddsPendingEdit);

    promiseTest("likingBookmarkWithPendingLikeEditLeavesSinglePendingEdit", function () {
        var instapaperDB;
        var pendingEditId;
        var folder_dbid;

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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.LIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            return instapaperDB.likeBookmark("local_id");
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.LIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    function unlikingBookmarkLeavesPendingEdit() {
        var instapaperDB;
        var pendingEditId;
        var folder_dbid;

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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNLIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked with correct source folder");

            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("unlikingBookmarkLeavesPendingEdit", unlikingBookmarkLeavesPendingEdit);

    promiseTest("unlikingBookmarkWithPendingUnlikeEditLeavesSinglePendingEdit", function () {
        var instapaperDB;
        var pendingEditId;
        var folder_dbid;

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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNLIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNLIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            return WinJS.Promise.join([instapaperDB._deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    function unlikingBookmarkWithPendingLikeEditLeavesNoPendingEdit() {
        var instapaperDB;
        var folder_dbid;

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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.LIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "not marked with the correct source folder");

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

    promiseTest("unlikingBookmarkWithPendingLikeEditLeavesNoPendingEdit", unlikingBookmarkWithPendingLikeEditLeavesNoPendingEdit);

    function likingBookmarkWithPendingUnlikeEditLeavesNoPendingEdit() {
        var instapaperDB;
        var folder_dbid;

        return getNewInstapaperDBAndInit().then(function (idb) {
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
            folder_dbid = newBookmark.folder_dbid;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (currentPendingEdits) {
            ok(currentPendingEdits, "Didn't find any pending edits");
            ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            strictEqual(edit.type, InstapaperDB.PendingBookmarkEditTypes.UNLIKE, "Expected Delete type");
            strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");
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

    promiseTest("likingBookmarkWithPendingUnlikeEditLeavesNoPendingEdit", likingBookmarkWithPendingUnlikeEditLeavesNoPendingEdit);

    // We're about to do the folder test, so we want to make sure we've got
    // a clean slate.
    promiseTest("deleteDb", deleteDb);


    var sampleFolders;
    var sampleBookmarks;

    function setSampleData() {
        sampleFolders = [{
            title: "Folder1",
            folder_id: "Folder1",
        }, {
            title: "Folder2",
            folder_id: "Folder2",
        }];

        sampleBookmarks = [{
            title: "Unread1",
            url: "http://unread1.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "1"
        }, {
            title: "Unread2",
            url: "http://unread2.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "2"
        }, {
            title: "Unread3",
            url: "http://unread3.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "3"
        }, {
            title: "Archived1",
            url: "http://archive1.com",
            folder_id: InstapaperDB.CommonFolderIds.Archive,
            bookmark_id: "4"
        }, {
            title: "Archived2",
            url: "http://archive2.com",
            folder_id: InstapaperDB.CommonFolderIds.Archive,
            bookmark_id: "5"
        }, {
            title: "InFolder1-1",
            url: "http://infolder1-1.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: "6"
        }, {
            title: "InFolder1-2",
            url: "http://infolder1-2.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: "7"
        }, {
            title: "InFolder2-1",
            url: "http://InFolder2-1.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: "8"
        }, {
            title: "InFolder2-2",
            url: "http://InFolder2-2.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: "9"
        }, {
            title: "Unread4",
            url: "http://unread4.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "10"
        }];
    }

    function addSampleData() {
        setSampleData();
        var instapaperDB;
        var expectedFolderIds = defaultFolderIds.concat([]);

        notStrictEqual(sampleFolders.length, 0, "Need more than 0 sample folders to create");

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            var addedFolders = [];
            sampleFolders.forEach(function (folder) {
                addedFolders.push(idb.addFolder({ title: folder.title }, true).then(function (addedFolder) {
                    addedFolder.folder_id = folder.folder_id;
                    folder.id = addedFolder.id;
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

            currentFolders.forEach(function (folder) {
                sampleBookmarks.forEach(function (bookmark) {
                    if (bookmark.folder_id === folder.folder_id) {
                        bookmark.folder_dbid = folder.id;
                    }
                });
            });

            return WinJS.Promise.timeout();
        }).then(function () {
            var addedBookmarks = [];
            sampleBookmarks.forEach(function (bookmark) {
                addedBookmarks.push(instapaperDB.addBookmark(bookmark));
            });

            addedBookmarks.push(WinJS.Promise.timeout());

            return WinJS.Promise.join(addedBookmarks).then(function () {
                return instapaperDB.listCurrentBookmarks();
            });
        }).then(function (currentBookmarks) {
            ok(currentBookmarks, "didn't find any bookmarks");
            strictEqual(currentBookmarks.length, sampleBookmarks.length, "Didn't find expected bookmarks");
        });
    }

    promiseTest("addSampleData", addSampleData);

    /// <summary>
    /// this expects the "this" pointer to be bound to the
    /// instapaper db wrapper
    /// </summary>
    function moveAndValidate(bookmark, destinationFolder, fromServer) {
        return this.getBookmarkByBookmarkId(bookmark.bookmark_id).then(function (originalBookmark) {
            ok(originalBookmark, "Didn't find original bookmark");
            notStrictEqual(originalBookmark.folder_dbid, destinationFolder.id, "Bookmark is already in destination folder");
            return this.moveBookmark(bookmark.bookmark_id, destinationFolder.id, fromServer);
        }.bind(this)).then(function (movedBookmark) {
            ok(movedBookmark, "no moved bookmark");
            strictEqual(movedBookmark.folder_dbid, destinationFolder.id, "Not in destination folder");
            strictEqual(movedBookmark.folder_id, destinationFolder.folder_id, "Not in destination folder");

            bookmark.folder_id = destinationFolder.folder_id;
            bookmark.folder_dbid = destinationFolder.id;
        });
    }

    function validatePendingEdits(edits, bookmark_id, folder, sourcefolder_dbid) {
        ok(edits, "Expected pending edits");
        strictEqual(edits.length, 1, "Expected single pending edit");

        var pendingEdit = edits[0];
        strictEqual(pendingEdit.type, InstapaperDB.PendingBookmarkEditTypes.MOVE, "Not a move edit");
        strictEqual(pendingEdit.bookmark_id, bookmark_id, "not correct bookmark");
        strictEqual(pendingEdit.destinationfolder_dbid, folder.id, "Incorrect folder DB id");
        strictEqual(pendingEdit.sourcefolder_dbid, sourcefolder_dbid, "Not marked with the correct ID");
    }

    function cleanupPendingEdits() {
        return this.getPendingBookmarkEdits().then(function (edits) {
            var deletes = [];
            edits.forEach(function (edit) {
                deletes.push(this._deletePendingBookmarkEdit(edit.id));
            }.bind(this));

            return WinJS.Promise.join(deletes);
        }.bind(this));
    }

    function movingToLikedErrors() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getFolderFromFolderId(InstapaperDB.CommonFolderIds.Liked);
        }).then(function (likeFolder) {
            return instapaperDB.moveBookmark(sampleBookmarks[0].bookmark_id, likeFolder.id);
        }).then(function () {
            ok(false, "shouldn't be able to successfully move to liked folder");
        }, function (error) {
            strictEqual(error.code, InstapaperDB.ErrorCodes.INVALID_DESTINATION_FOLDER, "incorrect error code");
        });
    }

    promiseTest("movingToLikedErrors", movingToLikedErrors);

    function movingBookmarkLeavesNoPendingEdit() {
        var instapaperDB;
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return moveAndValidate.bind(idb)(sampleBookmarks[0], sampleFolders[0], true);
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    promiseTest("movingBookmarkLeavesNoPendingEdit", movingBookmarkLeavesNoPendingEdit);

    function movingBookmarkLeavesPendingEdit() {
        var targetBookmark = sampleBookmarks[1];
        var sourcefolder_dbid = targetBookmark.folder_dbid;
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return moveAndValidate.bind(idb)(targetBookmark, sampleFolders[1]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);
            return instapaperDB._deletePendingBookmarkEdit(pendingEdits[0].id);
        });
    }

    promiseTest("movingBookmarkLeavesPendingEdit", movingBookmarkLeavesPendingEdit);

    function multipleMovesLeavesOnlyOnePendingEdit() {
        var targetBookmark = sampleBookmarks[2];
        var sourcefolder_dbid = targetBookmark.folder_dbid;
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return moveAndValidate.bind(idb)(targetBookmark, sampleFolders[1]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);
        }).then(function () {
            return moveAndValidate.bind(instapaperDB)(targetBookmark, sampleFolders[0]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[0], sampleFolders[1].id);
            return cleanupPendingEdits.bind(instapaperDB)();
        });
    }

    promiseTest("multipleMovesLeavesOnlyOnePendingEdit", multipleMovesLeavesOnlyOnePendingEdit);

    function likingThenMovingLeavesCorrectPendingEdits() {
        var instapaperDB;
        var sourcefolder_dbid;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.likeBookmark(sampleBookmarks[1].bookmark_id);
        }).then(function (likedBookmark) {
            sourcefolder_dbid = likedBookmark.folder_dbid;
            return moveAndValidate.bind(instapaperDB)(sampleBookmarks[1], sampleFolders[0]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            ok(pendingEdits, "No pending edits");
            strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            var moveEdit, likeEdit;

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.PendingBookmarkEditTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case InstapaperDB.PendingBookmarkEditTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            strictEqual(moveEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong bookmark id");
            strictEqual(moveEdit.destinationfolder_dbid, sampleFolders[0].id, "Wrong Folder");
            strictEqual(moveEdit.sourcefolder_dbid, sourcefolder_dbid, "Incorrect source folder");

            strictEqual(likeEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong like bookmark");
        }).then(function () {
            return cleanupPendingEdits.bind(instapaperDB)();
        });
    }

    function likingThenMovingThenDeletingLeavesCorrectPendingEdits() {
        var instapaperDB;
        var destinationFolder = sampleFolders[1];
        var targetBookmark = sampleBookmarks[2];
        var originalSourceFolderId = targetBookmark.folder_dbid;
        var finalSourceFolderId = destinationFolder.id;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.likeBookmark(targetBookmark.bookmark_id);
        }).then(function (likedBookmark) {
            return moveAndValidate.bind(instapaperDB)(targetBookmark, destinationFolder);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            ok(pendingEdits, "No pending edits");
            strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            var moveEdit, likeEdit;

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.PendingBookmarkEditTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case InstapaperDB.PendingBookmarkEditTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            strictEqual(moveEdit.bookmark_id, targetBookmark.bookmark_id, "Move had wrong bookmark id");
            strictEqual(moveEdit.destinationfolder_dbid, destinationFolder.id, "Move was to the wrong Folder");
            strictEqual(moveEdit.sourcefolder_dbid, originalSourceFolderId, "Not marked with the correct folder");

            strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "Like had wrong like bookmark");

            return WinJS.Promise.join([instapaperDB.removeBookmark(targetBookmark.bookmark_id), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            var likeEdit;
            var deleteEdit;

            ok(pendingEdits, "Didn't get any pending edits");
            strictEqual(pendingEdits.length, 2, "Expected only two pending edits;");

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.PendingBookmarkEditTypes.LIKE:
                        likeEdit = edit;
                        break;

                    case InstapaperDB.PendingBookmarkEditTypes.DELETE:
                        deleteEdit = edit;
                        break;

                    default:
                        ok(false, "Unexpected edit");
                }
            });

            ok(likeEdit && deleteEdit, "Didn't get correct edits");

            strictEqual(deleteEdit.bookmark_id, targetBookmark.bookmark_id, "Delete had wrong bookmark ID");
            strictEqual(deleteEdit.sourcefolder_dbid, finalSourceFolderId, "Not marked with the source folder");

            strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "like had wrong bookmark ID");
            strictEqual(likeEdit.sourcefolder_dbid, originalSourceFolderId, "not marked with the source folder");
        }).then(function () {
            return cleanupPendingEdits.bind(instapaperDB)();
        });
    }

    promiseTest("likingThenMovingLeavesCorrectPendingEdits", likingThenMovingLeavesCorrectPendingEdits);
    promiseTest("likingThenMovingThenDeletingLeavesCorrectPendingEdits", likingThenMovingThenDeletingLeavesCorrectPendingEdits);

    promiseTest("updateSampleBookmarks", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            var gets = [];

            sampleBookmarks.reduce(function (bucket, bookmark, index) {
                bucket.push(idb.getBookmarkByBookmarkId(bookmark.bookmark_id).then(function (dbBookmark) {
                    sampleBookmarks[index] = dbBookmark;
                }));

                return bucket;
            }, gets);

            strictEqual(gets.length, sampleBookmarks.length);
            return WinJS.Promise.join(gets);
        });
    });

    promiseTest("deleteDb", deleteDb);
    promiseTest("addSampleData", addSampleData);

    function queryingForUnreadFolderReturnsOnlyUnreadItems() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(InstapaperDB.CommonFolderIds.Unread);
        }).then(function (unreadBookmarks) {
            ok(unreadBookmarks, "Didn't get list of unread bookmarks");

            strictEqual(unreadBookmarks.length, 4, "Incorrect number of bookmarks");

            unreadBookmarks = unreadBookmarks.sort(function (a, b) {
                var aId = parseInt(a.bookmark_id);
                var bId = parseInt(b.bookmark_id);

                if (aId === bId) {
                    return 0;
                } else if (aId < bId) {
                    return -1;
                } else {
                    return 1;
                }
            });

            strictEqual(unreadBookmarks[0].bookmark_id, sampleBookmarks[0].bookmark_id, "Bookmark 1 not found");
            strictEqual(unreadBookmarks[0].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 1 not found in unread folder");

            strictEqual(unreadBookmarks[1].bookmark_id, sampleBookmarks[1].bookmark_id, "Bookmark 2 not found");
            strictEqual(unreadBookmarks[1].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 2 not found in unread folder");

            strictEqual(unreadBookmarks[2].bookmark_id, sampleBookmarks[2].bookmark_id, "Bookmark 3 not found");
            strictEqual(unreadBookmarks[2].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 3 not found in unread folder");

            strictEqual(unreadBookmarks[3].bookmark_id, sampleBookmarks[9].bookmark_id, "Bookmark 4 not found");
            strictEqual(unreadBookmarks[3].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 4 not found in unread folder");
        });
    }

    function queryingForFolderContentsReturnsOnlyFolderItems() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(sampleFolders[0].folder_id);
        }).then(function (folderBookmarks) {
            ok(folderBookmarks, "Didn't get list of folder bookmarks");

            strictEqual(folderBookmarks.length, 2, "Incorrect number of bookmarks");

            folderBookmarks = folderBookmarks.sort(function (a, b) {
                var aId = parseInt(a.bookmark_id);
                var bId = parseInt(b.bookmark_id);

                if (aId === bId) {
                    return 0;
                } else if (aId < bId) {
                    return -1;
                } else {
                    return 1;
                }
            });

            strictEqual(folderBookmarks[0].bookmark_id, sampleBookmarks[5].bookmark_id, "Bookmark 1 not found");
            strictEqual(folderBookmarks[0].folder_id, sampleFolders[0].folder_id, "Bookmark 1 not found in unread folder");

            strictEqual(folderBookmarks[1].bookmark_id, sampleBookmarks[6].bookmark_id, "Bookmark 2 not found");
            strictEqual(folderBookmarks[1].folder_id, sampleFolders[0].folder_id, "Bookmark 2 not found in unread folder");
        });
    }

    promiseTest("queryingForUnreadFolderReturnsOnlyUnreadItems", queryingForUnreadFolderReturnsOnlyUnreadItems);
    promiseTest("queryingForFolderContentsReturnsOnlyFolderItems", queryingForFolderContentsReturnsOnlyFolderItems);

    function queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders() {
        var instapaperDB;
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join([
                idb.likeBookmark(sampleBookmarks[5].bookmark_id, true),
                idb.likeBookmark(sampleBookmarks[7].bookmark_id, true),
                WinJS.Promise.timeout()
            ]);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks(InstapaperDB.CommonFolderIds.Liked);
        }).then(function (likedBookmarks) {
            var folderHash = {};

            ok(likedBookmarks, "No book marks returned");
            strictEqual(likedBookmarks.length, 2, "Incorrect number of bookmarks returned");

            likedBookmarks.reduce(function (hash, bookmark) {
                hash[bookmark.folder_id] = 1;
                strictEqual(bookmark.starred, 1, "Bookmark wasn't liked");

                return hash;
            }, folderHash);

            var folders = Object.keys(folderHash);
            strictEqual(folders.length, 2, "Expected different fodlers for each bookmark");
        });
    }

    promiseTest("queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders", queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders);
    promiseTest("deleteDb", deleteDb);
})();

/*

What to do about moving to a folder that isn't currently sync'd?
Allow them to do that? If you let them "move" the bookmark to another folder, you have to either only deal with 
db ID's on the items, and fix the properties up later when the changes come down.

Thats gonna be kinda confusing actually. Although we can get bookmarks by ID, so maybe not so much.

Ah ha.

How about:
* store the DB id of the folder in the pending Edit
* Sync all the folder changes first (this is the key)
* Then, when you go to sync the bookmark changes, you can get the real folder id then
* When you pull DOWN the changes, you'll just do it by folder, and use the change not ifications in "have"
 to push the changes into the actual items, and some how update the itmes 


*/