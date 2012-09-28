(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

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
        ];
    }

    function getNewSyncEngine() {
        return new Codevoid.ArticleVoid.InstapaperSync(clientInformation);
    }

    function deleteAllRemoteBookmarks(bookmarksToDelete) {
        var client = this;
        var deletePromises = [];
        bookmarksToDelete.bookmarks.forEach(function (bookmark) {
            deletePromises.push(client.deleteBookmark(bookmark.bookmark_id));
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
        return sync.sync({ folders: true }).then(function () {
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

            return sync.sync({ folders: true });
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

                return WinJS.Promise.join([sync.sync({ folders: true }), WinJS.Promise.timeout()]);
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

                return WinJS.Promise.join([sync.sync({ folders: true }), WinJS.Promise.timeout()]);
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

            return sync.sync({ folders: true });
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

            return sync.sync({ folders: true });
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

                return sync.sync({ folders: true });
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
            return sync.sync({ folders: true });
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
            return sync.sync({ folders: true });
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
            return sync.sync({ folders: true });
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
        var bookmarksToAdd = [].concat(addedRemoteBookmarks);

        function bookmarkAdded(added) {
            addedRemoteBookmarks[(addedRemoteBookmarks.length - 1) - bookmarksToAdd.length] = added;
            
            var next = bookmarksToAdd.pop();
            if(!next) {
                ok(true, "Bookmarks added");
                return;
            }

            return WinJS.Promise.timeout(100).then(function() {
                return bookmarks.add(next);
            }).then(bookmarkAdded);
        }

        return WinJS.Promise.timeout(5000).then(function () {
            return bookmarks.add(bookmarksToAdd.pop()).then(bookmarkAdded);
        });
    });

    promiseTest("bookmarksAddedOnFirstSight", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        return sync.sync({ bookmarks: true }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (bookmarks) {
            ok(bookmarks, "Didn't get any bookmarks");
            strictEqual(bookmarks.length, addedRemoteBookmarks.length, "Didn't get enough bookmarks");


            // Check all the bookmarks are correctly present.
            var expectedBookmarks = [];
            for (var i = 1; i < addedRemoteBookmarks.length + 1; i++) {
                expectedBookmarks.push("http://www.codevoid.net/articlevoidtest/TestPage" + i + ".html");
            }

            ok(expectedBookmarks.length, "Should have added some test pages to check");

            var allInUnread = bookmarks.every(function (item) {
                var expectedBookmarkIndex = expectedBookmarks.indexOf(item.url);
                if (expectedBookmarkIndex > -1) {
                    expectedBookmarks.splice(expectedBookmarkIndex, 1);
                }

                return item.folder_dbid === instapaperDB.commonFolderDbIds.unread;
            });

            ok(allInUnread, "Some of the sync'd bookmarks were not in the unread folder");
            strictEqual(expectedBookmarks.length, 0, "Some bookmarks were not found");

            // Verify the other properties
            addedRemoteBookmarks.forEach(function (b) {
                var local;

                // Find the local matching bookmark by URL
                for (var i = 0; i < bookmarks.length; i++) {
                    if (bookmarks[i].url === b.url) {
                        local = bookmarks[i];
                        break;
                    }
                }

                ok(local, "Didn't find the URL locally. Should have done");

                strictEqual(local.bookmark_id, b.bookmark_id, "Bookmark ID's didn't match");
                strictEqual(local.title, b.title, "Title's didn't match");
                strictEqual(local.hash, b.hash, "Hash didn't match");
            });

            return expectNoPendingBookmarkEdits(instapaperDB);
        });

    });

    promiseTest("syncingOnlyFoldersOnlySyncsFolders", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var addedFolderName = Date.now() + "";
        var addedFolder;
        var currentBookmarkCount;
        var currentFolderCount;

        var f = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var b = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        
        return WinJS.Promise.join({
            folderAdd: f.add(addedFolderName),
            bookmarkAdd: b.add({ url: "http://www.codevoid.net/articlevoidtest/TestPage3.html" }),
            idb: getNewInstapaperDBAndInit(),
        }).then(function (data) {
            instapaperDB = data.idb;
            addedFolder = data.folderAdd;
            addedRemoteBookmarks.push(data.bookmarkAdd);

            return WinJS.Promise.join({
                folders: data.idb.listCurrentFolders(),
                bookmarks: data.idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            currentBookmarkCount = data.bookmarks.length;
            currentFolderCount = data.folders.length;

            return sync.sync({ folders: true, bookmarks: false });
        }).then(function () {
            return WinJS.Promise.join({
                folders: instapaperDB.listCurrentFolders(),
                bookmarks: instapaperDB.listCurrentBookmarks(),
            });
        }).then(function (data) {
            strictEqual(data.folders.length, currentFolderCount + 1, "Incorrect number of folders");

            ok(data.folders.some(function (folder) {
                return folder.title === addedFolderName;
            }), "Didn't find the added folder locally");

            strictEqual(data.bookmarks.length, currentBookmarkCount, "Incorrect number of bookmarks");

            return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
        }).then(function (folder) {
            addedRemoteFolders.push(folder);
        });
    });

    promiseTest("syncingOnlyBookmarksOnlySyncsBookmarks", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var currentBookmarkCount;
        var currentFolderCount;
        var addedFolderName = Date.now() + "";
        var addedFolder;

        var f = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var b = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return WinJS.Promise.join({
            folderAdd: f.add(addedFolderName),
            idb: getNewInstapaperDBAndInit(),
        }).then(function (data) {
            instapaperDB = data.idb;
            addedFolder = data.folderAdd;

            return WinJS.Promise.join({
                folders: data.idb.listCurrentFolders(),
                bookmarks: data.idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            currentBookmarkCount = data.bookmarks.length;
            currentFolderCount = data.folders.length;

            return sync.sync({ folders: false, bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                folders: instapaperDB.listCurrentFolders(),
                bookmarks: instapaperDB.listCurrentBookmarks(),
            });
        }).then(function (data) {
            strictEqual(data.folders.length, currentFolderCount, "Incorrect number of folders");
            strictEqual(data.bookmarks.length, currentBookmarkCount + 1, "Incorrect number of bookmarks");

            ok(data.bookmarks.some(function (bookmark) {
                return bookmark.url === addedRemoteBookmarks[addedRemoteBookmarks.length - 1].url;
            }), "Didn't find the expected bookmark");

            return sync.sync();
        }).then(function () {
            return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
        }).then(function (folder) {
            addedRemoteFolders.push(folder);
        });
    });

    promiseTest("locallyAddedBookmarksGoUpToUnread", function () {
        var instapaperDB;
        var targetUrl = "http://www.codevoid.net/articlevoidtest/TestPage4.html";
        var targetTitle = Date.now() + "";

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.addUrl({ url: targetUrl, title: targetTitle });
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return WinJS.Promise.join({
                remoteBookmarks: (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
                localBookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
            });
        }).then(function (data) {
            var rb = data.remoteBookmarks;
            var lb = data.localBookmarks;

            var remoteBookmark = rb.bookmarks.filter(function (f) {
                return f.url === targetUrl;
            })[0];

            ok(remoteBookmark, "Didn't find the remote bookmark added");
            strictEqual(remoteBookmark.title, targetTitle, "Remote title was incorrect");

            var addedBookmark = lb.filter(function (f) {
                return f.url === targetUrl;
            })[0];

            ok(addedBookmark, "Didn't see the added folder locally");
            strictEqual(addedBookmark.title, targetTitle, "Local title was incorrect");

            addedRemoteBookmarks.push(addedBookmark);

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("syncingBookmarkThatIsAlreadyAvailableRemotelyDoesntDuplicate", function () {
        var instapaperDB;
        var targetUrl = "http://www.codevoid.net/articlevoidtest/TestPage4.html";
        var targetTitle = Date.now() + "";
        var localBookmarkCountBeforeSync;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                added: idb.addUrl({ url: targetUrl, title: targetTitle }),
                localBookmarks: idb.listCurrentBookmarks(idb.commonFolderDbIds.unread),
            });
        }).then(function (data) {
            localBookmarkCountBeforeSync = data.localBookmarks.length;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
        }).then(function (lb) {
            strictEqual(lb.length, localBookmarkCountBeforeSync, "Didn't expect any change in the bookmark counts");
            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("remoteProgressChangesAreCorrectlySyncedLocally", function () {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            ok(bookmark, "Need a bookmark to work with");

            notStrictEqual(bookmark.progress, 0.5, "Progress is already where we're going to set it");
            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).updateReadProgress({
                bookmark_id: bookmark.bookmark_id,
                progress: 0.5,
                progress_timestamp: Date.now(),
            });
        }).then(function (bookmark) {
            updatedBookmark = bookmark;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (bookmark) {
            equal(bookmark.progress, updatedBookmark.progress, "Progress did not match");
            strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Wrong bookmark timestamp");
            strictEqual(bookmark.hash, updatedBookmark.hash, "hashes were incorrrect");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("likedRemoteBookmarkUpdatedLocallyAfterSync", function () {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            ok(bookmark, "Need a bookmark to work with");

            notStrictEqual(bookmark.starred, 1, "Bookmark was already liked. We need  it to not be");

            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).star(bookmark.bookmark_id);
        }).then(function (bookmark) {
            bookmark.starred = parseInt(bookmark.starred);
            updatedBookmark = bookmark;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (bookmark) {
            strictEqual(bookmark.starred, 1, "Liked status did not match");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("unlikedRemoteBookmarkUpdatedLocallyAfterSync", function () {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            var likePromise = WinJS.Promise.as();

            ok(bookmark, "Need a bookmark to work with");

            if (bookmark.starred === 0) {
                return instapaperDB.likeBookmark(bookmark.bookmark_id, true);
            }
            
            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).unstar(bookmark.bookmark_id);
        }).then(function (bookmark) {
            bookmark.starred = parseInt(bookmark.starred);
            updatedBookmark = bookmark;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (bookmark) {
            strictEqual(bookmark.starred, 0, "Liked status did not match");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("remoteTitleAndDescriptionChangesComeDownLocally", function () {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (bookmarks) {
            var bookmark = bookmarks[0];
            ok(bookmark, "Need a bookmark to work with");

            bookmark.title = "updatedTitle" + Date.now();
            bookmark.description = "updatedDescription" + Date.now();

            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).add(bookmark);
        }).then(function (remoteBookmark) {
            updatedBookmark = remoteBookmark;

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (localBookmark) {
            strictEqual(localBookmark.title, updatedBookmark.title, "Incorrect title");
            strictEqual(localBookmark.description, updatedBookmark.description);
        });
    });

    promiseTest("localReadProgressIsPushedUp", function () {
        var instapaperDB;
        var targetProgress = 0.3;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var localBookmark = localBookmarks[0];
            ok(localBookmark, "need a bookmark to work with");

            notStrictEqual(localBookmark.progress, targetProgress, "Progress is already at the target value");

            return instapaperDB.updateReadProgress(localBookmark.bookmark_id, targetProgress);
        }).then(function (progressChanged) {
            updatedBookmark = progressChanged;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return WinJS.Promise.join({
                remoteBookmarks: (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
                localBookmark: instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var bookmark = data.remoteBookmarks.bookmarks.filter(function (remote) {
                return remote.bookmark_id === updatedBookmark.bookmark_id;
            })[0];

            ok(bookmark, "Didn't find the remote bookmark");

            equal(bookmark.progress, updatedBookmark.progress, "Progress was unchanged");
            strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Timestamp for last progress changed was incorrect");
            strictEqual(bookmark.hash, data.localBookmark.hash, "Hash wasn't updated locally");
        });
    });
    
    promiseTest("archivesAreMovedToArchiveFolder", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.pop();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.moveBookmark(targetBookmark.bookmark_id, idb.commonFolderDbIds.archive);
        }).then(function () {
            return getNewSyncEngine().sync();
        }).then(function () {
            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (remoteBookmarks) {
            var remote = remoteBookmarks.bookmarks.filter(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];

            ok(remote, "Bookmark wasn't moved to archive remotely");
            addedRemoteBookmarks.unshift(remote);

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("movesMoveToAppropriateFolder", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.pop();
        var newFolder;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            
            return idb.addFolder({ title: Date.now() });
        }).then(function (addedFolder) {
            newFolder = addedFolder;
            return instapaperDB.moveBookmark(targetBookmark.bookmark_id, newFolder.id);
        }).then(function () {
            return getNewSyncEngine().sync();
        }).then(function () {
            return instapaperDB.getFolderByDbId(newFolder.id);
        }).then(function (folder) {
            newFolder = folder;
            addedRemoteFolders.push(newFolder);

            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: newFolder.folder_id });
        }).then(function (remoteBookmarks) {
            var remote = remoteBookmarks.bookmarks.filter(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];

            ok(remote, "Bookmark wasn't moved to archive remotely");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });
    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();