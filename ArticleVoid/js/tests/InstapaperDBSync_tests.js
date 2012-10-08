﻿(function () {
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
    var sourceUrls = [
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

    function getNewSyncEngine() {
        return new Codevoid.ArticleVoid.InstapaperSync(clientInformation);
    }

    module("InstapaperSync");

    function destroyRemoteAccountData() {
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
            // Find all the now-in-archive folders, and...
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Archive });
        }).then(function (archivedBookmarks) {
            // ... unarchive them. This will put them in "unread"
            var moves = [];
            archivedBookmarks = archivedBookmarks.bookmarks;
            archivedBookmarks.forEach(function (bookmark) {
                moves.push(bookmarks.unarchive(bookmark.bookmark_id));
            });

            return WinJS.Promise.join(moves);
        }).then(function () {
            // Find anything that has a "like" on it...
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (likes) {
            likes = likes.bookmarks;
            // ... and unlike it.
            var unlikes = [];
            likes.forEach(function (liked) {
                unlikes.push(bookmarks.unstar(liked.bookmark_id));
            });

            return WinJS.Promise.join(unlikes);
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Unread });
        }).then(function (remoteBookmarks) {
            remoteBookmarks = remoteBookmarks.bookmarks;
            var progressUpdates = [];
            remoteBookmarks.forEach(function (rb) {
                progressUpdates.push(bookmarks.updateReadProgress({
                    bookmark_id: rb.bookmark_id,
                    progress: 0.0,
                    progress_timestamp: Date.now(),
                }));
            });

            return WinJS.Promise.join(progressUpdates);
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

    function addDefaultBookmarks() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        var minNumberOfBookmarks = 2;

        // Get the remote bookmarks so we can add, update, cache etc as needed
        return bookmarks.list({
            folder_id: InstapaperDB.CommonFolderIds.Unread,
        }).then(function (remoteBookmarks) {
            remoteBookmarks = remoteBookmarks.bookmarks;
            // If we have remote bookmarks, we need to remove the urls
            // that they have from the "source" URLs
            if (remoteBookmarks && remoteBookmarks.length) {
                // For the remote urls we have, find any in the local
                // set and remove them from that table.
                remoteBookmarks.forEach(function (rb) {
                    var indexOfExistingUrl = -1;
                    sourceUrls.forEach(function (sb, index) {
                        if (rb.url === sb.url) {
                            indexOfExistingUrl = index;
                        }
                    });

                    if (indexOfExistingUrl != -1) {
                        sourceUrls.splice(indexOfExistingUrl, 1);
                    }
                });
            }

            // We have enough remote bookmarks to continue.
            if (remoteBookmarks && remoteBookmarks.length >= minNumberOfBookmarks) {
                return remoteBookmarks;
            }

            // We dont have enough remote Bookmarks, so lets add enough.
            var needToAdd = minNumberOfBookmarks;
            if (remoteBookmarks && remoteBookmarks.length) {
                needToAdd -= remoteBookmarks.length;
            };

            var adds = [];

            for (var i = 0; i < needToAdd; i++) {
                adds.push(bookmarks.add(sourceUrls.shift()).then(function (added) {
                    remoteBookmarks.push(added);
                }));
            }

            return WinJS.Promise.join(adds).then(function () {
                return remoteBookmarks;
            });
        }).then(function (currentRemoteBookmarks) {
            ok(currentRemoteBookmarks, "Didn't get list of current remote bookmarks");
            addedRemoteBookmarks = currentRemoteBookmarks;
        });
    };

    promiseTest("addDefaultBookmarks", addDefaultBookmarks);

    promiseTest("bookmarksAddedOnFirstSight", function () {
        var sync = getNewSyncEngine();
        var instapaperDB;

        return sync.sync({ bookmarks: true }).then(function () {
            return getNewInstapaperDBAndInit();
        }).then(function (idb) {
            instapaperDB = idb;

            return WinJS.Promise.join({
                local: idb.listCurrentBookmarks(idb.commonFolderDbIds.unread),
                remote: (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread }),
            });
        }).then(function (data) {
            var bookmarks = data.local;
            var expectedBookmarks = data.remote.bookmarks;

            ok(bookmarks, "Didn't get any bookmarks");
            strictEqual(bookmarks.length, addedRemoteBookmarks.length, "Didn't get enough bookmarks");

            // Check all the bookmarks are correctly present.
            ok(expectedBookmarks.length, "Should have added some test pages to check");

            var allInUnread = bookmarks.every(function (item) {
                var expectedBookmarkIndex = -1;
                expectedBookmarks.forEach(function (bookmark, index) {
                    if (bookmark.url === item.url) {
                        expectedBookmarkIndex = index;
                    }
                });

                if (expectedBookmarkIndex != -1) {
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
        var targetUrl = sourceUrls.shift().url;
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
        var targetBookmark;
        var targetTitle = Date.now() + "";
        var localBookmarkCountBeforeSync;
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

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
                return instapaperDB.likeBookmark(bookmark.bookmark_id, true).then(function () {
                    return WinJS.Promise.timeout();
                });
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

    promiseTest("localLikesAreSyncedToService", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

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

            ok(!likedAlready, "Bookmark was already liked on the service");

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (data) {
            var likedRemotely = data.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            ok(likedRemotely, "Item was not liked on the server");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("localunlikesAreSyncedToService", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.pop();
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

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

            ok(likedAlready, "Bookmark wasnt already liked on the service");

            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return bookmarks.list({ folder_id: InstapaperDB.CommonFolderIds.Liked });
        }).then(function (data) {
            var likedRemotely = data.bookmarks.some(function (bookmark) {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
            });

            ok(!likedRemotely, "Item was liked on the server");

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
            ok(true, "Title: " + bookmark.title);

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
        var targetBookmark = {};
        targetBookmark = addedRemoteBookmarks.shift();

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
            addedRemoteBookmarks.push(remote);

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("movesMoveToAppropriateFolder", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();
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

            addedRemoteBookmarks.push(remote);

            ok(remote, "Bookmark wasn't moved to archive remotely");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("localDeletesGoUpToTheServer", function () {
        var instapaperDB;
        var targetBookmark = addedRemoteBookmarks.shift();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.removeBookmark(targetBookmark.bookmark_id);
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return (new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: InstapaperDB.CommonFolderIds.Unread });
        }).then(function (data) {
            var bookmarkFoundRemotely = data.bookmarks.some(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            });

            ok(!bookmarkFoundRemotely, "Found the bookmark remotely. It should have been deleted");
            sourceUrls.push({ url: targetBookmark.url });

            return expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    promiseTest("resetRemoteDataBeforePerformingDeletes", destroyRemoteAccountData);
    promiseTest("ensureHaveEnoughRemotebookmarks", addDefaultBookmarks);
    promiseTest("deleteLocalDbBeforeDeletes", deleteDb);
    promiseTest("syncDefaultState", function () {
        return getNewSyncEngine().sync().then(function () {
            ok(true, "sync complete");
        });
    });

    promiseTest("remoteDeletesAreRemovedLocally", function () {
        var instapaperDB;
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        var targetBookmark1 = addedRemoteBookmarks.shift();
        var targetBookmark2 = addedRemoteBookmarks.shift();

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
        }).then(function (current) {
            ok(current, "Didn't get any bookmarks");
            ok(current.length > 1, "Didn't find enough bookmarks");

            return WinJS.Promise.join({
                delete1: bookmarks.deleteBookmark(targetBookmark1.bookmark_id),
                delete2: bookmarks.deleteBookmark(targetBookmark2.bookmark_id),
            });
        }).then(function () {
            return getNewSyncEngine().sync({ bookmarks: true, folders: false });
        }).then(function () {
            return WinJS.Promise.join({
                bookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                bookmark1: instapaperDB.getBookmarkByBookmarkId(targetBookmark1.bookmark_id),
                bookmark2: instapaperDB.getBookmarkByBookmarkId(targetBookmark2.bookmark_id),
            });
        }).then(function (data) {
            var bookmark1NoLongerInUnread = data.bookmarks.some(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark1.bookmark_id;
            });
            ok(!bookmark1NoLongerInUnread, "Bookmark was still found in unread");

            var bookmark2NoLongerInUnread = data.bookmarks.some(function (bookmark) {
                return bookmark.bookmark_id === targetBookmark2.bookmark_id;
            });

            ok(!data.bookmark1, "Bookmark found when it shouldn't have been");
            ok(!data.bookmark2, "Bookmark found when it shouldn't have been");
        });
    });
    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();