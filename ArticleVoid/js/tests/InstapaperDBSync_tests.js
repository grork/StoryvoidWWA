﻿(function () {
    "use strict";

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive];
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    var expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var deleteDb = InstapaperTestUtilities.deleteDb;

    var addedRemoteFolders;

    function setSampleFolders() {
        addedRemoteFolders = [
            { title: "sampleFolder1", },
            { title: "sampleFolder2", },
            { title: "sampleFolder3", },
        ];
    }

    var addedRemoteBookmarks;
    function setSampleBookmarks() {
        addedRemoteBookmarks = [
            { url: "http://www.codevoid.net/articlevoidtest/TestPage1.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage2.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage3.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage4.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage5.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage6.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage7.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage8.html" },
            { url: "http://www.codevoid.net/articlevoidtest/TestPage9.html" },
        ];
    }

    function getNewSyncEngine() {
        return new Codevoid.ArticleVoid.InstapaperSync(clientInformation);
    }

    function deleteAllRemoteBookmarks(bookmarksToDelete) {
        var client = this;
        var deletePromises = [];
        bookmarksToDelete.bookmarks.forEach(function (bookmark) {
            client.deleteBookmark(bookmark.bookmark_id);
        });

        return WinJS.Promise.join(deletePromises);
    }

    module("InstapaperSync");

    function destroyRemoteAccountData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return folders.list().then(function (serverFolders) {
            var deletedFoldersPromises = [];
            serverFolders.forEach(function (folder) {
                // We can't delete the default folders, so skip them
                switch (folder.folder_id) {
                    case InstapaperDB.CommonFolderIds.Unread:
                    case InstapaperDB.CommonFolderIds.Liked:
                    case InstapaperDB.CommonFolderIds.Archive:
                        return;

                    default:
                        break;
                }

                deletedFoldersPromises.push(folders.deleteFolder(folder.folder_id));
            });

            return WinJS.Promise.join(deletedFoldersPromises);
        }).then(function () {
            return bookmarks.list({ folder_id: "unread" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "starred" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "archive" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            ok(true, "It went very very wrong");
        });
    }

    promiseTest("destoryRemoteDataOnStart", destroyRemoteAccountData);
    promiseTest("deleteDbOnStart", deleteDb);

    function addDefaultRemoteFolders() {
        setSampleFolders();
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        var addPromises = [];

        addedRemoteFolders.forEach(function (folder, index) {
            addPromises.push(folders.add(folder.title).then(function (remoteFolder) {
                addedRemoteFolders[index] = remoteFolder;
            }));
        });

        return WinJS.Promise.join(addPromises).then(function () {
            ok(true, "Folders added");
        });
    }

    promiseTest("addDefaultRemoteFolders", addDefaultRemoteFolders);

    function addsFoldersOnFirstSight() {
        var sync = getNewSyncEngine();
        var instapaperDB;
        return sync.sync().then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            ok(folders, "Didn't get folder list");

            strictEqual(folders.length, 6, "Unexpected number of folders");

            folders.forEach(function (folder) {
                switch (folder.folder_id) {
                    case InstapaperDB.CommonFolderIds.Unread:
                    case InstapaperDB.CommonFolderIds.Archive:
                    case InstapaperDB.CommonFolderIds.Liked:
                        return;
                        break;

                    default:
                        break;
                }

                var wasInSyncedSet = addedRemoteFolders.some(function (f) {
                    return f.folder_id === folder.folder_id;
                });

                ok(wasInSyncedSet, "Folder: " + folder.folder_id + ", " + folder.title + " wasn't expected to be found");
            });

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    promiseTest("addsFoldersOnFirstSight", addsFoldersOnFirstSight);

    function differentFolderTitleOnServerIsSyncedToDB() {
        var sync = getNewSyncEngine();
        var targetRemoteFolder = addedRemoteFolders[0];
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getFolderFromFolderId(targetRemoteFolder.folder_id);
        }).then(function (localFolder) {
            localFolder.title = Date.now();
            return WinJS.Promise.join({
                updatedFolder: instapaperDB.updateFolder(localFolder),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (data) {
            ok(data.updatedFolder, "Didn't get updated folder");
            notStrictEqual(data.updatedFolder.title, targetRemoteFolder.title, "Title didn't change");

            return sync.sync();
        }).then(function () {
            return instapaperDB.getFolderFromFolderId(targetRemoteFolder.folder_id);
        }).then(function (localFolder) {
            strictEqual(localFolder.title, targetRemoteFolder.title, "Title did not correctly sync");
            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    promiseTest("differentFolderTitleOnServerIsSyncedToDB", differentFolderTitleOnServerIsSyncedToDB);

    function removedFolderOnServerIsDeletedLocallyOnSync() {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var fakeFolder = {
            title: "foo",
            folder_id: "foo_1",
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                folder: instapaperDB.addFolder(fakeFolder, true),
                timeout: WinJS.Promise.timeout(),
            }).then(function () {
                return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            }).then(function (addedFolder) {
                ok(addedFolder, "Didn't get added folder");
                strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                ok(!!addedFolder.id, "Folder didn't have DB id");

                return WinJS.Promise.join([sync.sync(), WinJS.Promise.timeout()]);
            }).then(function () {
                return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            }).then(function (addedFolder) {
                ok(!addedFolder, "Shouldn't have gotten the folder. It should have been removed");

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });
    }

    promiseTest("removedFolderOnServerIsDeletedLocallyOnSync", removedFolderOnServerIsDeletedLocallyOnSync);

    function removedAndAddedFoldersOnServerAreCorrectlySynced() {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var fakeFolder = {
            title: "foo",
            folder_id: "foo_1",
        };

        var newRemoteFolder = {
            title: Date.now() + "", // now() is an integer. It comes back as a string, Just make it a damn string
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                folder: instapaperDB.addFolder(fakeFolder, true),
                timeout: WinJS.Promise.timeout(),
            }).then(function () {
                return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            }).then(function (addedFolder) {
                ok(addedFolder, "Didn't get added folder");
                strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                ok(!!addedFolder.id, "Folder didn't have DB id");

                var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

                // Add a non-local folder to syncdown at the same time.
                return folders.add(newRemoteFolder.title);
            }).then(function (addedRemoteFolder) {
                // Save the ID for later user.
                newRemoteFolder.folder_id = addedRemoteFolder.folder_id;

                return WinJS.Promise.join([sync.sync(), WinJS.Promise.timeout()]);
            }).then(function () {
                return WinJS.Promise.join({
                    deleted: instapaperDB.getFolderFromFolderId(fakeFolder.folder_id),
                    added: instapaperDB.getFolderFromFolderId(newRemoteFolder.folder_id),
                });
            }).then(function (folders) {
                ok(!folders.deleted, "Shouldn't have gotten the folder. It should have been removed");

                ok(folders.added, "Didn't find added folder");
                strictEqual(folders.added.folder_id, newRemoteFolder.folder_id, "Not correct folder ID");
                strictEqual(folders.added.title, newRemoteFolder.title, "Incorrect title");

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });
    }

    promiseTest("removedAndAddedFoldersOnServerAreCorrectlySynced", removedAndAddedFoldersOnServerAreCorrectlySynced);

    promiseTest("pendedAddsAreUploaded", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var newFolder = { title: Date.now() + "", };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(newFolder);
        }).then(function (addedFolder) {
            ok(!!addedFolder.id, "need folder id to find it later");
            newFolder = addedFolder;

            return sync.sync();
        }).then(function () {
            return (new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation)).list();
        }).then(function (remoteFolders) {
            var localFolderWasSynced = remoteFolders.some(function (item) {
                return item.title === newFolder.title;
            });

            ok(localFolderWasSynced, "Local folder was not found on the server");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    });

    promiseTest("foldersGetUpdatedFolderIdsWhenUploaded", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var newFolder = { title: Date.now() + "", };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(newFolder);
        }).then(function (addedFolder) {
            ok(!!addedFolder.id);
            strictEqual(addedFolder.folder_id, undefined, "Shouldn't have had a folder id yet.");
            newFolder = addedFolder;

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            strictEqual(pendingEdits.length, 1, "Only expected one pending edit");

            return sync.sync();
        }).then(function () {
            return instapaperDB.getFolderByDbId(newFolder.id);
        }).then(function (syncedFolder) {
            ok(!!syncedFolder.folder_id, "Didn't find a folder ID");
            addedRemoteFolders.push(syncedFolder);
            return expectNoPendingFolderEdits(instapaperDB);
        });
    });

    promiseTest("sameFolderRemoteAndLocalButUnsynced", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var local = {
            title: Date.now() + "",
            cookie: true,
        };

        var remote = { title: local.title }; // make sure the remote is the same

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.addFolder(local),
                remote: (new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation)).add(remote.title),
            }).then(function (data) {
                local = data.local;
                remote = data.remote;

                return sync.sync();
            }).then(function () {
                return expectNoPendingFolderEdits(instapaperDB);
            }).then(function () {
                return instapaperDB.getFolderByDbId(local.id);
            }).then(function (localFolder) {
                ok(localFolder, "Didn't find the local folder");
                strictEqual(localFolder.folder_id, remote.folder_id, "Folder ID didn't match the local folder");
                strictEqual(localFolder.title, remote.title, "Folder title didn't match");
                ok(localFolder.cookie, "Cookie was not present on the DB folder. Data Squashed?");
            });
        });
    });

    promiseTest("pendedDeletesAreUploaded", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.getFolderFromFolderId(targetFolder.folder_id),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            ok(!!data.local.id, "need folder id to delete");
            ok(data.remoteFolders.some(function (item) {
                return item.folder_id === data.local.folder_id;
            }), "Folder to delete wasn't present remotely");

            return instapaperDB.removeFolder(data.local.id);
        }).then(function () {
            return sync.sync();
        }).then(function () {
            return WinJS.Promise.join({
                remoteFolders: folders.list(),
                localFolder: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
            });
        }).then(function (data) {
            ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            ok(!data.localFolder, "Local folder should be missing");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    });

    promiseTest("deletedLocallyAndRemotelySyncsSuccessfully", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.getFolderFromFolderId(targetFolder.folder_id),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            ok(!!data.local.id, "need folder id to delete");
            ok(data.remoteFolders.some(function (item) {
                return item.folder_id === data.local.folder_id;
            }), "Folder to delete wasn't present remotely");

            return WinJS.Promise.join({
                local: instapaperDB.removeFolder(data.local.id),
                remote: folders.deleteFolder(data.local.folder_id),
            });
        }).then(function () {
            return sync.sync();
        }).then(function () {
            return WinJS.Promise.join({
                remoteFolders: folders.list(),
                localFolder: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
            });
        }).then(function (data) {
            ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            ok(!data.localFolder, "Local folder should be missing");

            return expectNoPendingFolderEdits(instapaperDB);
        });
    });

    promiseTest("pendedDeletesAndAddsSyncUp", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var newFolder = { title: Date.now() + "" };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                toRemove: idb.getFolderFromFolderId(targetFolder.folder_id),
                toAdd: idb.addFolder(newFolder),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            ok(!!data.toRemove.id, "need folder id to delete");
            ok(data.remoteFolders.some(function (item) {
                return item.folder_id === data.toRemove.folder_id;
            }), "Folder to delete wasn't present remotely");

            ok(data.toAdd, "Didn't get added folder");
            ok(data.toAdd.id, "Didn't have an ID");
            newFolder = data.toAdd;

            return instapaperDB.removeFolder(data.toRemove.id);
        }).then(function () {
            return sync.sync();
        }).then(function () {
            return WinJS.Promise.join({
                remoteFolders: folders.list(),
                removed: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                added: instapaperDB.getFolderByDbId(newFolder.id),
            });
        }).then(function (data) {
            ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            ok(!data.removed, "Local folder should be missing");

            ok(data.added, "Didn't get added folder. It got lost");
            addedRemoteFolders.push(data.added);

            return expectNoPendingFolderEdits(instapaperDB);
        });
    });

    promiseTest("destoryRemoteDataBeforeBookmarks", destroyRemoteAccountData);
    promiseTest("deleteDbBeforeBookmarks", deleteDb);
    promiseTest("addDefaultRemoteFoldersBeforeBookmarks", addDefaultRemoteFolders);
    promiseTest("addsFoldersOnFirstSightBeforeBookmarks", addsFoldersOnFirstSight);

    promiseTest("addDefaultBookmarks", function () {
        setSampleBookmarks();

        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        var addedPromises = [];
        addedRemoteBookmarks.forEach(function (toAdd, index) {
            addedPromises.push(bookmarks.add(toAdd).then(function(added) {
                addedRemoteBookmarks[index] = added;
            }));
        });

        return WinJS.Promise.join(addedPromises).then(function () {
            ok(true, "bookmarks weren't added");
        });
    });

    promiseTest("bookmarksAddedOnFirstSight", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        return sync.sync().then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(InstapaperDB.CommonFolderIds.Unread);
        }).then(function (bookmarks) {
            ok(bookmarks, "Didn't get any bookmarks");
            strictEqual(bookmarks.length, 9, "Didn't get enough bookmarks");

            var expectedBookmarks = [];
            for (var i = 1; i < 10; i++) {
                expectedBookmarks.push("http://www.codevoid.net/articlevoidtest/TestPage" + i + ".html");
            }

            ok(expectedBookmarks.length, "Should have added some test pages to check");

            var allInUnread = bookmarks.every(function (item) {
                var expectedBookmarkIndex = expectedBookmarks.indexOf(item.url);
                if (expectedBookmarkIndex > -1) {
                    expectedBookmarks.splice(expectedBookmarkIndex, 1);
                }

                return item.folder_id === InstapaperDB.CommonFolderIds.Unread;
            });

            ok(allInUnread, "Some of the sync'd bookmarks were not in the unread folder");
            strictEqual(expectedBookmarks.length, 0, "Some bookmarks were not found");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });

    });
    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();