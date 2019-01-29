(function () {
    "use strict";

    var InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive, InstapaperDB.CommonFolderIds.Orphaned];
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    var expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var deleteDb = InstapaperTestUtilities.deleteDb;
    var colludePendingBookmarkEdits = InstapaperTestUtilities.colludePendingBookmarkEdits;

    QUnit.module("InstapaperDBFolders");

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
            QUnit.assert.ok(queryResult, "Didn't get any results");
            QUnit.assert.strictEqual(queryResult.length, 4, "Didn't get the folders expected");

            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[0].folder_id), -1, "Didn't find folder: " + queryResult[0].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[1].folder_id), -1, "Didn't find folder: " + queryResult[1].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[2].folder_id), -1, "Didn't find folder: " + queryResult[2].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[3].folder_id), -1, "Didn't find folder: " + queryResult[3].folder_id);
        });
    }

    function canEnumerateDefaultFolders() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.listCurrentFolders();
        }).then(function (folders) {
            QUnit.assert.ok(folders, "Didn't get any folders");
            QUnit.assert.strictEqual(folders.length, 4, "Got unexpected number of folders");

            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(folders[0].folder_id), -1, "Didn't find folder: " + folders[0].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(folders[1].folder_id), -1, "Didn't find folder: " + folders[1].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(folders[2].folder_id), -1, "Didn't find folder: " + folders[2].folder_id);
            QUnit.assert.notStrictEqual(defaultFolderIds.indexOf(folders[3].folder_id), -1, "Didn't find folder: " + folders[3].folder_id);
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
            QUnit.assert.ok(folders, "no folders returned");
            folders.forEach(function (folder) {
                if (folder.title === folderName) {
                    folderFound = true;
                }
            });

            QUnit.assert.ok(folderFound, "Didn't find the folder we just made");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function canGetAddedFolderByDbId() {
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderByDbId(addedFolderDbId);
        }).then(function (retrievedFolder) {
            QUnit.assert.ok(retrievedFolder, "No folder found");
            QUnit.assert.strictEqual(retrievedFolder.title, folderName);
            QUnit.assert.strictEqual(retrievedFolder.id, addedFolderDbId);
        });
    }

    function canUpdateFolder() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getFolderByDbId(addedFolderDbId);
        }).then(function (retrievedFolder) {
            QUnit.assert.ok(retrievedFolder, "No folder found");
            QUnit.assert.strictEqual(retrievedFolder.title, folderName);
            QUnit.assert.strictEqual(retrievedFolder.id, addedFolderDbId);

            retrievedFolder.folder_id = "xxx";

            return instapaperDB.updateFolder(retrievedFolder);
        }).then(function () {
            return instapaperDB.getFolderByDbId(addedFolderDbId);
        }).then(function (updatedFolderInformation) {
            QUnit.assert.ok(updatedFolderInformation, "No updated folder information");
            QUnit.assert.strictEqual(updatedFolderInformation.folder_id, "xxx", "Folder ID didn't match");
        });
    }

    function canGetFolderFromFolderId() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderFromFolderId("xxx");
        }).then(function (folder) {
            QUnit.assert.strictEqual(folder.id, addedFolderDbId, "incorrect folder DB ID");
        });
    }

    function cantGetFolderDbIdFromInvalidFolderId() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getFolderFromFolderId("yyy");
        }).then(function (folder) {
            QUnit.assert.strictEqual(folder, undefined, "should get 'undefined' for folder db id if it's not in the DB");
        });
    }

    function addExistingFolderNameFailsAndLeavesNoPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder"
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder({ title: folderName }, true);
        }).then(function () {
            QUnit.assert.ok(false, "Should have failed");
        }, function (error) {
            QUnit.assert.strictEqual(error.code, Codevoid.Storyvoid.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE, "Wrong error code");
            QUnit.assert.ok(true, "Should fail here");
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
            QUnit.assert.ok(folders, "didn't find any folders in db");
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

            QUnit.assert.ok(!folderFound, "Found folder, expected it to be gone");

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
            QUnit.assert.ok(folders, "no folders returned");
            folders.forEach(function (folder) {
                if (folder.title === folderName) {
                    folderFound = folder;
                }
            });

            QUnit.assert.ok(folderFound, "Didn't find the folder we just made");
            QUnit.assert.strictEqual(folderFound.title, folderName, "Folder name didn't match");
            QUnit.assert.strictEqual(folderFound.id, addFolderResult.id, "Folder ID didn't match");
            QUnit.assert.ok(!folderFound.folder_id, "Shouldn't have had folder. Nothing sync'd");

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "Expected some pending edits");
            QUnit.assert.strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            var pendingEdit = pendingEdits[0];
            QUnit.assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDB.FolderChangeTypes.ADD, "Expected to be ADD edit type");
            QUnit.assert.strictEqual(pendingEdit.folder_dbid, addFolderResult.id, "Pending edit wasn't for the folder we added");

            return instapaperDB.deletePendingFolderEdit(pendingEdit.id);
        });
    }

    function canRemoveFolderWithPendingEdit() {
        var instapaperDB;
        var folderToRemove;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            QUnit.assert.ok(folders, "didn't find any folders in db");
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

            QUnit.assert.ok(!folderFound, "Found folder, expected it to be gone");

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "Expected some pending edits");
            QUnit.assert.strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            var pendingEdit = pendingEdits[0];
            QUnit.assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDB.FolderChangeTypes.DELETE, "Expected to be DELETE edit type");
            QUnit.assert.strictEqual(pendingEdit.removedFolderId, folderToRemove.folder_id, "Pending edit wasn't for the folder we added");
            QUnit.assert.strictEqual(pendingEdit.title, folderToRemove.title, "Didn't didn't match");

            return instapaperDB.deletePendingFolderEdit(pendingEdit.id);
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
            QUnit.assert.ok(!data, "Didn't expect any data");

            return WinJS.Promise.join({
                folder: instapaperDB.addFolder({ title: folderTitle }),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (data) {
            QUnit.assert.strictEqual(data.folder.folder_id, addedFolder.folder_id, "Added Folder ID wasn't the same");

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

    QUnit.module("InstapaperDBBookmarks");

    function emptyUnreadBookmarksTableReturnsEmptyData() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (results) {
            QUnit.assert.ok(results, "expected result array"),
            QUnit.assert.strictEqual(results.length, 0, "Didn't expect to get any results");
        });
    }

    function canAddBookmarkNoPendingEdit() {
        var instapaperDB;
        var bookmark = {
            title: "LocalBookmark",
            bookmark_id: "local_id",
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            bookmark.folder_dbid = idb.commonFolderDbIds.unread;
            return idb.addBookmark(bookmark);
        }).then(function (addedBookmark) {
            QUnit.assert.ok(addedBookmark, "Didn't get bookmark back");
            QUnit.assert.strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");
            return WinJS.Promise.timeout();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            QUnit.assert.ok(currentBookmarks, "no folders returned");
            QUnit.assert.strictEqual(currentBookmarks.length, 1, "Only expected 1 bookmark");

            QUnit.assert.strictEqual(currentBookmarks[0].bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
            QUnit.assert.strictEqual(currentBookmarks[0].folder_id, bookmark.folder_id, "Folder ID didn't match");
            QUnit.assert.strictEqual(currentBookmarks[0].title, bookmark.title, "Folder ID didn't match");
        });
    }

    function canUpdateBookmarkInformationNoPendingEdits() {
        var instapaperDB;
        var bookmark_id = "local_id";

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getBookmarkByBookmarkId(bookmark_id);
        }).then(function (bookmark) {
            QUnit.assert.notStrictEqual(bookmark.url, "http://www.bing.com", "URL shouldn't have been that which we're about to set it to");
            bookmark.url = "http://www.bing.com";
            return WinJS.Promise.join([instapaperDB.updateBookmark(bookmark), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(bookmark_id);
        }).then(function (updatedBookmark) {
            QUnit.assert.ok(updatedBookmark, "no bookmark returned");
            QUnit.assert.strictEqual(updatedBookmark.url, "http://www.bing.com", "Incorrect Url");
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
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "Expected some pending edits");
            QUnit.assert.ok(pendingEdits.length, 1, "Expected only 1 pending edit");

            var pendingEdit = pendingEdits[0];
            QUnit.assert.strictEqual(pendingEdit.url, "http://www.microsoft.com", "Incorrect pended URL");
            QUnit.assert.strictEqual(pendingEdit.title, "Microsoft", "incorrect pended title");
            QUnit.assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD, "Wrong pended edit type");

            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            QUnit.assert.ok(currentBookmarks, "Expected bookmarks result set");
            QUnit.assert.strictEqual(currentBookmarks.length, 0, "Expected no bookmarks");

            return WinJS.Promise.timeout();
        }).then(function () {
            return instapaperDB.deletePendingBookmarkEdit(pendingId);
        });
    }

    function canLikeBookmarkNoPendingEdit() {
        var instapaperDB;
        var bookmark = {
            title: "LocalBookmark",
            bookmark_id: "local_id",
            starred: 0,
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            bookmark.folder_dbid = idb.commonFolderDbIds.unread;
            return idb.addBookmark(bookmark, true);
        }).then(function (addedBookmark) {
            QUnit.assert.ok(addedBookmark, "Didn't get bookmark back");
            QUnit.assert.strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");
            return WinJS.Promise.timeout();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.likeBookmark(bookmark.bookmark_id, true), WinJS.Promise.timeout()]);
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (newBookmark) {
            QUnit.assert.ok(bookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.folder_id, bookmark.folder_id, "Folder ID didn't match");
            QUnit.assert.strictEqual(newBookmark.folder_dbid, instapaperDB.commonFolderDbIds.unread, "Folder DB ID's didn't match");
            QUnit.assert.strictEqual(newBookmark.title, bookmark.title, "Folder ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    }

    function likingNonExistantBookmarkWithIgnoreMissingFlagSetReturnsNull() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.likeBookmark(Date.now(), true, true);
        }).then(function (bookmark) {
            QUnit.assert.strictEqual(bookmark, null, "Shouldn't have gotten a bookmark");
        });
    }

    function likeingNonExistantBookmarkErrors() {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.likeBookmark(Date.now());
        }).then(function () {
            QUnit.assert.ok(false, "shouldn't have succeeded");
        }, function (error) {
            QUnit.assert.ok(error, "didn't get error object");
            QUnit.assert.strictEqual(error.code, Codevoid.Storyvoid.InstapaperDB.ErrorCodes.BOOKMARK_NOT_FOUND, "Incorrect Error code");
        });
    }

    function canUnlikeBookmarkNoPendingEdit() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getBookmarkByBookmarkId("local_id");
        }).then(function (bookmark) {
            QUnit.assert.ok(bookmark, "Didn't get bookmark");
            QUnit.assert.ok(bookmark.starred, 1, "Bookmark needs to be liked to unlike it");

            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id", true), WinJS.Promise.timeout()]);
        }).then(function (unlikedBookmark) {
            unlikedBookmark = unlikedBookmark[0];
            QUnit.assert.ok(unlikedBookmark, "no bookmark returned");
            QUnit.assert.strictEqual(unlikedBookmark.bookmark_id, "local_id", "Wrong bookmark ID");
            QUnit.assert.strictEqual(unlikedBookmark.starred, 0, "Bookmark shouldn't have been liked");

            return instapaperDB.getBookmarkByBookmarkId("local_id")
        }).then(function (unlikedBookmark) {
            QUnit.assert.ok(unlikedBookmark, "no bookmark found");

            QUnit.assert.strictEqual(unlikedBookmark.starred, 0, "Bookmark was still liked");
        });
    }

    function updatingReadProgressLeavesNoPendingEdit() {
        var instapaperDB;
        var targetProgress = 0.452;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.getBookmarkByBookmarkId("local_id");
        }).then(function (bookmark) {
            QUnit.assert.notStrictEqual(bookmark.progress, targetProgress, "Bookmark already had the target progress");
            return WinJS.Promise.join({
                bookmark: instapaperDB.updateReadProgress(bookmark.bookmark_id, targetProgress),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (updatedBookmark) {
            QUnit.assert.strictEqual(updatedBookmark.bookmark.progress, targetProgress, "progress wasn't updated");
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
            QUnit.assert.ok(currentBookmarks, "no bookmarks returned");
            QUnit.assert.strictEqual(currentBookmarks.length, 0, "Didn't expect bookmarks");
        });
    }

    promiseTest("emptyUnreadBookmarksTableReturnsEmptyData", emptyUnreadBookmarksTableReturnsEmptyData);
    promiseTest("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);
    promiseTest("canUpdateBookmarkInformationNoPendingEdits", canUpdateBookmarkInformationNoPendingEdits);
    promiseTest("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);
    promiseTest("addingNewUrlDoesntShowUpInBookmarks", addingNewUrlDoesntShowUpInBookmarks);
    promiseTest("likingNonExistantBookmarkWithIgnoreMissingFlagSetReturnsNull", likingNonExistantBookmarkWithIgnoreMissingFlagSetReturnsNull);
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
            QUnit.assert.ok(currentBookmarks, "Didn't get any pending bookmarks");

            QUnit.assert.strictEqual(currentBookmarks.length, 0, "Only expected to find one DB");
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.DELETE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            QUnit.assert.ok(newBookmark.folder_dbid, "Doesn't have a folder DB ID");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.LIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked for the correct folder");
        }).then(function () {
            return WinJS.Promise.join([instapaperDB.deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            QUnit.assert.ok(newBookmark.folder_dbid, "No folder db id");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.LIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            return instapaperDB.likeBookmark("local_id");
        }).then(function () {
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.LIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            return WinJS.Promise.join([instapaperDB.deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked with correct source folder");

            return WinJS.Promise.join([instapaperDB.deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            return WinJS.Promise.join([instapaperDB.unlikeBookmark("local_id"), WinJS.Promise.timeout()]);
        }).then(function () {
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];
            pendingEditId = edit.id;

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            return WinJS.Promise.join([instapaperDB.deletePendingBookmarkEdit(pendingEditId), WinJS.Promise.timeout()]);
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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.LIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "not marked with the correct source folder");

        }).then(function () {
            return instapaperDB.unlikeBookmark("local_id");
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (unlikedBookmark) {
            QUnit.assert.ok(unlikedBookmark, "Expected a bookmark");
            QUnit.assert.strictEqual(unlikedBookmark.bookmark_id, "local_id");
            QUnit.assert.strictEqual(unlikedBookmark.starred, 0, "Shouldn't have been liked");

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
            QUnit.assert.ok(newBookmark, "no bookmark returned");

            QUnit.assert.strictEqual(newBookmark.bookmark_id, "local_id", "Bookmark ID didn't match");
            QUnit.assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            folder_dbid = newBookmark.folder_dbid;

            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (currentPendingEdits) {
            QUnit.assert.ok(currentPendingEdits, "Didn't find any pending edits");
            QUnit.assert.ok(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            var edit = currentPendingEdits[0];

            QUnit.assert.strictEqual(edit.type, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Expected Delete type");
            QUnit.assert.strictEqual(edit.bookmark_id, "local_id", "Wrong bookmark");
            QUnit.assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");
        }).then(function () {
            return instapaperDB.likeBookmark("local_id");
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId("local_id");
        }).then(function (unlikedBookmark) {
            QUnit.assert.ok(unlikedBookmark, "Expected a bookmark");
            QUnit.assert.strictEqual(unlikedBookmark.bookmark_id, "local_id");
            QUnit.assert.strictEqual(unlikedBookmark.starred, 1, "Shouldn't have been unliked");

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

        sampleBookmarks = [{ // 0
            title: "Unread1",
            url: "http://unread1.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "1"
        }, { // 1
            title: "Unread2",
            url: "http://unread2.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "2"
        }, { // 2
            title: "Unread3",
            url: "http://unread3.com",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            bookmark_id: "3"
        }, { // 3
            title: "Archived1",
            url: "http://archive1.com",
            folder_id: InstapaperDB.CommonFolderIds.Archive,
            bookmark_id: "4"
        }, { // 4
            title: "Archived2",
            url: "http://archive2.com",
            folder_id: InstapaperDB.CommonFolderIds.Archive,
            bookmark_id: "5"
        }, { // 5
            title: "InFolder1-1",
            url: "http://infolder1-1.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: "6"
        }, { // 6
            title: "InFolder1-2",
            url: "http://infolder1-2.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: "7"
        }, { // 7
            title: "InFolder2-1",
            url: "http://InFolder2-1.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: "8"
        }, { // 8
            title: "InFolder2-2",
            url: "http://InFolder2-2.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: "9"
        }, { // 9
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

        QUnit.assert.notStrictEqual(sampleFolders.length, 0, "Need more than 0 sample folders to create");

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
            QUnit.assert.ok(currentFolders, "Didn't get any added Folders");
            QUnit.assert.strictEqual(currentFolders.length, defaultFolderIds.length + sampleFolders.length, "Unexpected number of folders");


            var notFoundFolders = currentFolders.filter(function (folder) {
                expectedFolderIds.indexOf(folder.folder_id) === -1;
            });

            QUnit.assert.strictEqual(notFoundFolders.length, 0, "Didn't expect to find unmatched folders");

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
            QUnit.assert.ok(currentBookmarks, "didn't find any bookmarks");
            QUnit.assert.strictEqual(currentBookmarks.length, sampleBookmarks.length, "Didn't find expected bookmarks");
        });
    }

    promiseTest("addSampleData", addSampleData);

    /// <summary>
    /// this expects the "this" pointer to be bound to the
    /// instapaper db wrapper
    /// </summary>
    function moveAndValidate(bookmark, destinationFolder, fromServer) {
        return this.getBookmarkByBookmarkId(bookmark.bookmark_id).then(function (originalBookmark) {
            QUnit.assert.ok(originalBookmark, "Didn't find original bookmark");
            QUnit.assert.notStrictEqual(originalBookmark.folder_dbid, destinationFolder.id, "Bookmark is already in destination folder");
            return this.moveBookmark(bookmark.bookmark_id, destinationFolder.id, fromServer);
        }.bind(this)).then(function (movedBookmark) {
            QUnit.assert.ok(movedBookmark, "no moved bookmark");
            QUnit.assert.strictEqual(movedBookmark.folder_dbid, destinationFolder.id, "Not in destination folder");
            QUnit.assert.strictEqual(movedBookmark.folder_id, destinationFolder.folder_id, "Not in destination folder");

            bookmark.folder_id = destinationFolder.folder_id;
            bookmark.folder_dbid = destinationFolder.id;
        });
    }

    function validatePendingEdits(edits, bookmark_id, folder, sourcefolder_dbid) {
        QUnit.assert.ok(edits, "Expected pending edits");
        QUnit.assert.strictEqual(edits.length, 1, "Expected single pending edit");

        var pendingEdit = edits[0];
        QUnit.assert.strictEqual(pendingEdit.type, InstapaperDB.BookmarkChangeTypes.MOVE, "Not a move edit");
        QUnit.assert.strictEqual(pendingEdit.bookmark_id, bookmark_id, "not correct bookmark");
        QUnit.assert.strictEqual(pendingEdit.destinationfolder_dbid, folder.id, "Incorrect folder DB id");
        QUnit.assert.strictEqual(pendingEdit.sourcefolder_dbid, sourcefolder_dbid, "Not marked with the correct ID");
    }

    function cleanupPendingEdits() {
        return colludePendingBookmarkEdits(this.getPendingBookmarkEdits()).then(function (edits) {
            var deletes = [];
            edits.forEach(function (edit) {
                deletes.push(this.deletePendingBookmarkEdit(edit.id));
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
            QUnit.assert.ok(false, "shouldn't be able to successfully move to liked folder");
        }, function (error) {
            QUnit.assert.strictEqual(error.code, InstapaperDB.ErrorCodes.INVALID_DESTINATION_FOLDER, "incorrect error code");
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
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);
            return instapaperDB.deletePendingBookmarkEdit(pendingEdits[0].id);
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
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);
        }).then(function () {
            return moveAndValidate.bind(instapaperDB)(targetBookmark, sampleFolders[0]);
        }).then(function () {
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
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
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "No pending edits");
            QUnit.assert.strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            var moveEdit, likeEdit;

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.BookmarkChangeTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case InstapaperDB.BookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        QUnit.assert.ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            QUnit.assert.ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            QUnit.assert.strictEqual(moveEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong bookmark id");
            QUnit.assert.strictEqual(moveEdit.destinationfolder_dbid, sampleFolders[0].id, "Wrong Folder");
            QUnit.assert.strictEqual(moveEdit.sourcefolder_dbid, sourcefolder_dbid, "Incorrect source folder");

            QUnit.assert.strictEqual(likeEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong like bookmark");
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
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "No pending edits");
            QUnit.assert.strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            var moveEdit, likeEdit;

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.BookmarkChangeTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case InstapaperDB.BookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        QUnit.assert.ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            QUnit.assert.ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            QUnit.assert.strictEqual(moveEdit.bookmark_id, targetBookmark.bookmark_id, "Move had wrong bookmark id");
            QUnit.assert.strictEqual(moveEdit.destinationfolder_dbid, destinationFolder.id, "Move was to the wrong Folder");
            QUnit.assert.strictEqual(moveEdit.sourcefolder_dbid, originalSourceFolderId, "Not marked with the correct folder");

            QUnit.assert.strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "Like had wrong like bookmark");

            return WinJS.Promise.join([instapaperDB.removeBookmark(targetBookmark.bookmark_id), WinJS.Promise.timeout()]);
        }).then(function () {
            return colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
        }).then(function (pendingEdits) {
            var likeEdit;
            var deleteEdit;

            QUnit.assert.ok(pendingEdits, "Didn't get any pending edits");
            QUnit.assert.strictEqual(pendingEdits.length, 2, "Expected only two pending edits;");

            pendingEdits.forEach(function (edit) {
                switch (edit.type) {
                    case InstapaperDB.BookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    case InstapaperDB.BookmarkChangeTypes.DELETE:
                        deleteEdit = edit;
                        break;

                    default:
                        QUnit.assert.ok(false, "Unexpected edit");
                }
            });

            QUnit.assert.ok(likeEdit && deleteEdit, "Didn't get correct edits");

            QUnit.assert.strictEqual(deleteEdit.bookmark_id, targetBookmark.bookmark_id, "Delete had wrong bookmark ID");
            QUnit.assert.strictEqual(deleteEdit.sourcefolder_dbid, finalSourceFolderId, "Not marked with the source folder");

            QUnit.assert.strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "like had wrong bookmark ID");
            QUnit.assert.strictEqual(likeEdit.sourcefolder_dbid, originalSourceFolderId, "not marked with the source folder");
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

            QUnit.assert.strictEqual(gets.length, sampleBookmarks.length);
            return WinJS.Promise.join(gets);
        });
    });

    promiseTest("deleteDb", deleteDb);
    promiseTest("addSampleData", addSampleData);

    function queryingForUnreadFolderReturnsOnlyUnreadItems() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (unreadBookmarks) {
            QUnit.assert.ok(unreadBookmarks, "Didn't get list of unread bookmarks");

            QUnit.assert.strictEqual(unreadBookmarks.length, 4, "Incorrect number of bookmarks");

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

            QUnit.assert.strictEqual(unreadBookmarks[0].bookmark_id, sampleBookmarks[0].bookmark_id, "Bookmark 1 not found");
            QUnit.assert.strictEqual(unreadBookmarks[0].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 1 not found in unread folder");

            QUnit.assert.strictEqual(unreadBookmarks[1].bookmark_id, sampleBookmarks[1].bookmark_id, "Bookmark 2 not found");
            QUnit.assert.strictEqual(unreadBookmarks[1].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 2 not found in unread folder");

            QUnit.assert.strictEqual(unreadBookmarks[2].bookmark_id, sampleBookmarks[2].bookmark_id, "Bookmark 3 not found");
            QUnit.assert.strictEqual(unreadBookmarks[2].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 3 not found in unread folder");

            QUnit.assert.strictEqual(unreadBookmarks[3].bookmark_id, sampleBookmarks[9].bookmark_id, "Bookmark 4 not found");
            QUnit.assert.strictEqual(unreadBookmarks[3].folder_id, InstapaperDB.CommonFolderIds.Unread, "Bookmark 4 not found in unread folder");
        });
    }

    function queryingForFolderContentsReturnsOnlyFolderItems() {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(sampleFolders[0].id);
        }).then(function (folderBookmarks) {
            QUnit.assert.ok(folderBookmarks, "Didn't get list of folder bookmarks");

            QUnit.assert.strictEqual(folderBookmarks.length, 2, "Incorrect number of bookmarks");

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

            QUnit.assert.strictEqual(folderBookmarks[0].bookmark_id, sampleBookmarks[5].bookmark_id, "Bookmark 1 not found");
            QUnit.assert.strictEqual(folderBookmarks[0].folder_id, sampleFolders[0].folder_id, "Bookmark 1 not found in unread folder");

            QUnit.assert.strictEqual(folderBookmarks[1].bookmark_id, sampleBookmarks[6].bookmark_id, "Bookmark 2 not found");
            QUnit.assert.strictEqual(folderBookmarks[1].folder_id, sampleFolders[0].folder_id, "Bookmark 2 not found in unread folder");
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
            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.liked);
        }).then(function (likedBookmarks) {
            var folderHash = {};

            QUnit.assert.ok(likedBookmarks, "No book marks returned");
            QUnit.assert.strictEqual(likedBookmarks.length, 2, "Incorrect number of bookmarks returned");

            likedBookmarks.reduce(function (hash, bookmark) {
                hash[bookmark.folder_id] = 1;
                QUnit.assert.strictEqual(bookmark.starred, 1, "Bookmark wasn't liked");

                return hash;
            }, folderHash);

            var folders = Object.keys(folderHash);
            QUnit.assert.strictEqual(folders.length, 2, "Expected different fodlers for each bookmark");
        });
    }

    promiseTest("queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders", queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders);

    promiseTest("gettingPendingEditsWithFolderReturnsOnlyChangesForThatFolder", function () {
        var instapaperDB;
        var targetFolder = sampleFolders[0];
        var destinationFolder = sampleFolders[1];
        var bookmark1 = sampleBookmarks[5];
        var bookmark2 = sampleBookmarks[6];
        var bookmark3 = sampleBookmarks[7]

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                move: instapaperDB.moveBookmark(bookmark1.bookmark_id, destinationFolder.id),
                like1: instapaperDB.likeBookmark(bookmark2.bookmark_id),
                like2: instapaperDB.likeBookmark(bookmark3.bookmark_id),
            });
        }).then(function (data) {
            sampleBookmarks[5] = data.move;
            sampleBookmarks[6] = data.like1;
            sampleBookmarks[7] = data.like2;

            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "Didn't get pending edits");
            
            QUnit.assert.ok(pendingEdits.likes, "didn't get any likes");
            QUnit.assert.strictEqual(pendingEdits.likes.length, 2, "Incorrect number of likes");

            QUnit.assert.ok(pendingEdits.moves, "didn't get any moves");
            QUnit.assert.strictEqual(pendingEdits.moves.length, 1, "incorrect number of move edits");

            return instapaperDB.getPendingBookmarkEdits(targetFolder.id);
        }).then(function (scopedPendingEdits) {
            QUnit.assert.ok(scopedPendingEdits, "didn't get any pending edits");
            
            QUnit.assert.ok(scopedPendingEdits.likes, "Didn't get likes");
            QUnit.assert.ok(scopedPendingEdits.moves, "Didn't get moves");

            QUnit.assert.strictEqual(scopedPendingEdits.likes.length, 1, "Incorrect number of likes");
            QUnit.assert.strictEqual(scopedPendingEdits.moves.length, 1, "incorrect number of moves");

            var moveEdit = scopedPendingEdits.moves[0];
            var likeEdit = scopedPendingEdits.likes[0];

            QUnit.assert.strictEqual(moveEdit.type, InstapaperDB.BookmarkChangeTypes.MOVE, "incorrect move type");
            QUnit.assert.strictEqual(moveEdit.sourcefolder_dbid, targetFolder.id, "not the correct source folder");
            QUnit.assert.strictEqual(moveEdit.destinationfolder_dbid, destinationFolder.id, "Not the correct target folder");
            QUnit.assert.strictEqual(moveEdit.bookmark_id, bookmark1.bookmark_id, "Incorrect bookmark ID");

            QUnit.assert.strictEqual(likeEdit.type, InstapaperDB.BookmarkChangeTypes.LIKE, "incorrect move type");
            QUnit.assert.strictEqual(likeEdit.sourcefolder_dbid, targetFolder.id, "not the correct source folder");
            QUnit.assert.strictEqual(likeEdit.bookmark_id, bookmark2.bookmark_id, "Incorrect bookmark ID");

            return cleanupPendingEdits.bind(instapaperDB)();
        });
    });

    promiseTest("deleteDbWithAPI", function () {
        var instapaperDB;
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            QUnit.assert.ok(folders, "Expected folders");
            QUnit.assert.ok(folders.length > 0, "Expect some folders");

            return WinJS.Promise.timeout();
        }).then(function () {
            instapaperDB.deleteAllData();
        });
    });

    promiseTest("gettingPendingBookmarkAddsWithEmptyDbReturnsUndefined", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getPendingBookmarkAdds();
        }).then(function (adds) {
            QUnit.assert.ok(Array.isArray(adds), "Didn't get expected array");
            QUnit.assert.strictEqual(adds.length, 0, "Shouldn't have had any pending edits");
        });
    });

    promiseTest("canGetAllPendingAdds", function () {
        var instapaperDB;
        
        // Reinitalize the sample data.
        setSampleData();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            var addPromises = sampleBookmarks.reduce(function (data, bookmark) {
                data.push(idb.addUrl({ url: bookmark.url, title: bookmark.title }));
                return data;
            }, []);

            addPromises.push(WinJS.Promise.timeout());
            return WinJS.Promise.join(addPromises);
        }).then(function () {
            return instapaperDB.getPendingBookmarkEdits();
        }).then(function (pendingEdits) {
            QUnit.assert.ok(pendingEdits, "Expected pending edits");
            QUnit.assert.strictEqual(pendingEdits.adds.length, sampleBookmarks.length, "Didn't find enough pending edits");

            return instapaperDB.getPendingBookmarkAdds();
        }).then(function (pendingAdds) {
            QUnit.assert.ok(pendingAdds, "Didn't get any pending adds");
            QUnit.assert.ok(pendingAdds.length, sampleBookmarks.length, "Didn't find enough pending adds");

            return cleanupPendingEdits.bind(instapaperDB)();
        }).then(function () {
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("gettingPendingAddsWithNoAddsReturnsEmptyArray", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            return idb.getPendingBookmarkAdds();
        }).then(function (adds) {
            QUnit.assert.ok(Array.isArray(adds), "Didn't get expected array");
            QUnit.assert.strictEqual(adds.length, 0, "Shouldn't have had any pending edits");
        });
    });

    promiseTest("addSampleData", addSampleData);
    promiseTest("pendingEditsAreCorrectlyBucketed", function () {
        var instapaperDB;
        var unreadFolderDbId;
        var archiveFolderDbId;
        
        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                like: idb.likeBookmark(sampleBookmarks[0].bookmark_id, true),
                unreadFolder: idb.getFolderFromFolderId(InstapaperDB.CommonFolderIds.Unread),
                archiveFolder: idb.getFolderFromFolderId(InstapaperDB.CommonFolderIds.Archive),
                moveBookmarkToSampleFolder: idb.moveBookmark(sampleBookmarks[4].bookmark_id, sampleFolders[0].id, true),
            });
        }).then(function (data) {
            unreadFolderDbId = data.unreadFolder.id;
            archiveFolderDbId = data.archiveFolder.id;

            var operations = [
                instapaperDB.unlikeBookmark(sampleBookmarks[0].bookmark_id),
                instapaperDB.likeBookmark(sampleBookmarks[1].bookmark_id),
                instapaperDB.moveBookmark(sampleBookmarks[2].bookmark_id, sampleFolders[0].id),
                instapaperDB.removeBookmark(sampleBookmarks[3].bookmark_id),
                instapaperDB.moveBookmark(sampleBookmarks[4].bookmark_id, instapaperDB.commonFolderDbIds.unread),
                WinJS.Promise.timeout(),
            ];

            return WinJS.Promise.join(operations);
        }).then(function () {
            return WinJS.Promise.join({
                unread: instapaperDB.getPendingBookmarkEdits(unreadFolderDbId),
                archive: instapaperDB.getPendingBookmarkEdits(archiveFolderDbId),
                sampleFolder: instapaperDB.getPendingBookmarkEdits(sampleFolders[0].id),
            });
        }).then(function (data) {
            QUnit.assert.ok(data.unread, "No unread info");
            QUnit.assert.ok(data.archive, "No archive info");

            QUnit.assert.ok(!data.unread.adds, "Didn't expect any adds");

            QUnit.assert.ok(data.unread.unlikes, "Didn't get any unlikes");
            QUnit.assert.strictEqual(data.unread.unlikes.length, 1, "Only expected one like edit");
            QUnit.assert.strictEqual(data.unread.unlikes[0].bookmark_id, sampleBookmarks[0].bookmark_id, "Incorrect bookmark");
            QUnit.assert.strictEqual(data.unread.unlikes[0].type, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Not correct edit type");

            QUnit.assert.ok(data.unread.likes, "Didn't get any likes");
            QUnit.assert.strictEqual(data.unread.likes.length, 1, "Didn't get enough likes");
            QUnit.assert.strictEqual(data.unread.likes[0].bookmark_id, sampleBookmarks[1].bookmark_id, "Incorrect bookmark ID");
            QUnit.assert.strictEqual(data.unread.likes[0].type, InstapaperDB.BookmarkChangeTypes.LIKE, "Incorrect edit type");

            QUnit.assert.ok(data.unread.moves, "Didn't get any moves");

            // Check the item being moved OUT of unread
            QUnit.assert.strictEqual(data.unread.moves.length, 2, "Didn't get enough moves");
            QUnit.assert.strictEqual(data.unread.moves[0].bookmark_id, sampleBookmarks[2].bookmark_id, "Incorrect bookmark ID");
            QUnit.assert.strictEqual(data.unread.moves[0].type, InstapaperDB.BookmarkChangeTypes.MOVE, "Incorrect edit type");
            QUnit.assert.strictEqual(data.unread.moves[0].destinationfolder_dbid, sampleFolders[0].id, "Wrong destination folder");
            QUnit.assert.strictEqual(data.unread.moves[0].sourcefolder_dbid, instapaperDB.commonFolderDbIds.unread, "Incorrect source folder");

            // Check the item being moved INTO unread
            QUnit.assert.strictEqual(data.unread.moves[1].bookmark_id, sampleBookmarks[4].bookmark_id, "Incorrect bookmark ID");
            QUnit.assert.strictEqual(data.unread.moves[1].type, InstapaperDB.BookmarkChangeTypes.MOVE, "Incorrect edit type");
            QUnit.assert.strictEqual(data.unread.moves[1].destinationfolder_dbid, instapaperDB.commonFolderDbIds.unread, "Wrong destination folder");
            QUnit.assert.strictEqual(data.unread.moves[1].sourcefolder_dbid, sampleFolders[0].id, "Incorrect source folder");


            QUnit.assert.ok(data.archive.deletes, "Didn't get any deletes");
            QUnit.assert.strictEqual(data.archive.deletes.length, 1, "Didn't get enough deletes");
            QUnit.assert.strictEqual(data.archive.deletes[0].bookmark_id, sampleBookmarks[3].bookmark_id, "Incorrect bookmark ID");
            QUnit.assert.strictEqual(data.archive.deletes[0].type, InstapaperDB.BookmarkChangeTypes.DELETE, "Incorrect edit type");
        });
    });

    QUnit.module("InstapaperDBCore");
    function deleteCoreInfraDbs() {
        return WinJS.Promise.join([
            deleteDb("One"),
            deleteDb("Two"),
        ]);
    }

    promiseTest("deleteCoreDbs", deleteCoreInfraDbs);

    function canCreateTwoDataBasesAndTheyreIsolated() {
        const dbNameOne = "One";
        const dbNameTwo = "Two";
        let dbOne;
        let dbTwo;

        const bookmarkOne = {
            title: "Bookmark1",
            bookmark_id: "1",
            folder_dbid: null,
        };

        const bookmarkTwo = {
            title: "Bookmark2",
            bookmark_id: "2",
            folder_dbid: null
        };

        return WinJS.Promise.join([
            getNewInstapaperDBAndInit(dbNameOne),
            getNewInstapaperDBAndInit(dbNameTwo)
        ]).then((result) => {
            dbOne = result[0];
            dbTwo = result[1];
            bookmarkOne.folder_dbid = dbOne.commonFolderDbIds.unread;
            bookmarkTwo.folder_dbid = dbTwo.commonFolderDbIds.unread;

            return WinJS.Promise.join([
                dbOne.addBookmark(bookmarkOne),
                dbTwo.addBookmark(bookmarkTwo)
            ]);
        }).then(() => {
            return WinJS.Promise.join([
                dbOne.listCurrentBookmarks(),
                dbTwo.listCurrentBookmarks()
            ]);
        }).then((result) => {
            QUnit.assert.strictEqual(result[0].length, 1, "Wrong number of bookmarks in DB 1");
            QUnit.assert.strictEqual(result[1].length, 1, "Wrong number of bookmarks in DB 2");

            QUnit.assert.strictEqual(result[0][0].title, bookmarkOne.title, "DB one bookmark has wrong title");
            QUnit.assert.strictEqual(result[0][0].bookmark_id, bookmarkOne.bookmark_id, "DB one bookmark has wrong ID");

            QUnit.assert.strictEqual(result[1][0].title, bookmarkTwo.title, "DB two bookmark has wrong title");
            QUnit.assert.strictEqual(result[1][0].bookmark_id, bookmarkTwo.bookmark_id, "DB two bookmark has wrong ID");

            return WinJS.Promise.join([
                dbOne.deleteAllData(),
                dbTwo.deleteAllData()
            ]).then(() => {
                return WinJS.Promise.join([
                    getNewInstapaperDBAndInit(dbNameOne),
                    getNewInstapaperDBAndInit(dbNameTwo),
                ]);
            }).then((result) => {
                dbOne = result[0];
                dbTwo = result[0];
            });
        }).then(() => {
            return WinJS.Promise.join([
                dbOne.listCurrentBookmarks(),
                dbTwo.listCurrentBookmarks()
            ]);
        }).then((result) => {
            QUnit.assert.strictEqual(result[0].length, 0, "Wrong number of bookmarks in DB 1");
            QUnit.assert.strictEqual(result[1].length, 0, "Wrong number of bookmarks in DB 2");
        });
    }

    promiseTest("canCreateTwoDataBasesAndTheyreIsolated", canCreateTwoDataBasesAndTheyreIsolated);
    promiseTest("deleteCoreDbsPostTest", deleteCoreInfraDbs);
})();