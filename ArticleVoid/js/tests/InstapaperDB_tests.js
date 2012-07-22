(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);

    var defaultFolderIds = ["unread", "starred", "archive"];

    function startOnSuccessOfPromise() {
        start();
    }

    function startOnFailureOfPromise(error) {
        debugger;
        ok(false, "Failed: " + error.toString());
        start();
    }

    function promiseTest(name, func) {
        asyncTest(name, function () {
            WinJS.Promise.as(func()).done(startOnSuccessOfPromise, startOnFailureOfPromise);
        });
    }

    function expectNoPendingEdits(idb) {
        return idb.getPendingFolderEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
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
        return new InstapaperDB().initialize().then(function(idb) {
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
        return new InstapaperDB().initialize().then(function (idb) {
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

            return expectNoPendingEdits(instapaperDB);
        });
    }

    function canGetAddedFolderByDbId() {
        var folderName = "LocalFolder"
        return new InstapaperDB().initialize().then(function (idb) {
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
        return new InstapaperDB().initialize().then(function (idb) {
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
        return new InstapaperDB().initialize().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(folderName, true);
        }).then(function () {
            ok(false, "Should have failed");
        }, function (error) {
            strictEqual(error.code, Codevoid.ArticleVoid.DB.InstapaperDB.ErrorCodes.FOLDER_DUPLICATE_TITLE, "Wrong error code");
            ok(true, "Should fail here");
        }).then(function (folders) {
            return expectNoPendingEdits(instapaperDB);
        });
    }

    function canRemoveFolderNoPendingEdit() {
        var instapaperDB;
        var folderId;

        return new InstapaperDB().initialize().then(function (idb) {
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

            return expectNoPendingEdits(instapaperDB);
        });
    }

    function canAddFolderWithPendingEdit() {
        var instapaperDB;
        var folderName = "LocalFolder";
        var addFolderResult;
        return new InstapaperDB().initialize().then(function (idb) {
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
            strictEqual(pendingEdit.type, Codevoid.ArticleVoid.DB.InstapaperDB.PendingEditTypes.ADD, "Expected to be ADD edit type");
            strictEqual(pendingEdit.folderTableId, addFolderResult.id, "Pending edit wasn't for the folder we added");

            return instapaperDB._deletePendingFolderEdit(pendingEdit.id);
        });
    }

    function canRemoveFolderWithPendingEdit() {
        var instapaperDB;
        var folderToRemove;

        return new InstapaperDB().initialize().then(function (idb) {
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
            strictEqual(pendingEdit.type, Codevoid.ArticleVoid.DB.InstapaperDB.PendingEditTypes.DELETE, "Expected to be DELETE edit type");
            strictEqual(pendingEdit.removedFolderId, folderToRemove.folder_id, "Pending edit wasn't for the folder we added");
            strictEqual(pendingEdit.title, folderToRemove.title, "Didn't didn't match");

            return instapaperDB._deletePendingFolderEdit(pendingEdit.id);
        });
    }

    function deletingUnsyncedAddededFolderNoOps() {
        var instapaperDB = new InstapaperDB();

        return new InstapaperDB().initialize().then(function (idb) {
            instapaperDB = idb;
            return instapaperDB.addFolder("shouldntBeSyncd");
        }).then(function (addedFolder) {
            return WinJS.Promise.join({
                timeout: WinJS.Promise.timeout(),
                folder: WinJS.Promise.as(addedFolder),
            });
        }).then(function(data) {
            return WinJS.Promise.join([instapaperDB.removeFolder(data.folder.id), WinJS.Promise.timeout()]);
        }).then(function() {
           return expectNoPendingEdits(instapaperDB);
        });
    }

    function addingDeletedFolderWithoutSyncBringsBackFolderId() {
        var instapaperDB = new InstapaperDB();
        var folderTitle = "shouldntBeSyncd";
        var addedFolder;

        return new InstapaperDB().initialize().then(function (idb) {
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
            return expectNoPendingEdits(instapaperDB);
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

            return expectNoPendingEdits(instapaperDB);
        });
    }

    function multipleEditsOnSameFolderFunction() {
        /*
        If you add a deleted folder, then theres no id from the server
        to ID it. However, the server will barf on similar titles.
        Should we key off the title too? Maybe?
        Does that mean we want an index? Infact, given that it's
        a requirement we should check on adding multiple folders.

        Assuming we enforce that, how can we check to make sure if
        we re-add the same named folder, what we do? Do we just
        resurrect the folder from the deleted hole because we
        left the folder name in there and can use that? Probably.

        What about bookmarks when we're deleting folders?
        Well, we should probably just manually move all the bookmarks
        into the unread folder.
        */
        ok(true);
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

    module("InstapaperDBSyncFolders");

    function addDefaultRemoteData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return folders.add("sampleFolder1").then(function (folder) {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage1.html",
                folder_id: folder.folder_id
            });
        }).then(function () {
            return folders.add("sampleFolder2");
        }).then(function (folder) {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage2.html",
                folder_id: folder.folder_id,     
            });
        }).then(function () {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage3.html"
            });
        }).then(function (addedBookmark) {
            return bookmarks.archive(addedBookmark.bookmark_id);
        }).then(function () {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage4.html"
            });
        }).then(function (addedBookmark) {
            return bookmarks.star(addedBookmark.bookmark_id);
        }).then(function () {
            ok(true, "it went very very wrong");
        });
    }

    //promiseTest("destroyRemoteAccountDataCleanUpFirst", destroyRemoteAccountData);
    //promiseTest("addDefaultRemoteData", addDefaultRemoteData);

    module("InstapaperDBFolderSync");

    function addsFoldersOnFirstSight() {
        ok(true);
    }

    //promiseTest("addsFoldersOnFirstSight", addsFoldersOnFirstSight);

    module("InstapaperDBdestroyRemoteAccountData")

    function deleteAllBookmarks(bookmarksToDelete) {
        var client = this;
        var deletePromises = [];
        bookmarksToDelete.forEach(function (bookmark) {
            client.deleteBookmark(bookmark.bookmark_id);
        });

        return WinJS.Promise.join(deletePromises);
    }

    function destroyRemoteAccountData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return folders.list().then(function (serverFolders) {
            var deletedFoldersPromises = [];
            serverFolders.forEach(function (folder) {
                // We can't delete the default folders, so skip them
                switch (folder.folder_id) {
                    case "unread":
                    case "starred":
                    case "archive":
                        return;

                    default:
                        break;
                }

                deletedFoldersPromises.push(folders.deleteFolder(folder.folder_id));
            });

            return WinJS.Promise.join(deletedFoldersPromises);
        }).then(function () {
            return bookmarks.list({ folder_id: "unread" }).then(deleteAllBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "starred" }).then(deleteAllBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "archive" }).then(deleteAllBookmarks.bind(bookmarks));
        }).then(function () {
            ok(true, "It went very very wrong");
        });
    }

    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();