(function () {
    "use strict";

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperSync Tests";

    var InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    var defaultFolderIds = InstapaperTestUtilities.defaultFolderIds.concat([]);
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    var expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var deleteDb = InstapaperTestUtilities.deleteDb;
    var destroyRemoteAccountData = function (assert) {
        return InstapaperTestUtilities.destroyRemoteData(assert, clientInformation);
    };

    var defaultTestDelay = 250;

    var addedRemoteFolders;

    function setSampleFolders() {
        addedRemoteFolders = [
            { title: "sampleFolder1", },
            { title: "sampleFolder2", },
            { title: "sampleFolder3", },
        ];
    }

    var addedRemoteBookmarks;
    var sourceUrls;

    function resetSourceUrls() {
        sourceUrls = [
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

    resetSourceUrls();

    function getNewSyncEngine() {
        return new Codevoid.Storyvoid.InstapaperSync(clientInformation);
    }

    QUnit.module("InstapaperSync");

    promiseTest("destoryRemoteDataOnStart", destroyRemoteAccountData, defaultTestDelay);
    promiseTest("deleteDbOnStart", deleteDb, defaultTestDelay);

    function addDefaultRemoteFolders(assert) {
        setSampleFolders();
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        var foldersNeedingToBeAdded = [];

        return folders.list().then((remoteFolders) => {
            // Loop through each folder remotely available, and
            // if there is a folder w/ the same name, replace with
            // the remote folder information
            remoteFolders.forEach((folder) => {
                addedRemoteFolders.forEach((expectedFolder, index) => {
                    if (expectedFolder.title === folder.title) {
                        // Replace at index so we get all the info.
                        addedRemoteFolders[index] = folder;
                    }
                });
            });
        }).then(() => {
            return Codevoid.Utilities.serialize(addedRemoteFolders, function (folder, index) {
                if (folder.folder_id !== undefined) {
                    // assume we've already got the info
                    return WinJS.Promise.as();
                }

                return folders.add(folder.title).then(function (remoteFolder) {
                    addedRemoteFolders[index] = remoteFolder;
                });
            });
        }).then(function () {
            assert.ok(true, "Folders added");
        }, (errors) => {
            var foundNonAlreadyThereError = false;
            foundNonAlreadyThereError = errors.some((item) => {
                return (item.error != undefined) && (item.error === 1251);
            });

            assert.ok(!foundNonAlreadyThereError, "Unexpected error when adding folders");
        });
    }

    promiseTest("addDefaultRemoteFolders", addDefaultRemoteFolders, defaultTestDelay);

    function addsFoldersOnFirstSight(assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        return sync.sync({ folders: true }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (folders) {
            assert.ok(folders, "Didn't get folder list");

            assert.strictEqual(folders.length, 7, "Unexpected number of folders");

            folders.forEach(function (folder) {
                switch (folder.folder_id) {
                    case InstapaperDB.CommonFolderIds.Unread:
                    case InstapaperDB.CommonFolderIds.Archive:
                    case InstapaperDB.CommonFolderIds.Liked:
                    case InstapaperDB.CommonFolderIds.Orphaned:
                        return;
                        break;

                    default:
                        break;
                }

                var wasInSyncedSet = addedRemoteFolders.some(function (f) {
                    return f.folder_id === folder.folder_id;
                });

                assert.ok(wasInSyncedSet, "Folder: " + folder.folder_id + ", " + folder.title + " wasn't expected to be found");
            });

            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }

    promiseTest("addsFoldersOnFirstSight", addsFoldersOnFirstSight, defaultTestDelay);

    function differentFolderTitleOnServerIsSyncedToDB(assert) {
        var sync = getNewSyncEngine();
        var targetRemoteFolder = addedRemoteFolders[0];
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.getFolderFromFolderId(targetRemoteFolder.folder_id);
        }).then(function (localFolder) {
            localFolder.title = Date.now() + "a";
            return WinJS.Promise.join({
                updatedFolder: instapaperDB.updateFolder(localFolder),
                timeout: WinJS.Promise.timeout(),
            });
        }).then(function (data) {
            assert.ok(data.updatedFolder, "Didn't get updated folder");
            assert.notStrictEqual(data.updatedFolder.title, targetRemoteFolder.title, "Title didn't change");

            return sync.sync({ folders: true });
        }).then(function () {
            return instapaperDB.getFolderFromFolderId(targetRemoteFolder.folder_id);
        }).then(function (localFolder) {
            assert.strictEqual(localFolder.title, targetRemoteFolder.title, "Title did not correctly sync");
            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }

    promiseTest("differentFolderTitleOnServerIsSyncedToDB", differentFolderTitleOnServerIsSyncedToDB, defaultTestDelay);

    function removedFolderOnServerIsDeletedLocallyOnSync(assert) {
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
                assert.ok(addedFolder, "Didn't get added folder");
                assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                assert.ok(!!addedFolder.id, "Folder didn't have DB id");

                return WinJS.Promise.join([sync.sync({ folders: true }), WinJS.Promise.timeout()]);
            }).then(function () {
                return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            }).then(function (addedFolder) {
                assert.ok(!addedFolder, "Shouldn't have gotten the folder. It should have been removed");

                return expectNoPendingFolderEdits(assert, instapaperDB);
            });
        });
    }

    promiseTest("removedFolderOnServerIsDeletedLocallyOnSync", removedFolderOnServerIsDeletedLocallyOnSync, defaultTestDelay);

    function removedAndAddedFoldersOnServerAreCorrectlySynced(assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var fakeFolder = {
            title: "foo",
            folder_id: "foo_1",
        };

        var newRemoteFolder = {
            title: Date.now() + "a", // now() is an integer. It comes back as a string, Just make it a damn string
        };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                folder: instapaperDB.addFolder(fakeFolder, true),
                timeout: WinJS.Promise.timeout(),
            }).then(function () {
                return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            }).then(function (addedFolder) {
                assert.ok(addedFolder, "Didn't get added folder");
                assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                assert.ok(!!addedFolder.id, "Folder didn't have DB id");

                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

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
                assert.ok(!folders.deleted, "Shouldn't have gotten the folder. It should have been removed");

                assert.ok(folders.added, "Didn't find added folder");
                assert.strictEqual(folders.added.folder_id, newRemoteFolder.folder_id, "Not correct folder ID");
                assert.strictEqual(folders.added.title, newRemoteFolder.title, "Incorrect title");

                return expectNoPendingFolderEdits(assert, instapaperDB);
            });
        });
    }

    promiseTest("removedAndAddedFoldersOnServerAreCorrectlySynced", removedAndAddedFoldersOnServerAreCorrectlySynced, defaultTestDelay);

    promiseTest("pendedAddsAreUploaded", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var newFolder = { title: Date.now() + "a", };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(newFolder);
        }).then(function (addedFolder) {
            assert.ok(!!addedFolder.id, "need folder id to find it later");
            newFolder = addedFolder;

            return sync.sync({ folders: true });
        }).then(function () {
            return (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).list();
        }).then(function (remoteFolders) {
            var localFolderWasSynced = remoteFolders.some(function (item) {
                return item.title === newFolder.title;
            });

            assert.ok(localFolderWasSynced, "Local folder was not found on the server");

            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("foldersGetUpdatedFolderIdsWhenUploaded", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var newFolder = { title: Date.now() + "a", };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder(newFolder);
        }).then(function (addedFolder) {
            assert.ok(!!addedFolder.id);
            assert.strictEqual(addedFolder.folder_id, undefined, "Shouldn't have had a folder id yet.");
            newFolder = addedFolder;

            return instapaperDB.getPendingFolderEdits();
        }).then(function (pendingEdits) {
            assert.strictEqual(pendingEdits.length, 1, "Only expected one pending edit");

            return sync.sync({ folders: true });
        }).then(function () {
            return instapaperDB.getFolderByDbId(newFolder.id);
        }).then(function (syncedFolder) {
            assert.ok(!!syncedFolder.folder_id, "Didn't find a folder ID");
            addedRemoteFolders.push(syncedFolder);
            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("sameFolderRemoteAndLocalButUnsynced", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;

        var local = {
            title: Date.now() + "a",
            cookie: true,
        };

        var remote = { title: local.title }; // make sure the remote is the same

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.addFolder(local),
                remote: (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).add(remote.title),
            }).then(function (data) {
                local = data.local;
                remote = data.remote;

                return sync.sync({ folders: true });
            }).then(function () {
                return expectNoPendingFolderEdits(assert, instapaperDB);
            }).then(function () {
                return instapaperDB.getFolderByDbId(local.id);
            }).then(function (localFolder) {
                assert.ok(localFolder, "Didn't find the local folder");
                assert.strictEqual(localFolder.folder_id, remote.folder_id, "Folder ID didn't match the local folder");
                assert.strictEqual(localFolder.title, remote.title, "Folder title didn't match");
                assert.ok(localFolder.cookie, "Cookie was not present on the DB folder. Data Squashed?");
            });
        });
    }, defaultTestDelay);

    promiseTest("pendedDeletesAreUploaded", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.getFolderFromFolderId(targetFolder.folder_id),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            assert.ok(!!data.local.id, "need folder id to delete");
            assert.ok(data.remoteFolders.some(function (item) {
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
            assert.ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!data.localFolder, "Local folder should be missing");

            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("deletedLocallyAndRemotelySyncsSuccessfully", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.getFolderFromFolderId(targetFolder.folder_id),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            assert.ok(!!data.local.id, "need folder id to delete");
            assert.ok(data.remoteFolders.some(function (item) {
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
            assert.ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!data.localFolder, "Local folder should be missing");

            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("pendedDeletesAndAddsSyncUp", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var targetFolder = addedRemoteFolders.pop();
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var newFolder = { title: Date.now() + "a" };

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                toRemove: idb.getFolderFromFolderId(targetFolder.folder_id),
                toAdd: idb.addFolder(newFolder),
                remoteFolders: folders.list(),
            });
        }).then(function (data) {
            assert.ok(!!data.toRemove.id, "need folder id to delete");
            assert.ok(data.remoteFolders.some(function (item) {
                return item.folder_id === data.toRemove.folder_id;
            }), "Folder to delete wasn't present remotely");

            assert.ok(data.toAdd, "Didn't get added folder");
            assert.ok(data.toAdd.id, "Didn't have an ID");
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
            assert.ok(!data.remoteFolders.some(function (item) {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!data.removed, "Local folder should be missing");

            assert.ok(data.added, "Didn't get added folder. It got lost");
            addedRemoteFolders.push(data.added);

            return expectNoPendingFolderEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    QUnit.module("InstapaperSyncBookmarks");
    promiseTest("destoryRemoteDataBeforeBookmarks", destroyRemoteAccountData, defaultTestDelay);
    promiseTest("deleteDbBeforeBookmarks", deleteDb, defaultTestDelay);
    promiseTest("addDefaultRemoteFoldersBeforeBookmarks", addDefaultRemoteFolders, defaultTestDelay);
    promiseTest("addsFoldersOnFirstSightBeforeBookmarks", addsFoldersOnFirstSight, defaultTestDelay);

    function addDefaultBookmarks(testAssert, neededBookmarks) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var minNumberOfBookmarks = neededBookmarks || 2;
        resetSourceUrls();

        // Get the remote bookmarks so we can add, update, cache etc as needed
        return bookmarks.list({
            folder_id: InstapaperDB.CommonFolderIds.Unread,
        }).then(function (remoteBookmarks) {
            remoteBookmarks = remoteBookmarks.bookmarks;
            // If we have remote bookmarks, we need to remove the urls
            // that they have from the "source" URLs
            if (remoteBookmarks && remoteBookmarks.length) {
                // For the remote urls we have, find any in the local
                // set and remove them from that array.
                remoteBookmarks.forEach(function (rb) {
                    var indexOfExistingUrl = -1;
                    sourceUrls.forEach(function (sb, index) {
                        if (rb.url === sb.url) {
                            indexOfExistingUrl = index;
                        }
                    });

                    if (indexOfExistingUrl !== -1) {
                        sourceUrls.splice(indexOfExistingUrl, 1);
                    }
                });
            }

            // We have enough remote bookmarks to continue.
            if (remoteBookmarks && remoteBookmarks.length >= minNumberOfBookmarks) {
                return remoteBookmarks;
            }

            // We dont have enough remote Bookmarks, so lets add more.
            var needToAdd = minNumberOfBookmarks;
            if (remoteBookmarks && remoteBookmarks.length) {
                needToAdd -= remoteBookmarks.length;
            };

            var adds = [];

            for (var i = 0; i < needToAdd; i++) {
                adds.push(sourceUrls.shift());
            }

            return Codevoid.Utilities.serialize(adds, function (url) {
                return bookmarks.add(url).then(function (added) {
                    remoteBookmarks.push(added);
                });
            }).then(function () {
                return remoteBookmarks;
            });
        }).then(function (currentRemoteBookmarks) {
            testAssert.ok(currentRemoteBookmarks, "Didn't get list of current remote bookmarks");
            addedRemoteBookmarks = currentRemoteBookmarks;
            testAssert.ok(addedRemoteBookmarks, "No remotebookmarks!");
            testAssert.ok(addedRemoteBookmarks.length, "No remote bookmarks!");

            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then((result) => {
            // Reset all remote likes.
            return Codevoid.Utilities.serialize(result.bookmarks, (item) => {
                return bookmarks.unstar(item.bookmark_id);
            });
        });
    };

    promiseTest("addDefaultBookmarks", addDefaultBookmarks, defaultTestDelay);

    promiseTest("bookmarksAddedOnFirstSight", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;


        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (data) {
            return sync.sync({ bookmarks: true });
        }).then(function (idb) {

            return WinJS.Promise.join({
                local: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
            });
        }).then(function (data) {
            var bookmarks = data.local;
            var expectedBookmarks = data.remote.bookmarks;

            assert.ok(bookmarks, "Didn't get any bookmarks");
            assert.strictEqual(bookmarks.length, addedRemoteBookmarks.length, "Didn't get enough bookmarks");

            // Check all the bookmarks are correctly present.
            assert.ok(expectedBookmarks.length, "Should have added some test pages to check");

            var allInUnread = bookmarks.every(function (item) {
                var expectedBookmarkIndex = -1;
                expectedBookmarks.forEach(function (bookmark, index) {
                    if (bookmark.url === item.url) {
                        expectedBookmarkIndex = index;
                    }
                });

                if (expectedBookmarkIndex !== -1) {
                    expectedBookmarks.splice(expectedBookmarkIndex, 1);
                }

                return item.folder_dbid === instapaperDB.commonFolderDbIds.unread;
            });

            assert.ok(allInUnread, "Some of the sync'd bookmarks were not in the unread folder");
            assert.strictEqual(expectedBookmarks.length, 0, "Some bookmarks were not found");

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

                assert.ok(local, "Didn't find the URL locally. Should have done");

                assert.strictEqual(local.bookmark_id, b.bookmark_id, "Bookmark ID's didn't match");
                assert.strictEqual(local.title, b.title, "Title's didn't match");
                assert.strictEqual(local.hash, b.hash, "Hash didn't match");
            });

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });

    }, defaultTestDelay);

    promiseTest("syncingOnlyFoldersOnlySyncsFolders", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var addedFolderName = Date.now() + "a";
        var addedFolder;
        var currentBookmarkCount;
        var currentFolderCount;

        var f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return WinJS.Promise.join({
            folderAdd: f.add(addedFolderName),
            bookmarkAdd: b.add(sourceUrls.shift()),
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
            assert.strictEqual(data.folders.length, currentFolderCount + 1, "Incorrect number of folders");

            assert.ok(data.folders.some(function (folder) {
                return folder.title === addedFolderName;
            }), "Didn't find the added folder locally");

            assert.strictEqual(data.bookmarks.length, currentBookmarkCount, "Incorrect number of bookmarks");

            return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
        }).then(function (folder) {
            addedRemoteFolders.push(folder);
        });
    }, defaultTestDelay);

    promiseTest("syncingOnlyBookmarksOnlySyncsBookmarks", function (assert) {
        var sync = getNewSyncEngine();
        var instapaperDB;
        var currentBookmarkCount;
        var currentFolderCount;
        var addedFolderName = Date.now() + "a";
        var addedFolder;

        var f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

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
            assert.strictEqual(data.folders.length, currentFolderCount, "Incorrect number of folders");
            assert.strictEqual(data.bookmarks.length, currentBookmarkCount + 1, "Incorrect number of bookmarks");

            assert.ok(data.bookmarks.some(function (bookmark) {
                return bookmark.url === addedRemoteBookmarks[addedRemoteBookmarks.length - 1].url;
            }), "Didn't find the expected bookmark");

            return sync.sync();
        }).then(function () {
            return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
        }).then(function (folder) {
            addedRemoteFolders.push(folder);
        });
    }, defaultTestDelay);

    promiseTest("locallyAddedBookmarksGoUpToUnread", function (assert) {
        var instapaperDB;
        var targetUrl = sourceUrls.shift().url;
        var targetTitle = Date.now() + "a";

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.addUrl({ url: targetUrl, title: targetTitle });
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return WinJS.Promise.join({
                remoteBookmarks: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
                localBookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
            });
        }).then(function (data) {
            var rb = data.remoteBookmarks;
            var lb = data.localBookmarks;

            var remoteBookmark = rb.bookmarks.filter(function (f) {
                return f.url === targetUrl;
            })[0];

            assert.ok(remoteBookmark, "Didn't find the remote bookmark added");
            assert.strictEqual(remoteBookmark.title, targetTitle, "Remote title was incorrect");

            var addedBookmark = lb.filter(function (f) {
                return f.url === targetUrl;
            })[0];

            assert.ok(addedBookmark, "Didn't see the added folder locally");
            assert.strictEqual(addedBookmark.title, targetTitle, "Local title was incorrect");

            addedRemoteBookmarks.push(addedBookmark);

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("syncingBookmarkThatIsAlreadyAvailableRemotelyDoesntDuplicate", function (assert) {
        var instapaperDB;
        var targetBookmark;
        var targetTitle = Date.now() + "a";
        var localBookmarkCountBeforeSync;
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (current) {
            targetBookmark = current.shift();

            return WinJS.Promise.join({
                added: instapaperDB.addUrl({ url: targetBookmark.url, title: targetTitle }),
                localBookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
            });
        }).then(function (data) {
            localBookmarkCountBeforeSync = data.localBookmarks.length;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
        }).then(function (lb) {
            assert.strictEqual(lb.length, localBookmarkCountBeforeSync, "Didn't expect any change in the bookmark counts");
            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("remoteProgressChangesAreCorrectlySyncedLocally", function (assert) {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            assert.notStrictEqual(bookmark.progress, 0.5, "Progress is already where we're going to set it");
            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).updateReadProgress({
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
            assert.equal(bookmark.progress, updatedBookmark.progress, "Progress did not match");
            assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Wrong bookmark timestamp");
            assert.strictEqual(bookmark.hash, updatedBookmark.hash, "hashes were incorrrect");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("likedRemoteBookmarkUpdatedLocallyAfterSync", function (assert) {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            assert.notStrictEqual(bookmark.starred, 1, "Bookmark was already liked. We need  it to not be");

            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).star(bookmark.bookmark_id);
        }).then(function (bookmark) {
            bookmark.starred = parseInt(bookmark.starred);
            updatedBookmark = bookmark;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (bookmark) {
            assert.strictEqual(bookmark.starred, 1, "Liked status did not match");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("unlikedRemoteBookmarkUpdatedLocallyAfterSync", function (assert) {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var bookmark = localBookmarks[0];
            var likePromise = WinJS.Promise.as();

            assert.ok(bookmark, "Need a bookmark to work with");

            if (bookmark.starred === 0) {
                return instapaperDB.likeBookmark(bookmark.bookmark_id, true).then(function () {
                    return WinJS.Promise.timeout();
                });
            }

            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).unstar(bookmark.bookmark_id);
        }).then(function (bookmark) {
            bookmark.starred = parseInt(bookmark.starred);
            updatedBookmark = bookmark;
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (bookmark) {
            assert.strictEqual(bookmark.starred, 0, "Liked status did not match");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("localLikesAreSyncedToService", function (assert) {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return WinJS.Promise.join({
                local: idb.likeBookmark(targetBookmark.bookmark_id),
                remoteLikes: bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked }),
            });
        }).then(function (data) {
            addedRemoteBookmarks.push(data.local);

            var likedAlready = data.remoteLikes.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            assert.ok(!likedAlready, "Bookmark was already liked on the service");

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (data) {
            var likedRemotely = data.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            assert.ok(likedRemotely, "Item was not liked on the server");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("localunlikesAreSyncedToService", function (assert) {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.pop();
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            var setupData = WinJS.Promise.as();
            if (targetBookmark.starred === 0) {
                setupData = WinJS.Promise.join({
                    local: idb.likeBookmark(targetBookmark.bookmark_id, true),
                    remote: bookmarks.star(targetBookmark.bookmark_id),
                });
            }

            return setupData.then(function () {
                return WinJS.Promise.join({
                    local: idb.unlikeBookmark(targetBookmark.bookmark_id),
                    remoteLikes: bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked }),
                });
            });
        }).then(function (data) {
            addedRemoteBookmarks.push(data.local);

            var likedAlready = data.remoteLikes.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            assert.ok(likedAlready, "Bookmark wasnt already liked on the service");

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (data) {
            var likedRemotely = data.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            assert.ok(!likedRemotely, "Item was liked on the server");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("remoteTitleAndDescriptionChangesComeDownLocally", function (assert) {
        var instapaperDB;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (bookmarks) {
            var bookmark = bookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            bookmark.title = "updatedTitle" + Date.now();
            bookmark.description = "updatedDescription" + Date.now();
            assert.ok(true, "Title: " + bookmark.title);

            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).add(bookmark);
        }).then(function (remoteBookmark) {
            updatedBookmark = remoteBookmark;

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
        }).then(function (localBookmark) {
            assert.strictEqual(localBookmark.title, updatedBookmark.title, "Incorrect title");
            assert.strictEqual(localBookmark.description, updatedBookmark.description);
        });
    }, defaultTestDelay);

    promiseTest("localReadProgressIsPushedUp", function (assert) {
        var instapaperDB;
        var targetProgress = Math.round(Math.random() * 100) / 100;
        var updatedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            var localBookmark = localBookmarks[0];
            assert.ok(localBookmark, "need a bookmark to work with");

            assert.notStrictEqual(localBookmark.progress, targetProgress, "Progress is already at the target value");

            return instapaperDB.updateReadProgress(localBookmark.bookmark_id, targetProgress);
        }).then(function (progressChanged) {
            updatedBookmark = progressChanged;
            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread });
        }).then(function() {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return WinJS.Promise.join({
                remoteBookmarks: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
                localBookmark: instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var bookmark = data.remoteBookmarks.bookmarks.filter(function (remote) {
                return remote.bookmark_id === updatedBookmark.bookmark_id;
            })[0];

            assert.ok(bookmark, "Didn't find the remote bookmark");

            assert.equal(bookmark.progress, updatedBookmark.progress, "Progress was unchanged");
            assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Timestamp for last progress changed was incorrect");
            assert.strictEqual(bookmark.hash, data.localBookmark.hash, "Hash wasn't updated locally");
        });
    }, defaultTestDelay);

    promiseTest("archivesAreMovedToArchiveFolder", function (assert) {
        var instapaperDB;
        var targetBookmark = {};
        targetBookmark = addedRemoteBookmarks.shift();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.moveBookmark(targetBookmark.bookmark_id, idb.commonFolderDbIds.archive);
        }).then(function () {
            return getNewSyncEngine().sync();
        }).then(function () {
            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (remoteBookmarks) {
            var remote = remoteBookmarks.bookmarks.filter(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];

            assert.ok(remote, "Bookmark wasn't moved to archive remotely");
            addedRemoteBookmarks.push(remote);

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("movesMoveToAppropriateFolder", function (assert) {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();
        var newFolder;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.addFolder({ title: Date.now() + "a" });
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

            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: newFolder.folder_id });
        }).then(function (remoteBookmarks) {
            var remote = remoteBookmarks.bookmarks.filter(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];

            addedRemoteBookmarks.push(remote);

            assert.ok(remote, "Bookmark wasn't moved to archive remotely");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    promiseTest("localDeletesGoUpToTheServer", function (assert) {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.removeBookmark(targetBookmark.bookmark_id);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread });
        }).then(function (data) {
            var bookmarkFoundRemotely = data.bookmarks.some(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            });

            assert.ok(!bookmarkFoundRemotely, "Found the bookmark remotely. It should have been deleted");
            sourceUrls.push({ url: targetBookmark.url });

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    QUnit.module("InstapaperSyncLimits");

    promiseTest("deleteLocalDBBeforeSyncingWithLimits", deleteDb, defaultTestDelay);
    promiseTest("addEnoughRemoteBookmarks", addDefaultBookmarks);

    promiseTest("syncRespectsLimits", function (assert) {
        var sync = getNewSyncEngine();
        sync.perFolderBookmarkLimits = {};
        sync.defaultBookmarkLimit = 1;

        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread }).then(function (rb) {
            assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.length);

            return sync.sync();
        }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
        });
    }, defaultTestDelay);

    promiseTest("syncingOnlyOneBookmarkWithOneLikeNotInOneBookmarkBoundaryDoesn'tFailSync", function (assert) {
        var sync = getNewSyncEngine();
        sync.perFolderBookmarkLimits = {};
        sync.defaultBookmarkLimit = 1;

        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread }).then(function (rb) {
            assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.length);

            var lastBookmark = rb.bookmarks[rb.bookmarks.length - 1];

            return bookmarks.star(lastBookmark.bookmark_id);
        }).then(function() {
            return sync.sync();
        }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (localBookmarks) {
            assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
            assert.strictEqual(localBookmarks[0].starred, 0, "Didn't expect it to be starred");
        });
    }, defaultTestDelay);

    // We need to clean up before we futz with more limits
    promiseTest("deleteLocalDBBeforeSyncingWithLimits", deleteDb, defaultTestDelay);
    promiseTest("addEnoughRemoteBookmarks", (assert) => addDefaultBookmarks(assert, 8), defaultTestDelay);
    promiseTest("addDefaultRemoteFolders", addDefaultRemoteFolders, defaultTestDelay);

    promiseTest("perFolderLimitsOnBookmarksAreApplied", (assert) => {
        var sync = getNewSyncEngine();
        sync.defaultBookmarkLimit = 1;
        var remoteFolder1 = addedRemoteFolders[0].folder_id;
        var remoteFolder2 = addedRemoteFolders[1].folder_id;

        var folderSyncLimits = {};
        folderSyncLimits[InstapaperDB.CommonFolderIds.Liked] = 2;
        folderSyncLimits[remoteFolder1] = 2;
        folderSyncLimits[remoteFolder2] = 2;

        sync.perFolderBookmarkLimits = folderSyncLimits;

        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread }).then(function (rb) {
            assert.ok(rb.bookmarks.length >= 8, "Not enough Bookmarks remotely: " + rb.length);

            var itemsInSampleFolder1 = [];
            itemsInSampleFolder1.push(rb.bookmarks[0].bookmark_id);
            itemsInSampleFolder1.push(rb.bookmarks[1].bookmark_id);
            itemsInSampleFolder1.push(rb.bookmarks[2].bookmark_id);

            var itemsInSampleFolder2 = [];
            itemsInSampleFolder2.push(rb.bookmarks[3].bookmark_id);
            itemsInSampleFolder2.push(rb.bookmarks[4].bookmark_id);
            itemsInSampleFolder2.push(rb.bookmarks[5].bookmark_id);

            var moves = Codevoid.Utilities.serialize(itemsInSampleFolder1, (item) => {
                return bookmarks.move({ bookmark_id: item, destination: remoteFolder1 });
            });

            var moves2 = Codevoid.Utilities.serialize(itemsInSampleFolder2, (item) => {
                return bookmarks.move({ bookmark_id: item, destination: remoteFolder2 });
            });

            return WinJS.Promise.join([moves, moves2]);
        }).then(function () {
            return sync.sync();
        }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            return WinJS.Promise.join({
                unread: idb.listCurrentBookmarks(idb.commonFolderDbIds.unread),
                folder1: idb.listCurrentFolders().then((folders) => {
                    folders = folders.filter((folder) => {
                        return folder.folder_id === remoteFolder1;
                    });

                    return idb.listCurrentBookmarks(folders[0].id);
                }),
                folder2: idb.listCurrentFolders().then((folders) => {
                    folders = folders.filter((folder) => {
                        return folder.folder_id === remoteFolder2;
                    });

                    return idb.listCurrentBookmarks(folders[0].id);
                }),
            });
        }).then(function (result) {
            assert.strictEqual(result.unread.length, 1, "Only expected on bookmark");
            assert.strictEqual(result.folder1.length, 2, "Only expected two out of three bookmarks synced");
            assert.strictEqual(result.folder2.length, 2, "Only expected two out of three bookmarks synced");
        });
    });

    QUnit.module("InstapaperSyncBookmarkDeletes");

    promiseTest("resetRemoteDataBeforePerformingDeletes", destroyRemoteAccountData, defaultTestDelay);
    promiseTest("ensureHaveEnoughRemotebookmarks", addDefaultBookmarks, defaultTestDelay);
    promiseTest("deleteLocalDbBeforeDeletes", deleteDb, defaultTestDelay);

    function addLocalOnlyFakeBookmark(idb) {
        var fakeBookmarkToAdd = {
            bookmark_id: Date.now(),
            url: "http://notreal.com",
            title: "Test",
            folder_id: InstapaperDB.CommonFolderIds.Unread,
            folder_dbid: idb.commonFolderDbIds.unread,
        };

        return idb.addBookmark(fakeBookmarkToAdd);
    }

    promiseTest("syncDefaultState", function (assert) {
        return getNewSyncEngine().sync().then(function () {
            assert.ok(true, "sync complete");
        });
    }, defaultTestDelay);

    // State:
    //   No Folders
    //   Minimum of two bookmarks in unread
    //   No other bookmarks

    promiseTest("remoteDeletesAreRemovedLocally", function (assert) {
        var instapaperDB;
        var fakeAddedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return addLocalOnlyFakeBookmark(idb);
        }).then(function (added) {
            fakeAddedBookmark = added;

            return getNewSyncEngine().sync({ bookmarks: true, folders: false, skipOrphanCleanup: true });
        }).then(function () {
            return WinJS.Promise.join({
                bookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                bookmark1: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var bookmark1NoLongerInUnread = data.bookmarks.some(function (bookmark) {
                return bookmark.bookmark_id === fakeAddedBookmark.bookmark_id;
            });
            assert.ok(!bookmark1NoLongerInUnread, "Bookmark was still found in unread");

            assert.strictEqual(data.bookmark1.folder_dbid, instapaperDB.commonFolderDbIds.orphaned, "Bookmark 1 not in orphaned folder");
            assert.strictEqual(data.bookmark1.folder_id, InstapaperDB.CommonFolderIds.Orphaned, "Bookmark 1 not in orphaned folder");

            return WinJS.Promise.join({
                orphaned: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned),
                bookmark1: data.bookmark1,
            });
        }).then(function (data) {
            var bookmark1Present = data.orphaned.some(function (item) {
                return item.bookmark_id === data.bookmark1.bookmark_id;
            });

            assert.ok(bookmark1Present, "Bookmark 1 wasn't present in the orphaned folder");

            return instapaperDB.removeBookmark(data.bookmark1.bookmark_id, true);
        }).then(function () {
            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });

    }, defaultTestDelay);

    // State:
    //   No Folders
    //   Minimum of two bookmarks in unread
    //   No other bookmarks

    promiseTest("alreadyDeletedBookmarkDoesntFailSync", function (assert) {
        var instapaperDB;
        var fakeAddedBookmark;
        var bookmarkToUpdateProgressFor;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return addLocalOnlyFakeBookmark(idb);
        }).then(function (added) {
            fakeAddedBookmark = added;

            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
        }).then(function (currentBookmarks) {
            currentBookmarks = currentBookmarks.filter(function (b) {
                return b.bookmark_id !== fakeAddedBookmark.bookmark_id;
            });

            assert.ok(currentBookmarks.length, "not enough bookmarks: " + currentBookmarks.length);

            bookmarkToUpdateProgressFor = currentBookmarks[0];

            return WinJS.Promise.join({
                update: instapaperDB.updateReadProgress(bookmarkToUpdateProgressFor.bookmark_id, 0.2),
                deleteBookmark: instapaperDB.removeBookmark(fakeAddedBookmark.bookmark_id),
            });
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
                removedLocally: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var remoteBookmark = data.remote.bookmarks.filter(function (b) {
                return b.bookmark_id === bookmarkToUpdateProgressFor.bookmark_id;
            })[0];

            assert.ok(remoteBookmark, "didn't find bookmark");
            assert.strictEqual(parseFloat(remoteBookmark.progress), 0.2, "Progress was incorrect");

            assert.ok(!data.removedLocally, "Didn't expect to be able to find the bookmark locally");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    // State:
    //   No Folders
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.2 progress
    //   No other bookmarks

    promiseTest("alreadyDeletedBookmarkWithPendingLikeDoesntFailSync", function (assert) {
        var instapaperDB;
        var fakeAddedBookmark;
        var updatedBookmarkId;
        var progressValue = 0.3;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            assert.ok(currentBookmarks.length, "not enough bookmarks");

            updatedBookmarkId = currentBookmarks[0].bookmark_id;

            return WinJS.Promise.join({
                update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                add: addLocalOnlyFakeBookmark(instapaperDB),
            });
        }).then(function (data) {
            fakeAddedBookmark = data.add;

            return instapaperDB.likeBookmark(fakeAddedBookmark.bookmark_id);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var remote = data.remote.bookmarks.filter(function (b) {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "Didn't find remote bookmark");
            assert.strictEqual(parseFloat(remote.progress), progressValue, "Incorrect progress value");

            assert.ok(!data.local, "Shouldn't have been able to find local fake bookmark");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    // State:
    //   No Folders
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.3 progress
    //   No other bookmarks

    promiseTest("alreadyDeletedBookmarkWithPendingUnlikeDoesntFailSync", function (assert) {
        var instapaperDB;
        var fakeAddedBookmark;
        var updatedBookmarkId;
        var progressValue = 0.4;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            assert.ok(currentBookmarks.length, "not enough bookmarks");

            updatedBookmarkId = currentBookmarks[0].bookmark_id;

            return WinJS.Promise.join({
                update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                add: addLocalOnlyFakeBookmark(instapaperDB),
            });
        }).then(function (data) {
            fakeAddedBookmark = data.add;

            return instapaperDB.unlikeBookmark(fakeAddedBookmark.bookmark_id);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var remote = data.remote.bookmarks.filter(function (b) {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "Didn't find remote bookmark");
            assert.strictEqual(parseFloat(remote.progress), progressValue, "Incorrect progress value");

            assert.ok(!data.local, "Shouldn't have been able to find local fake bookmark");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    // State:
    //   No Folders
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.4 progress
    //   No other bookmarks

    promiseTest("alreadyDeletedBookmarkWithPendingMoveDoesntFailSync", function (assert) {
        var instapaperDB;
        var progressValue = 0.5;
        var updatedBookmarkId;
        var fakeAddedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder({ title: Date.now() + "a" });
        }).then(function () {
            return getNewSyncEngine().sync({ folders: true });
        }).then(function() {
            return instapaperDB.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

            updatedBookmarkId = currentBookmarks[0].bookmark_id;

            return WinJS.Promise.join({
                update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                folders: instapaperDB.listCurrentFolders(),
                added: addLocalOnlyFakeBookmark(instapaperDB),
            });
        }).then(function (data) {
            fakeAddedBookmark = data.added;
            var currentFolders = data.folders.filter(function (f) {
                return defaultFolderIds.indexOf(f.folder_id) === -1;
            });

            return instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, currentFolders[0].id);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var remote = data.remote.bookmarks.filter(function (b) {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "didn't find updated remote bookmark");
            assert.strictEqual(parseFloat(remote.progress), progressValue, "Progress value was in correct");

            assert.ok(!data.local, "Didn't expect to find the bookmark locally");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    // State:
    //   One Folders
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.5 progress
    //   No other bookmarks

    promiseTest("alreadyDeletedBookmarkWithPendingArchiveDoesntFailSync", function (assert) {
        var instapaperDB;
        var progressValue = 0.5;
        var updatedBookmarkId;
        var fakeAddedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks();
        }).then(function (currentBookmarks) {
            assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

            updatedBookmarkId = currentBookmarks[0].bookmark_id;

            return WinJS.Promise.join({
                update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                added: addLocalOnlyFakeBookmark(instapaperDB),
            });
        }).then(function (data) {
            fakeAddedBookmark = data.added;

            return instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            });
        }).then(function (data) {
            var remote = data.remote.bookmarks.filter(function (b) {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "didn't find updated remote bookmark");
            assert.strictEqual(parseFloat(remote.progress), progressValue, "Progress value was in correct");

            assert.ok(!data.local, "Didn't expect to find the bookmark locally");

            return expectNoPendingBookmarkEdits(assert, instapaperDB);
        });
    }, defaultTestDelay);

    // State:
    //   One Folder
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.5 progress
    //   No other bookmarks

    promiseTest("deletedFolderWithPendingMoveDoesntFailSyncNotSyncingFolders", function (assert) {
        var instapaperDB;
        var movedBookmark;
        var fakeFolder;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                folder: idb.addFolder({
                    title: Date.now() + "a",
                    folder_id: 345234,
                }, true),
                bookmarks: idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            var bookmarks = data.bookmarks;
            assert.ok(bookmarks.length, "need some bookmarks to work with");

            movedBookmark = bookmarks[0];
            fakeFolder = data.folder;

            return instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id).then(function () {
                return instapaperDB.listCurrentBookmarks(fakeFolder.id);
            });
        }).then(function (data) {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return WinJS.Promise.join({
                bookmark: instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                folder: instapaperDB.getFolderByDbId(fakeFolder.id),
            });
        }).then(function (data) {
            assert.ok(data.bookmark, "Expected to get bookmark");
            assert.strictEqual(data.bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");

            assert.notStrictEqual(data.bookmark.folder_id, InstapaperDB.CommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
            assert.notStrictEqual(data.bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");
        });
    }, defaultTestDelay);

    // State:
    //   One Folder
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.5 progress
    //   No other bookmarks

    promiseTest("deletedFolderWithPendingMoveDoesntFailSync", function (assert) {
        var instapaperDB;
        var movedBookmark;
        var fakeFolder;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                folder: idb.addFolder({
                    title: Date.now() + "a",
                    folder_id: Date.now() + "",
                }, true),
                bookmarks: idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            var bookmarks = data.bookmarks;
            assert.ok(bookmarks.length, "need some bookmarks to work with");

            movedBookmark = bookmarks[0];
            fakeFolder = data.folder;

            return instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id);
        }).then(function () {
            return getNewSyncEngine().sync();
        }).then(function () {
            return WinJS.Promise.join({
                bookmark: instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                folder: instapaperDB.getFolderByDbId(fakeFolder.id),
            });
        }).then(function (data) {
            assert.ok(data.bookmark, "Expected to get bookmark");
            assert.strictEqual(data.bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");

            assert.notStrictEqual(data.bookmark.folder_id, InstapaperDB.CommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
            assert.notStrictEqual(data.bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");

            assert.ok(!data.folder, "Didn't expect to find the folder");
        });
    }, defaultTestDelay);

    // State:
    //   One Folder
    //   Minimum of two bookmarks in unread
    //   One bookmark with 0.5 progress
    //   No other bookmarks

    promiseTest("deletedRemoteFolderCleansupState", function (assert) {
        var instapaperDB;
        var fakeFolder;
        var movedOutOfFakeFolderBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;


            return WinJS.Promise.join({
                folder: idb.addFolder({
                    folder_id: 132456,
                    title: Date.now() + "a",
                }, true),
                bookmarks: idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            fakeFolder = data.folder;

            assert.ok(data.bookmarks.length > 1, "not enough bookmarks");

            movedOutOfFakeFolderBookmark = data.bookmarks.pop();

            // Move the bookmark into the fake destination folder
            return instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, fakeFolder.id, true);
        }).then(function () {
            // Create a pending edit to move it back to unread
            return instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, instapaperDB.commonFolderDbIds.unread);
        }).then(function () {
            return getNewSyncEngine().sync();
        }).then(function () {
            return WinJS.Promise.join({
                bookmark: instapaperDB.getBookmarkByBookmarkId(movedOutOfFakeFolderBookmark.bookmark_id),
                folder: instapaperDB.getFolderByDbId(fakeFolder.id),
            });
        }).then(function (data) {
            assert.ok(data.bookmark, "Didn't get bookmark");
            assert.strictEqual(data.bookmark.bookmark_id, movedOutOfFakeFolderBookmark.bookmark_id, "Wrong bookmark");

            assert.strictEqual(data.bookmark.folder_id, InstapaperDB.CommonFolderIds.Unread, "Should be in unread folder");

            assert.ok(!data.folder, "Didn't expect to find the folder");
        });
    }, defaultTestDelay);

    QUnit.module("InstapaperSyncMultipleBookmarkFolders");

    promiseTest("destroyRemoteData", destroyRemoteAccountData, defaultTestDelay);
    promiseTest("addEnoughRemoteBookmarks", addDefaultBookmarks, defaultTestDelay);
    promiseTest("deleteDb", deleteDb, defaultTestDelay);

    promiseTest("sprinkleBookmarksAcrossTwoNonDefaultFolders", function (assert) {
        var instapaperDB;
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        // First we need to set up some remote data for multiple folder edits.
        // This really means moving some bookmarks into specific, known folders,
        // and then pending some edits locally to go up, come down etc

        // Add some folders to work with.
        return Codevoid.Utilities.serialize([
            Date.now() + "a",
            (Date.now() + 10) + "a",
        ], function (item) {
            return folders.add(item);
        }).then(function () {
            // Get the remote data, so we can manipulate it.
            return WinJS.Promise.join({
                folders: folders.list(),
                bookmarks: bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
            });
        }).then(function (data) {
            var bookmarkData = data.bookmarks.bookmarks;
            var folders = data.folders;

            assert.ok(bookmarkData.length > 1, "Not enough bookmarks");
            assert.ok(folders.length > 1, "Not enough folders");

            return Codevoid.Utilities.serialize([
                { bookmark_id: bookmarkData[0].bookmark_id, destination: folders[0].folder_id },
                { bookmark_id: bookmarkData[1].bookmark_id, destination: folders[1].folder_id },
            ], function (item) {
                return bookmarks.move(item);
            });
        });
    }, defaultTestDelay);
    
    // Remote State:
    //   Two Folders
    //   One bookmark in each folder minimum
    // Local State:
    //   Empty

    promiseTest("syncsDownAllBookmarksInAllFolders", function (assert) {
        var instapaperDB;
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        var syncEngine = getNewSyncEngine();
        var startCount = 0;
        var endCount = 0;
        var foldersStarted = 0;
        var foldersEnded = 0;
        var foldersSynced = 0;
        var bookmarksStarted = 0;
        var bookmarksEnded = 0;
        var unknown = 0;

        syncEngine.addEventListener("syncstatusupdate", function (e) {
            var detail = e.detail;
            switch (detail.operation) {
                case Codevoid.Storyvoid.InstapaperSync.Operation.start:
                    startCount++;
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.end:
                    endCount++;
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.foldersStart:
                    foldersStarted++;
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.foldersEnd:
                    foldersEnded++;
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.folder:
                    if (detail.title) {
                        foldersSynced++;
                    }
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksStart:
                    bookmarksStarted++;
                    break;

                case Codevoid.Storyvoid.InstapaperSync.Operation.bookmarksEnd:
                    bookmarksEnded++;
                    break;

                default:
                    unknown = 0;
                    break;
            }
        });
        
        return syncEngine.sync().then(function () {
            assert.strictEqual(unknown, 0, "Unexpected Unknown count");
            assert.strictEqual(startCount, 1, "Unexpected Start count");
            assert.strictEqual(endCount, 1, "Unexpected End count");
            assert.strictEqual(startCount, 1, "Unexpected Start count");
            assert.strictEqual(foldersStarted, 1, "Wrong number of folders started");
            assert.strictEqual(foldersEnded, 1, "Wrong number of folders ended");
            assert.strictEqual(foldersSynced, 2, "Wrong number of folders");
            assert.strictEqual(bookmarksStarted, 1, "Unexpected bookmarks started");
            assert.strictEqual(bookmarksEnded, 1, "Unexpected bookmarks ended");

            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (currentFolders) {
            var folders = currentFolders.filter(function (folder) {
                return (defaultFolderIds.indexOf(folder.folder_id) === -1);
            });

            assert.strictEqual(folders.length, 2, "Incorrect folders");

            return Codevoid.Utilities.serialize(folders, function (folder) {
                return WinJS.Promise.join({
                    remoteBookmarks: bookmarks.list({ folder_id: folder.folder_id }),
                    localBookmarks: instapaperDB.listCurrentBookmarks(folder.id),
                }).then(function (data) {
                    var remoteBookmarks = data.remoteBookmarks.bookmarks;
                    var localBookmarks = data.localBookmarks;

                    remoteBookmarks.forEach(function (rb) {
                        var localBookmarkIndex = -1;
                        var isFoundLocally = localBookmarks.some(function (lb, index) {

                            if ((lb.bookmark_id === rb.bookmark_id)
                            && (lb.folder_id === folder.folder_id)){
                                localBookmarkIndex = index;
                                return true;
                            }

                            return false;
                        });

                        if (isFoundLocally) {
                            localBookmarks.splice(localBookmarkIndex, 1);
                        }

                        assert.ok(isFoundLocally, "Didn't find the bookmark locally");
                    });

                    assert.strictEqual(localBookmarks.length, 0, "All local bookmarks should have been removed");
                });
            });
        });
    }, defaultTestDelay);

    // Remote State:
    //   Two Folders
    //   One bookmark in each folder
    // Local State:
    //   Two Folders
    //   One Bookmark in each folder

    promiseTest("syncsMovesUpFromAllFolders", function (assert) {
        var instapaperDB;
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var bookmarkToMoveToUnread;
        var bookmarkToMoveToFolderA;
        var folderAFolderId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentFolders();
        }).then(function (folders) {
            var folders = folders.filter(function (folder) {
                return (defaultFolderIds.indexOf(folder.folder_id) === -1);
            });

            folderAFolderId = folders[0].folder_id;

            return WinJS.Promise.join({
                folderA: instapaperDB.listCurrentBookmarks(folders[0].id),
                folderB: instapaperDB.listCurrentBookmarks(folders[1].id),
            });
        }).then(function (data) {
            bookmarkToMoveToUnread = data.folderA[0];
            bookmarkToMoveToFolderA = data.folderB[0];

            return WinJS.Promise.join({
                moveToUnread: instapaperDB.moveBookmark(bookmarkToMoveToUnread.bookmark_id, instapaperDB.commonFolderDbIds.unread),
                moveToFolderA: instapaperDB.moveBookmark(bookmarkToMoveToFolderA.bookmark_id, bookmarkToMoveToUnread.folder_dbid),
            });
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return Codevoid.Utilities.serialize([
                "",
                folderAFolderId,
            ], function (folder_id) {
                var param;
                if (folder_id) {
                    param = { folder_id: folder_id };
                }

                return bookmarks.list(param);
            });
        }).then(function (data) {
            var unreadBookmarks = data[0].bookmarks;
            var folderABookmarks = data[1].bookmarks;

            assert.notStrictEqual(unreadBookmarks.length, 0, "Only expected one bookmark in unread");
            assert.notStrictEqual(folderABookmarks.length, 0, "Only expected one bookmark in folderA");

            assert.strictEqual(unreadBookmarks[0].bookmark_id, bookmarkToMoveToUnread.bookmark_id, "Bookmark wasn't found in unread folder");
            assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Bookmark wasn't found in folder A");
        }).then(function (data) {
            return WinJS.Promise.join({
                unread: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                folderA: instapaperDB.listCurrentBookmarks(bookmarkToMoveToUnread.folder_dbid),
            });
        }).then(function (data) {
            var unreadBookmarks = data.unread;
            var folderABookmarks = data.folderA;

            assert.ok(unreadBookmarks, "no unread bookmarks");
            assert.notStrictEqual(unreadBookmarks.length, 0, "Incorrect number of unread bookmarks");
            assert.ok(unreadBookmarks.some(function (b) {
                return b.bookmark_id === bookmarkToMoveToUnread.bookmark_id;
            }), "Moved Bookmark not found");
            
            assert.ok(folderABookmarks, "No folderA bookmarks");
            assert.notStrictEqual(folderABookmarks.length, 0, "Incorrect number of folder A bookmarks");
            assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Incorrect bookmark");
        });
    }, defaultTestDelay);

    // Remote & Local State:
    //   Two Folders
    //   One Unread Bookmark
    //   One Bookmark in a folder
    //   One Emptpy folder

    promiseTest("syncMovesIntoArchiveAndProgressIsUpdated", function (assert) {
        var instapaperDB;
        var archivedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (bookmarks) {
            archivedBookmark = bookmarks[0];

            return instapaperDB.moveBookmark(archivedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(archivedBookmark.bookmark_id);
        }).then(function (bookmark) {
            return instapaperDB.updateReadProgress(bookmark.bookmark_id, 0.43);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (remoteBookmarks) {
            var inArchive = remoteBookmarks.bookmarks.filter(function(b) {
                return b.bookmark_id === archivedBookmark.bookmark_id;
            })[0];

            assert.ok(inArchive);
            assert.strictEqual(parseFloat(inArchive.progress), 0.43, "Progress in correct");
        });
    }, defaultTestDelay);

    // State:
    //   Two Folders
    //   Bookmark in archive w/ non-zero progress
    //   One bookmark in a folder
    //   One Empty Folder

    promiseTest("syncingOnlyOneFolderDoesntEffectOthers", function (assert) {
        var instapaperDB;
        var folderDbIdToSync;
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            // Find the bookmark in a non default folder
            return idb.listCurrentBookmarks();
        }).then(function (allBookmarks) {
            var bookmarksInNonDefaultFolder = allBookmarks.filter(function (b) {
                return (defaultFolderIds.indexOf(b.folder_id) === -1);
            });

            assert.strictEqual(bookmarksInNonDefaultFolder.length, 1, "Only expected to find one bookmark");

            folderDbIdToSync = bookmarksInNonDefaultFolder[0].folder_dbid;
            return instapaperDB.updateReadProgress(bookmarksInNonDefaultFolder[0].bookmark_id, 0.93);
        }).then(function () {
            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.archive);
        }).then(function (archivedBookmarks) {
            return instapaperDB.updateReadProgress(archivedBookmarks[0].bookmark_id, 0.32);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folder: folderDbIdToSync, singleFolder: true });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (remoteBookmarks) {
            remoteBookmarks = remoteBookmarks.bookmarks;

            assert.strictEqual(parseFloat(remoteBookmarks[0].progress), 0.43, "Incorrect progress on archive bookmark");

            return instapaperDB.getFolderByDbId(folderDbIdToSync);
        }).then(function (folder) {
            return bookmarks.list({ folder_id: folder.folder_id });
        }).then(function (remoteBookmarks) {
            remoteBookmarks = remoteBookmarks.bookmarks;

            assert.strictEqual(parseFloat(remoteBookmarks[0].progress), 0.93, "Incorrect progress on folder bookmark");

            return getNewSyncEngine().sync();
        });
    }, defaultTestDelay);

    // State:
    //   Two Folders
    //   Bookmark in archive with 0.32 progress
    //   Bookmark in folder with 0.93 progress
    //   One Empty folder

    promiseTest("orphanedItemsAreCleanedup", function (assert) {
        var instapaperDB;
        var removedBookmarkId;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks();
        }).then(function (allBookmarks) {
            allBookmarks = allBookmarks.filter(function (b) {
                return defaultFolderIds.indexOf(b.folder_id) === -1;
            });

            var bookmark = allBookmarks[0];
            removedBookmarkId = bookmark.bookmark_id = bookmark.bookmark_id + 34;
            return instapaperDB.addBookmark(bookmark);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true });
        }).then(function () {
            return instapaperDB.getBookmarkByBookmarkId(removedBookmarkId);
        }).then(function (removedBookmark) {
            assert.ok(!removedBookmark, "Shouldn't be able to find bookmark");

            return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned);
        }).then(function (orphanedBookmarks) {
            assert.strictEqual(orphanedBookmarks.length, 0, "Didn't expect to find any orphaned bookmarks");
        });
    }, defaultTestDelay);

    // State:
    //   Two Folders
    //   Bookmark in archive with 0.32 progress
    //   Bookmark in folder with 0.93 progress
    //   One Empty folder

    promiseTest("supplyingFolderIdSyncsItBeforeOtherFolders", function (assert) {
        var instapaperDB;
        var expectedFirstSyncedFolder;
        var folderSyncOrder = [];

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (currentFolders) {
            currentFolders = currentFolders.filter(function (folder) {
                return defaultFolderIds.indexOf(folder.id) === -1;
            });

            assert.notStrictEqual(currentFolders.length, 0, "Expected some folders");

            expectedFirstSyncedFolder = currentFolders[0];

            return getNewSyncEngine().sync({
                bookmarks: true,
                folderToSync: expectedFirstSyncedFolder.folder_dbid,
                _testPerFolderCallback: function (id) {
                    folderSyncOrder.push(id);
                },
            });
        }).then(function () {
            assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

            assert.strictEqual(folderSyncOrder[0], expectedFirstSyncedFolder.id, "Folder was not sync'd first");
        });
    }, defaultTestDelay);

    // State:
    //   Two Folders
    //   Bookmark in archive with 0.32 progress
    //   Bookmark in folder with 0.93 progress
    //   One Empty folder

    promiseTest("withNoPriorityFolderSuppliedUnreadSyncsFirst", function (assert) {
        var instapaperDB;
        var folderSyncOrder = [];

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then(function (currentFolders) {
            return getNewSyncEngine().sync({
                bookmarks: true,
                _testPerFolderCallback: function (id) {
                    folderSyncOrder.push(id);
                },
            });
        }).then(function () {
            assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

            assert.strictEqual(folderSyncOrder[0], instapaperDB.commonFolderDbIds.unread, "Folder was not sync'd first");
        });
    }, defaultTestDelay);

    // State:
    //   Two Folders
    //   Bookmark in archive with 0.32 progress
    //   Bookmark in folder with 0.93 progress
    //   One Empty folder

    promiseTest("syncingBookmarksForSingleNewLocalFolderStillSyncsTheFolderAdd", function (assert) {
        var instapaperDB;
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var newFolderTitle = Date.now() + "a";
        var addedFolderDbId;
        var movedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                add: idb.addFolder({ title: newFolderTitle }),
                bookmarks: idb.listCurrentBookmarks(),
            });
        }).then(function (data) {
            addedFolderDbId = data.add.id;
            var bookmarks = data.bookmarks.filter(function (b) {
                return defaultFolderIds.indexOf(b.folder_id) === -1;
            });

            movedBookmark = bookmarks[0];
            return instapaperDB.moveBookmark(movedBookmark.bookmark_id, data.add.id);
        }).then(function () {
            return getNewSyncEngine().sync({
                bookmarks: true,
                folder: addedFolderDbId,
                singleFolder: true,
            });
        }).then(function () {
            return folders.list();
        }).then(function (remoteFolders) {
            var addedFolder = remoteFolders.filter(function (f) {
                return f.title === newFolderTitle;
            })[0];

            assert.ok(addedFolder, "Didn't find the added folder remotely");

            return bookmarks.list({ folder_id: addedFolder.folder_id });
        }).then(function (folderBookmarks) {
            folderBookmarks = folderBookmarks.bookmarks;

            assert.strictEqual(folderBookmarks.length, 1, "Expected only one bookmark");
            assert.strictEqual(folderBookmarks[0].bookmark_id, movedBookmark.bookmark_id, "Incorrect bookmark");
        });
    }, defaultTestDelay);

    // State:
    //   Three Folders
    //   Bookmark in archive with 0.32 progress
    //   Bookmark in folder with 0.93 progress
    //   Two Empty Folders

    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();