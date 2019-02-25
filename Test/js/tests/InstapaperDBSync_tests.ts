namespace CodevoidTests {
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    import getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    import expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    import expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    import deleteDb = InstapaperTestUtilities.deleteDb;
    import IFolder = Codevoid.Storyvoid.IFolder;
    import IBookmark = Codevoid.Storyvoid.IBookmark;

    const DEFAULT_TEST_DELAY = 250;
    const clientID = "PLACEHOLDER";
    const clientSecret = "PLACEHOLDER";

    const token = "PLACEHOLDER";
    const secret = "PLACEHOLDER";

    const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperSync Tests";

    const defaultFolderIds: string[] = InstapaperTestUtilities.defaultFolderIds.concat([]);
    let addedRemoteFolders: IFolder[];
    let addedRemoteBookmarks: IBookmark[];
    let sourceUrls: Codevoid.Storyvoid.InstapaperApi.IBookmarkAddParameters[];

    function destroyRemoteAccountData(this: Mocha.Context): WinJS.Promise<void> {
        this.timeout(60000);
        return InstapaperTestUtilities.destroyRemoteAccountData(clientInformation);
    }

    function testDelay(): WinJS.Promise<void> {
        return WinJS.Promise.timeout(DEFAULT_TEST_DELAY);
    }
    
    function setSampleFolders(): void {
        addedRemoteFolders = [
            { title: "sampleFolder1", },
            { title: "sampleFolder2", },
            { title: "sampleFolder3", },
        ];
    }

    function resetSourceUrls(): void {
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

    function getNewSyncEngine(): Codevoid.Storyvoid.InstapaperSync {
        return new Codevoid.Storyvoid.InstapaperSync(clientInformation);
    }

    function addDefaultRemoteFolders() {
        setSampleFolders();
        const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

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
            return Codevoid.Utilities.serialize(addedRemoteFolders, (folder, index) => {
                if (folder.folder_id !== undefined) {
                    // assume we've already got the info
                    return WinJS.Promise.as();
                }

                return folders.add(folder.title).then((remoteFolder) => addedRemoteFolders[index] = remoteFolder);
            });
        }).then(() => {
            assert.ok(true, "Folders added");
        }, (errors) => {
            let foundNonAlreadyThereError = false;
            foundNonAlreadyThereError = errors.some((item) => (item.error != undefined) && (item.error === 1251));

            assert.ok(!foundNonAlreadyThereError, "Unexpected error when adding folders");
        });
    }

    function addsFoldersOnFirstSight() {
        const sync = getNewSyncEngine();
        let instapaperDB;
        return sync.sync({ folders: true }).then(() => {
            return getNewInstapaperDBAndInit();
        }).then((idb) => {
            instapaperDB = idb;
            return idb.listCurrentFolders();
        }).then((folders) => {
            assert.ok(folders, "Didn't get folder list");

            assert.strictEqual(folders.length, 7, "Unexpected number of folders");

            folders.forEach((folder) => {
                switch (folder.folder_id) {
                    case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread:
                    case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive:
                    case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked:
                    case Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned:
                        return;
                        break;

                    default:
                        break;
                }

                const wasInSyncedSet = addedRemoteFolders.some((f) => f.folder_id === folder.folder_id);

                assert.ok(wasInSyncedSet, "Folder: " + folder.folder_id + ", " + folder.title + " wasn't expected to be found");
            });

            return expectNoPendingFolderEdits(instapaperDB);
        });
    }

    function addDefaultBookmarks(neededBookmarks) {
        const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const minNumberOfBookmarks = neededBookmarks || 2;
        resetSourceUrls();

        // Get the remote bookmarks so we can add, update, cache etc as needed
        return bookmarks.list({
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
        }).then((result) => {
            const remoteBookmarks = result.bookmarks;
            // If we have remote bookmarks, we need to remove the urls
            // that they have from the "source" URLs
            if (remoteBookmarks && remoteBookmarks.length) {
                // For the remote urls we have, find any in the local
                // set and remove them from that array.
                remoteBookmarks.forEach((rb) => {
                    let indexOfExistingUrl = -1;
                    sourceUrls.forEach((sb, index) => {
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
            let needToAdd = minNumberOfBookmarks;
            if (remoteBookmarks && remoteBookmarks.length) {
                needToAdd -= remoteBookmarks.length;
            }

            const adds = [];

            for (let i = 0; i < needToAdd; i++) {
                adds.push(sourceUrls.shift());
            }

            return Codevoid.Utilities.serialize(adds, (url: Codevoid.Storyvoid.InstapaperApi.IBookmarkAddParameters) => {
                return bookmarks.add(url).then((added) => remoteBookmarks.push(added));
            }).then(() => remoteBookmarks);
        }).then((currentRemoteBookmarks: IBookmark[]) => {
            assert.ok(currentRemoteBookmarks, "Didn't get list of current remote bookmarks");
            addedRemoteBookmarks = currentRemoteBookmarks;
            assert.ok(addedRemoteBookmarks, "No remotebookmarks!");
            assert.ok(addedRemoteBookmarks.length, "No remote bookmarks!");

            return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
        }).then((result) => {
            // Reset all remote likes.
            return Codevoid.Utilities.serialize(result.bookmarks, (item) => bookmarks.unstar(item.bookmark_id));
        });
    }

    describe("InstapaperSync", () => {
        beforeEach(testDelay);
        it("destoryRemoteDataOnStart", destroyRemoteAccountData);

        it("deleteDbOnStart", deleteDb.bind(null, null));

        it("addDefaultRemoteFolders", addDefaultRemoteFolders);

        it("addsFoldersOnFirstSight", addsFoldersOnFirstSight);

        it("differentFolderTitleOnServerIsSyncedToDB", function differentFolderTitleOnServerIsSyncedToDB() {
            const sync = getNewSyncEngine();
            const targetRemoteFolder = addedRemoteFolders[0];
            let instapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.getFolderFromFolderId(targetRemoteFolder.folder_id);
            }).then((localFolder) => {
                localFolder.title = Date.now() + "a";
                return WinJS.Promise.join({
                    updatedFolder: instapaperDB.updateFolder(localFolder),
                    timeout: WinJS.Promise.timeout(),
                });
            }).then((data) => {
                assert.ok(data.updatedFolder, "Didn't get updated folder");
                assert.notStrictEqual(data.updatedFolder.title, targetRemoteFolder.title, "Title didn't change");

                return sync.sync({ folders: true });
            }).then(() => {
                return instapaperDB.getFolderFromFolderId(targetRemoteFolder.folder_id);
            }).then((localFolder) => {
                assert.strictEqual(localFolder.title, targetRemoteFolder.title, "Title did not correctly sync");
                return expectNoPendingFolderEdits(instapaperDB);
            });
        });

        it("removedFolderOnServerIsDeletedLocallyOnSync", function removedFolderOnServerIsDeletedLocallyOnSync() {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const fakeFolder = {
                title: "foo",
                folder_id: "foo_1",
            };

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    folder: instapaperDB.addFolder(fakeFolder, true),
                    timeout: WinJS.Promise.timeout(),
                }).then(() => {
                    return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
                }).then((addedFolder) => {
                    assert.ok(addedFolder, "Didn't get added folder");
                    assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                    assert.ok(!!addedFolder.id, "Folder didn't have DB id");

                    return WinJS.Promise.join([sync.sync({ folders: true }), WinJS.Promise.timeout()]);
                }).then(() => {
                    return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
                }).then((addedFolder) => {
                    assert.ok(!addedFolder, "Shouldn't have gotten the folder. It should have been removed");

                    return expectNoPendingFolderEdits(instapaperDB);
                });
            });
        });

        it("removedAndAddedFoldersOnServerAreCorrectlySynced", function removedAndAddedFoldersOnServerAreCorrectlySynced() {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const fakeFolder: IFolder = {
                title: "foo",
                folder_id: "foo_1",
            };

            const newRemoteFolder: IFolder = {
                title: Date.now() + "a", // now() is an integer. It comes back as a string, Just make it a damn string
            };

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    folder: instapaperDB.addFolder(fakeFolder, true),
                    timeout: WinJS.Promise.timeout(),
                }).then(() => {
                    return instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
                }).then((addedFolder) => {
                    assert.ok(addedFolder, "Didn't get added folder");
                    assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
                    assert.ok(!!addedFolder.id, "Folder didn't have DB id");

                    const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

                    // Add a non-local folder to syncdown at the same time.
                    return folders.add(newRemoteFolder.title);
                }).then((addedRemoteFolder) =>  {
                    // Save the ID for later user.
                    newRemoteFolder.folder_id = addedRemoteFolder.folder_id;

                    return WinJS.Promise.join([sync.sync({ folders: true }), WinJS.Promise.timeout()]);
                }).then(() => {
                    return WinJS.Promise.join({
                        deleted: instapaperDB.getFolderFromFolderId(fakeFolder.folder_id),
                        added: instapaperDB.getFolderFromFolderId(newRemoteFolder.folder_id),
                    });
                }).then((folders) => {
                    assert.ok(!folders.deleted, "Shouldn't have gotten the folder. It should have been removed");

                    assert.ok(folders.added, "Didn't find added folder");
                    assert.strictEqual(folders.added.folder_id, newRemoteFolder.folder_id, "Not correct folder ID");
                    assert.strictEqual(folders.added.title, newRemoteFolder.title, "Incorrect title");

                    return expectNoPendingFolderEdits(instapaperDB);
                });
            });
        });

        it("pendedAddsAreUploaded", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;

            let newFolder: IFolder = { title: Date.now() + "a", };

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addFolder(newFolder);
            }).then((addedFolder) => {
                assert.ok(!!addedFolder.id, "need folder id to find it later");
                newFolder = addedFolder;

                return sync.sync({ folders: true });
            }).then(() => {
                return (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).list();
            }).then((remoteFolders) => {
                const localFolderWasSynced = remoteFolders.some((item) => {
                    return item.title === newFolder.title;
                });

                assert.ok(localFolderWasSynced, "Local folder was not found on the server");

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });

        it("foldersGetUpdatedFolderIdsWhenUploaded", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            let newFolder: IFolder = { title: Date.now() + "a", };

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addFolder(newFolder);
            }).then((addedFolder) => {
                assert.ok(!!addedFolder.id);
                assert.strictEqual(addedFolder.folder_id, undefined, "Shouldn't have had a folder id yet.");
                newFolder = addedFolder;

                return instapaperDB.getPendingFolderEdits();
            }).then((pendingEdits) => {
                assert.strictEqual(pendingEdits.length, 1, "Only expected one pending edit");

                return sync.sync({ folders: true });
            }).then(() => {
                return instapaperDB.getFolderByDbId(newFolder.id);
            }).then((syncedFolder) => {
                assert.ok(!!syncedFolder.folder_id, "Didn't find a folder ID");
                addedRemoteFolders.push(syncedFolder);
                return expectNoPendingFolderEdits(instapaperDB);
            });
        });

        it("sameFolderRemoteAndLocalButUnsynced", () => {
            interface ISpecialFolder extends IFolder {
                cookie: boolean;
            }
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;

            let local: ISpecialFolder = {
                title: Date.now() + "a",
                cookie: true
            };

            let remote: IFolder = { title: local.title }; // make sure the remote is the same

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    local: idb.addFolder(local),
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).add(remote.title),
                }).then((data) => {
                    local = data.local;
                    remote = data.remote;

                    return sync.sync({ folders: true });
                }).then(() => {
                    return expectNoPendingFolderEdits(instapaperDB);
                }).then(() => {
                    return instapaperDB.getFolderByDbId(local.id);
                }).then((localFolder: ISpecialFolder) => {
                    assert.ok(localFolder, "Didn't find the local folder");
                    assert.strictEqual(localFolder.folder_id, remote.folder_id, "Folder ID didn't match the local folder");
                    assert.strictEqual(localFolder.title, remote.title, "Folder title didn't match");
                    assert.ok(localFolder.cookie, "Cookie was not present on the DB folder. Data Squashed?");
                });
            });
        });

        it("pendedDeletesAreUploaded", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    local: idb.getFolderFromFolderId(targetFolder.folder_id),
                    remoteFolders: folders.list(),
                });
            }).then((data) => {
                assert.ok(!!data.local.id, "need folder id to delete");
                assert.ok(data.remoteFolders.some((item) => {
                    return item.folder_id === data.local.folder_id;
                }), "Folder to delete wasn't present remotely");

                return instapaperDB.removeFolder(data.local.id);
            }).then(() => {
                return sync.sync({ folders: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remoteFolders: folders.list(),
                    localFolder: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                });
            }).then((data) => {
                assert.ok(!data.remoteFolders.some((item) => {
                    return item.folder_id === targetFolder.folder_id;
                }), "Item shouldn't have been found remotely");

                assert.ok(!data.localFolder, "Local folder should be missing");

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });

        it("deletedLocallyAndRemotelySyncsSuccessfully", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    local: idb.getFolderFromFolderId(targetFolder.folder_id),
                    remoteFolders: folders.list(),
                });
            }).then((data) => {
                assert.ok(!!data.local.id, "need folder id to delete");
                assert.ok(data.remoteFolders.some((item) => {
                    return item.folder_id === data.local.folder_id;
                }), "Folder to delete wasn't present remotely");

                return WinJS.Promise.join({
                    local: instapaperDB.removeFolder(data.local.id),
                    remote: folders.deleteFolder(data.local.folder_id),
                });
            }).then(() => {
                return sync.sync({ folders: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remoteFolders: folders.list(),
                    localFolder: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                });
            }).then((data) => {
                assert.ok(!data.remoteFolders.some((item) => {
                    return item.folder_id === targetFolder.folder_id;
                }), "Item shouldn't have been found remotely");

                assert.ok(!data.localFolder, "Local folder should be missing");

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });

        it("pendedDeletesAndAddsSyncUp", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            let newFolder: IFolder = { title: Date.now() + "a" };

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    toRemove: idb.getFolderFromFolderId(targetFolder.folder_id),
                    toAdd: idb.addFolder(newFolder),
                    remoteFolders: folders.list(),
                });
            }).then((data) => {
                assert.ok(!!data.toRemove.id, "need folder id to delete");
                assert.ok(data.remoteFolders.some((item) => {
                    return item.folder_id === data.toRemove.folder_id;
                }), "Folder to delete wasn't present remotely");

                assert.ok(data.toAdd, "Didn't get added folder");
                assert.ok(data.toAdd.id, "Didn't have an ID");
                newFolder = data.toAdd;

                return instapaperDB.removeFolder(data.toRemove.id);
            }).then(() => {
                return sync.sync({ folders: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remoteFolders: folders.list(),
                    removed: instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                    added: instapaperDB.getFolderByDbId(newFolder.id),
                });
            }).then((data) => {
                assert.ok(!data.remoteFolders.some((item) => {
                    return item.folder_id === targetFolder.folder_id;
                }), "Item shouldn't have been found remotely");

                assert.ok(!data.removed, "Local folder should be missing");

                assert.ok(data.added, "Didn't get added folder. It got lost");
                addedRemoteFolders.push(data.added);

                return expectNoPendingFolderEdits(instapaperDB);
            });
        });
    });

    describe("InstapaperSyncBookmarks", () => {
        beforeEach(testDelay);

        it("destoryRemoteDataBeforeBookmarks", destroyRemoteAccountData);
        it("deleteDbBeforeBookmarks", deleteDb.bind(null, null));
        it("addDefaultRemoteFoldersBeforeBookmarks", addDefaultRemoteFolders);
        it("addsFoldersOnFirstSightBeforeBookmarks", addsFoldersOnFirstSight);

        it("addDefaultBookmarks", addDefaultBookmarks.bind(null, 0));

        it("bookmarksAddedOnFirstSight", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;


            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentFolders();
            }).then((data) => {
                return sync.sync({ bookmarks: true });
            }).then((idb) => {

                return WinJS.Promise.join({
                    local: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                });
            }).then((data) => {
                const bookmarks = data.local;
                const expectedBookmarks = data.remote.bookmarks;

                assert.ok(bookmarks, "Didn't get any bookmarks");
                assert.strictEqual(bookmarks.length, addedRemoteBookmarks.length, "Didn't get enough bookmarks");

                // Check all the bookmarks are correctly present.
                assert.ok(expectedBookmarks.length, "Should have added some test pages to check");

                const allInUnread = bookmarks.every((item) => {
                    let expectedBookmarkIndex = -1;
                    expectedBookmarks.forEach((bookmark, index) => {
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
                addedRemoteBookmarks.forEach((b) => {
                    let local: IBookmark;

                    // Find the local matching bookmark by URL
                    for (let i = 0; i < bookmarks.length; i++) {
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

                return expectNoPendingBookmarkEdits(instapaperDB);
            });

        });

        it("syncingOnlyFoldersOnlySyncsFolders", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            const addedFolderName = Date.now() + "a";
            let addedFolder: IFolder;
            let currentBookmarkCount: number;
            let currentFolderCount: number;

            const f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return WinJS.Promise.join({
                folderAdd: f.add(addedFolderName),
                bookmarkAdd: b.add(sourceUrls.shift()),
                idb: getNewInstapaperDBAndInit(),
            }).then((data) => {
                instapaperDB = data.idb;
                addedFolder = data.folderAdd;
                addedRemoteBookmarks.push(data.bookmarkAdd);

                return WinJS.Promise.join({
                    folders: data.idb.listCurrentFolders(),
                    bookmarks: data.idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                currentBookmarkCount = data.bookmarks.length;
                currentFolderCount = data.folders.length;

                return sync.sync({ folders: true, bookmarks: false });
            }).then(() => {
                return WinJS.Promise.join({
                    folders: instapaperDB.listCurrentFolders(),
                    bookmarks: instapaperDB.listCurrentBookmarks(),
                });
            }).then((data) => {
                assert.strictEqual(data.folders.length, currentFolderCount + 1, "Incorrect number of folders");

                assert.ok(data.folders.some((folder) => {
                    return folder.title === addedFolderName;
                }), "Didn't find the added folder locally");

                assert.strictEqual(data.bookmarks.length, currentBookmarkCount, "Incorrect number of bookmarks");

                return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
            }).then((folder) => {
                addedRemoteFolders.push(folder);
            });
        });

        it("syncingOnlyBookmarksOnlySyncsBookmarks", () => {
            const sync = getNewSyncEngine();
            let instapaperDB: InstapaperDB;
            let currentBookmarkCount: number;
            let currentFolderCount: number;
            const addedFolderName = Date.now() + "a";
            let addedFolder: IFolder;

            const f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return WinJS.Promise.join({
                folderAdd: f.add(addedFolderName),
                idb: getNewInstapaperDBAndInit(),
            }).then((data) => {
                instapaperDB = data.idb;
                addedFolder = data.folderAdd;

                return WinJS.Promise.join({
                    folders: data.idb.listCurrentFolders(),
                    bookmarks: data.idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                currentBookmarkCount = data.bookmarks.length;
                currentFolderCount = data.folders.length;

                return sync.sync({ folders: false, bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    folders: instapaperDB.listCurrentFolders(),
                    bookmarks: instapaperDB.listCurrentBookmarks(),
                });
            }).then((data) => {
                assert.strictEqual(data.folders.length, currentFolderCount, "Incorrect number of folders");
                assert.strictEqual(data.bookmarks.length, currentBookmarkCount + 1, "Incorrect number of bookmarks");

                assert.ok(data.bookmarks.some((bookmark) => {
                    return bookmark.url === addedRemoteBookmarks[addedRemoteBookmarks.length - 1].url;
                }), "Didn't find the expected bookmark");

                return sync.sync();
            }).then(() => {
                return instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
            }).then((folder) => {
                addedRemoteFolders.push(folder);
            });
        });

        it("locallyAddedBookmarksGoUpToUnread", () => {
            let instapaperDB: InstapaperDB;
            const targetUrl = sourceUrls.shift().url;
            const targetTitle = Date.now() + "a";

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.addUrl({ url: targetUrl, title: targetTitle });
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return WinJS.Promise.join({
                    remoteBookmarks: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                    localBookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                });
            }).then((data) => {
                const rb: Codevoid.Storyvoid.InstapaperApi.IBookmarkListResult = data.remoteBookmarks;
                const lb: IBookmark[] = data.localBookmarks;

                const remoteBookmark = rb.bookmarks.filter((f) => f.url === targetUrl)[0];

                assert.ok(remoteBookmark, "Didn't find the remote bookmark added");
                assert.strictEqual(remoteBookmark.title, targetTitle, "Remote title was incorrect");

                const addedBookmark = lb.filter((f) => f.url === targetUrl)[0];

                assert.ok(addedBookmark, "Didn't see the added folder locally");
                assert.strictEqual(addedBookmark.title, targetTitle, "Local title was incorrect");

                addedRemoteBookmarks.push(addedBookmark);

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("syncingBookmarkThatIsAlreadyAvailableRemotelyDoesntDuplicate", () => {
            let instapaperDB: InstapaperDB;
            let targetBookmark: IBookmark;
            const targetTitle = Date.now() + "a";
            let localBookmarkCountBeforeSync: number;
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((current) => {
                targetBookmark = current.shift();

                return WinJS.Promise.join({
                    added: instapaperDB.addUrl({ url: targetBookmark.url, title: targetTitle }),
                    localBookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                });
            }).then((data) => {
                localBookmarkCountBeforeSync = data.localBookmarks.length;
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            }).then((lb) => {
                assert.strictEqual(lb.length, localBookmarkCountBeforeSync, "Didn't expect any change in the bookmark counts");
                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("remoteProgressChangesAreCorrectlySyncedLocally", () => {
            let instapaperDB: InstapaperDB;
            let updatedBookmark: IBookmark

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                const bookmark = localBookmarks[0];
                assert.ok(bookmark, "Need a bookmark to work with");

                assert.notStrictEqual(bookmark.progress, 0.5, "Progress is already where we're going to set it");
                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).updateReadProgress({
                    bookmark_id: bookmark.bookmark_id,
                    progress: 0.5,
                    progress_timestamp: Date.now(),
                });
            }).then((bookmark) => {
                updatedBookmark = bookmark;
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            }).then((bookmark) => {
                assert.equal(bookmark.progress, updatedBookmark.progress, "Progress did not match");
                assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Wrong bookmark timestamp");
                assert.strictEqual(bookmark.hash, updatedBookmark.hash, "hashes were incorrrect");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("likedRemoteBookmarkUpdatedLocallyAfterSync", () => {
            let instapaperDB: InstapaperDB;
            let updatedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                const bookmark = localBookmarks[0];
                assert.ok(bookmark, "Need a bookmark to work with");

                assert.notStrictEqual(bookmark.starred, 1, "Bookmark was already liked. We need  it to not be");

                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).star(bookmark.bookmark_id);
            }).then((bookmark) => {
                bookmark.starred = parseInt(<any>bookmark.starred);
                updatedBookmark = bookmark;
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            }).then((bookmark) => {
                assert.strictEqual(bookmark.starred, 1, "Liked status did not match");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("unlikedRemoteBookmarkUpdatedLocallyAfterSync", () => {
            let instapaperDB: InstapaperDB;
            let updatedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                const bookmark = localBookmarks[0];
                const likePromise = WinJS.Promise.as();

                assert.ok(bookmark, "Need a bookmark to work with");

                if (bookmark.starred === 0) {
                    return instapaperDB.likeBookmark(bookmark.bookmark_id, true).then(() => {
                        return WinJS.Promise.timeout();
                    });
                }

                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).unstar(bookmark.bookmark_id);
            }).then((bookmark) => {
                bookmark.starred = parseInt(bookmark.starred);
                updatedBookmark = bookmark;
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            }).then((bookmark) => {
                assert.strictEqual(bookmark.starred, 0, "Liked status did not match");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("localLikesAreSyncedToService", () => {
            let instapaperDB: InstapaperDB;
            const targetBookmark = addedRemoteBookmarks.shift();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    local: idb.likeBookmark(targetBookmark.bookmark_id),
                    remoteLikes: bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked }),
                });
            }).then((data) => {
                addedRemoteBookmarks.push(data.local);

                const likedAlready = data.remoteLikes.bookmarks.some((bookmark) => {
                    return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
                });

                assert.ok(!likedAlready, "Bookmark was already liked on the service");

                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
            }).then((data) => {
                const likedRemotely = data.bookmarks.some((bookmark) => {
                    return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === <any>"1");
                });

                assert.ok(likedRemotely, "Item was not liked on the server");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("localunlikesAreSyncedToService", () => {
            let instapaperDB: InstapaperDB;
            const targetBookmark = addedRemoteBookmarks.pop();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                let setupData = WinJS.Promise.as();
                if (targetBookmark.starred === 0) {
                    setupData = WinJS.Promise.join({
                        local: idb.likeBookmark(targetBookmark.bookmark_id, true),
                        remote: bookmarks.star(targetBookmark.bookmark_id),
                    });
                }

                return setupData.then(() => {
                    return WinJS.Promise.join({
                        local: idb.unlikeBookmark(targetBookmark.bookmark_id),
                        remoteLikes: bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked }),
                    });
                });
            }).then((data) => {
                addedRemoteBookmarks.push(data.local);

                const likedAlready = data.remoteLikes.bookmarks.some((bookmark) => {
                    return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === "1");
                });

                assert.ok(likedAlready, "Bookmark wasnt already liked on the service");

                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
            }).then((data) => {
                const likedRemotely = data.bookmarks.some((bookmark) => {
                    return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === <any>"1");
                });

                assert.ok(!likedRemotely, "Item was liked on the server");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("remoteTitleAndDescriptionChangesComeDownLocally", () => {
            let instapaperDB: InstapaperDB;
            let updatedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((bookmarks) => {
                const bookmark = bookmarks[0];
                assert.ok(bookmark, "Need a bookmark to work with");

                bookmark.title = "updatedTitle" + Date.now();
                bookmark.description = "updatedDescription" + Date.now();
                assert.ok(true, "Title: " + bookmark.title);

                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).add(<Codevoid.Storyvoid.InstapaperApi.IBookmarkAddParameters>bookmark);
            }).then((remoteBookmark) => {
                updatedBookmark = remoteBookmark;

                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            }).then((localBookmark) => {
                assert.strictEqual(localBookmark.title, updatedBookmark.title, "Incorrect title");
                assert.strictEqual(localBookmark.description, updatedBookmark.description);
            });
        });

        it("localReadProgressIsPushedUp", () => {
            let instapaperDB: InstapaperDB;
            const targetProgress = Math.round(Math.random() * 100) / 100;
            let updatedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                const localBookmark = localBookmarks[0];
                assert.ok(localBookmark, "need a bookmark to work with");

                assert.notStrictEqual(localBookmark.progress, targetProgress, "Progress is already at the target value");

                return instapaperDB.updateReadProgress(localBookmark.bookmark_id, targetProgress);
            }).then((progressChanged) => {
                updatedBookmark = progressChanged;
                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return WinJS.Promise.join({
                    remoteBookmarks: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                    localBookmark: instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id),
                });
            }).then((data) => {
                const bookmark = data.remoteBookmarks.bookmarks.filter((remote) => {
                    return remote.bookmark_id === updatedBookmark.bookmark_id;
                })[0];

                assert.ok(bookmark, "Didn't find the remote bookmark");

                assert.equal(bookmark.progress, updatedBookmark.progress, "Progress was unchanged");
                assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Timestamp for last progress changed was incorrect");
                assert.strictEqual(bookmark.hash, data.localBookmark.hash, "Hash wasn't updated locally");
            });
        });

        it("archivesAreMovedToArchiveFolder", () => {
            let instapaperDB: InstapaperDB;
            const targetBookmark: IBookmark = addedRemoteBookmarks.shift() || <any>{};

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.moveBookmark(targetBookmark.bookmark_id, idb.commonFolderDbIds.archive);
            }).then(() => {
                return getNewSyncEngine().sync();
            }).then(() => {
                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
            }).then((remoteBookmarks) => {
                const remote = remoteBookmarks.bookmarks.filter((bookmark) => {
                    return bookmark.bookmark_id === targetBookmark.bookmark_id;
                })[0];

                assert.ok(remote, "Bookmark wasn't moved to archive remotely");
                addedRemoteBookmarks.push(remote);

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("movesMoveToAppropriateFolder", () => {
            let instapaperDB: InstapaperDB;
            const targetBookmark = addedRemoteBookmarks.shift();
            let newFolder: IFolder;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.addFolder({ title: Date.now() + "a" });
            }).then((addedFolder) => {
                newFolder = addedFolder;
                return instapaperDB.moveBookmark(targetBookmark.bookmark_id, newFolder.id);
            }).then(() => {
                return getNewSyncEngine().sync();
            }).then(() => {
                return instapaperDB.getFolderByDbId(newFolder.id);
            }).then((folder) => {
                newFolder = folder;
                addedRemoteFolders.push(newFolder);

                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: newFolder.folder_id });
            }).then((remoteBookmarks) => {
                const remote = remoteBookmarks.bookmarks.filter((bookmark) => {
                    return bookmark.bookmark_id === targetBookmark.bookmark_id;
                })[0];

                addedRemoteBookmarks.push(remote);

                assert.ok(remote, "Bookmark wasn't moved to archive remotely");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        it("localDeletesGoUpToTheServer", () => {
            let instapaperDB: InstapaperDB;
            const targetBookmark = addedRemoteBookmarks.shift();

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.removeBookmark(targetBookmark.bookmark_id);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true, folders: false });
            }).then(() => {
                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
            }).then((data) => {
                const bookmarkFoundRemotely = data.bookmarks.some((bookmark) => {
                    return bookmark.bookmark_id === targetBookmark.bookmark_id;
                });

                assert.ok(!bookmarkFoundRemotely, "Found the bookmark remotely. It should have been deleted");
                sourceUrls.push({ url: targetBookmark.url });

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });
    });

    describe("InstapaperSyncLimits", () => {
        beforeEach(testDelay);

        it("deleteLocalDBBeforeSyncingWithLimits", deleteDb.bind(null, null));
        it("addEnoughRemoteBookmarks", addDefaultBookmarks.bind(null, 0));

        it("syncRespectsLimits", () => {
            const sync = getNewSyncEngine();
            sync.perFolderBookmarkLimits = {};
            sync.defaultBookmarkLimit = 1;

            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }).then((rb) => {
                assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.bookmarks.length);

                return sync.sync();
            }).then(() => {
                return getNewInstapaperDBAndInit();
            }).then((idb) => {
                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
            });
        });

        it("syncingOnlyOneBookmarkWithOneLikeNotInOneBookmarkBoundaryDoesn'tFailSync", () => {
            const sync = getNewSyncEngine();
            sync.perFolderBookmarkLimits = {};
            sync.defaultBookmarkLimit = 1;

            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }).then((rb) => {
                assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.bookmarks.length);

                const lastBookmark = rb.bookmarks[rb.bookmarks.length - 1];

                return bookmarks.star(lastBookmark.bookmark_id);
            }).then(() => {
                return sync.sync();
            }).then(() => {
                return getNewInstapaperDBAndInit();
            }).then((idb) => {
                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((localBookmarks) => {
                assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
                assert.strictEqual(localBookmarks[0].starred, 0, "Didn't expect it to be starred");
            });
        });

        // We need to clean up before we futz with more limits
        it("deleteLocalDBBeforeSyncingWithLimits", deleteDb.bind(null, null));
        it("addEnoughRemoteBookmarks", () => addDefaultBookmarks(8));
        it("addDefaultRemoteFolders", addDefaultRemoteFolders);

        it("perFolderLimitsOnBookmarksAreApplied", () => {
            const sync = getNewSyncEngine();
            sync.defaultBookmarkLimit = 1;
            const remoteFolder1 = addedRemoteFolders[0].folder_id;
            const remoteFolder2 = addedRemoteFolders[1].folder_id;

            const folderSyncLimits = {};
            folderSyncLimits[Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked] = 2;
            folderSyncLimits[remoteFolder1] = 2;
            folderSyncLimits[remoteFolder2] = 2;

            sync.perFolderBookmarkLimits = folderSyncLimits;

            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }).then((rb) => {
                assert.ok(rb.bookmarks.length >= 8, "Not enough Bookmarks remotely: " + rb.bookmarks.length);

                const itemsInSampleFolder1 = [];
                itemsInSampleFolder1.push(rb.bookmarks[0].bookmark_id);
                itemsInSampleFolder1.push(rb.bookmarks[1].bookmark_id);
                itemsInSampleFolder1.push(rb.bookmarks[2].bookmark_id);

                const itemsInSampleFolder2 = [];
                itemsInSampleFolder2.push(rb.bookmarks[3].bookmark_id);
                itemsInSampleFolder2.push(rb.bookmarks[4].bookmark_id);
                itemsInSampleFolder2.push(rb.bookmarks[5].bookmark_id);

                const moves = Codevoid.Utilities.serialize(itemsInSampleFolder1, (item) => {
                    return bookmarks.move({ bookmark_id: item, destination: remoteFolder1 });
                });

                const moves2 = Codevoid.Utilities.serialize(itemsInSampleFolder2, (item) => {
                    return bookmarks.move({ bookmark_id: item, destination: remoteFolder2 });
                });

                return WinJS.Promise.join([moves, moves2]);
            }).then(() => {
                return sync.sync();
            }).then(() => {
                return getNewInstapaperDBAndInit();
            }).then((idb) => {
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
            }).then((result) => {
                assert.strictEqual(result.unread.length, 1, "Only expected on bookmark");
                assert.strictEqual(result.folder1.length, 2, "Only expected two out of three bookmarks synced");
                assert.strictEqual(result.folder2.length, 2, "Only expected two out of three bookmarks synced");
            });
        });
    });

    describe("InstapaperSyncBookmarkDeletes", () => {
        beforeEach(testDelay);

        it("resetRemoteDataBeforePerformingDeletes", destroyRemoteAccountData);
        it("ensureHaveEnoughRemotebookmarks", addDefaultBookmarks.bind(null, 0));
        it("deleteLocalDbBeforeDeletes", deleteDb.bind(null, null));

        function addLocalOnlyFakeBookmark(idb) {
            const fakeBookmarkToAdd = {
                bookmark_id: Date.now(),
                url: "http://notreal.com",
                title: "Test",
                folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
                folder_dbid: idb.commonFolderDbIds.unread,
            };

            return idb.addBookmark(fakeBookmarkToAdd);
        }

        it("syncDefaultState", () => {
            return getNewSyncEngine().sync().then(() => {
                assert.ok(true, "sync complete");
            });
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   No other bookmarks

        it("remoteDeletesAreRemovedLocally", () => {
            let instapaperDB: InstapaperDB;
            let fakeAddedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return addLocalOnlyFakeBookmark(idb);
            }).then((added) => {
                fakeAddedBookmark = added;

                return getNewSyncEngine().sync({ bookmarks: true, folders: false, skipOrphanCleanup: true });
            }).then(() => {
                return WinJS.Promise.join({
                    bookmarks: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                    bookmark1: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const bookmark1NoLongerInUnread = data.bookmarks.some((bookmark) => {
                    return bookmark.bookmark_id === fakeAddedBookmark.bookmark_id;
                });
                assert.ok(!bookmark1NoLongerInUnread, "Bookmark was still found in unread");

                assert.strictEqual(data.bookmark1.folder_dbid, instapaperDB.commonFolderDbIds.orphaned, "Bookmark 1 not in orphaned folder");
                assert.strictEqual(data.bookmark1.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Bookmark 1 not in orphaned folder");

                return WinJS.Promise.join({
                    orphaned: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned),
                    bookmark1: data.bookmark1,
                });
            }).then((data) => {
                const bookmark1Present = data.orphaned.some((item) => {
                    return item.bookmark_id === data.bookmark1.bookmark_id;
                });

                assert.ok(bookmark1Present, "Bookmark 1 wasn't present in the orphaned folder");

                return instapaperDB.removeBookmark(data.bookmark1.bookmark_id, true);
            }).then(() => {
                return expectNoPendingBookmarkEdits(instapaperDB);
            });

        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   No other bookmarks

        it("alreadyDeletedBookmarkDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            let fakeAddedBookmark: IBookmark;
            let bookmarkToUpdateProgressFor: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return addLocalOnlyFakeBookmark(idb);
            }).then((added) => {
                fakeAddedBookmark = added;

                return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            }).then((currentBookmarks) => {
                currentBookmarks = currentBookmarks.filter((b) => {
                    return b.bookmark_id !== fakeAddedBookmark.bookmark_id;
                });

                assert.ok(currentBookmarks.length, "not enough bookmarks: " + currentBookmarks.length);

                bookmarkToUpdateProgressFor = currentBookmarks[0];

                return WinJS.Promise.join({
                    update: instapaperDB.updateReadProgress(bookmarkToUpdateProgressFor.bookmark_id, 0.2),
                    deleteBookmark: instapaperDB.removeBookmark(fakeAddedBookmark.bookmark_id),
                });
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                    removedLocally: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const remoteBookmark = data.remote.bookmarks.filter((b) => {
                    return b.bookmark_id === bookmarkToUpdateProgressFor.bookmark_id;
                })[0];

                assert.ok(remoteBookmark, "didn't find bookmark");
                assert.strictEqual(parseFloat(remoteBookmark.progress), 0.2, "Progress was incorrect");

                assert.ok(!data.removedLocally, "Didn't expect to be able to find the bookmark locally");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.2 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingLikeDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            let fakeAddedBookmark: IBookmark;
            let updatedBookmarkId: number;
            const progressValue = 0.3;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks();
            }).then((currentBookmarks) => {
                assert.ok(currentBookmarks.length, "not enough bookmarks");

                updatedBookmarkId = currentBookmarks[0].bookmark_id;

                return WinJS.Promise.join({
                    update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                    add: addLocalOnlyFakeBookmark(instapaperDB),
                });
            }).then((data) => {
                fakeAddedBookmark = data.add;

                return instapaperDB.likeBookmark(fakeAddedBookmark.bookmark_id);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                    local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const remote = data.remote.bookmarks.filter((b) => {
                    return b.bookmark_id === updatedBookmarkId;
                })[0];

                assert.ok(remote, "Didn't find remote bookmark");
                assert.strictEqual(parseFloat(remote.progress), progressValue, "Incorrect progress value");

                assert.ok(!data.local, "Shouldn't have been able to find local fake bookmark");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.3 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingUnlikeDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            let fakeAddedBookmark: IBookmark;
            let updatedBookmarkId: number;
            const progressValue = 0.4;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks();
            }).then((currentBookmarks) => {
                assert.ok(currentBookmarks.length, "not enough bookmarks");

                updatedBookmarkId = currentBookmarks[0].bookmark_id;

                return WinJS.Promise.join({
                    update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                    add: addLocalOnlyFakeBookmark(instapaperDB),
                });
            }).then((data) => {
                fakeAddedBookmark = data.add;

                return instapaperDB.unlikeBookmark(fakeAddedBookmark.bookmark_id);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                    local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const remote = data.remote.bookmarks.filter((b) => {
                    return b.bookmark_id === updatedBookmarkId;
                })[0];

                assert.ok(remote, "Didn't find remote bookmark");
                assert.strictEqual(parseFloat(remote.progress), progressValue, "Incorrect progress value");

                assert.ok(!data.local, "Shouldn't have been able to find local fake bookmark");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.4 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingMoveDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            const progressValue = 0.5;
            let updatedBookmarkId: number;
            let fakeAddedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addFolder({ title: Date.now() + "a" });
            }).then(() => {
                return getNewSyncEngine().sync({ folders: true });
            }).then(() => {
                return instapaperDB.listCurrentBookmarks();
            }).then((currentBookmarks) => {
                assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

                updatedBookmarkId = currentBookmarks[0].bookmark_id;

                return WinJS.Promise.join({
                    update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                    folders: instapaperDB.listCurrentFolders(),
                    added: addLocalOnlyFakeBookmark(instapaperDB),
                });
            }).then((data) => {
                fakeAddedBookmark = data.added;
                const currentFolders = data.folders.filter((f) => defaultFolderIds.indexOf(f.folder_id) === -1);

                return instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, currentFolders[0].id);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                    local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const remote = data.remote.bookmarks.filter((b) => {
                    return b.bookmark_id === updatedBookmarkId;
                })[0];

                assert.ok(remote, "didn't find updated remote bookmark");
                assert.strictEqual(parseFloat(remote.progress), progressValue, "Progress value was in correct");

                assert.ok(!data.local, "Didn't expect to find the bookmark locally");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        // State:
        //   One Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingArchiveDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            const progressValue = 0.5;
            let updatedBookmarkId: number;
            let fakeAddedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentBookmarks();
            }).then((currentBookmarks) => {
                assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

                updatedBookmarkId = currentBookmarks[0].bookmark_id;

                return WinJS.Promise.join({
                    update: instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                    added: addLocalOnlyFakeBookmark(instapaperDB),
                });
            }).then((data) => {
                fakeAddedBookmark = data.added;

                return instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    remote: (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                    local: instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
                });
            }).then((data) => {
                const remote = data.remote.bookmarks.filter((b) => {
                    return b.bookmark_id === updatedBookmarkId;
                })[0];

                assert.ok(remote, "didn't find updated remote bookmark");
                assert.strictEqual(parseFloat(remote.progress), progressValue, "Progress value was in correct");

                assert.ok(!data.local, "Didn't expect to find the bookmark locally");

                return expectNoPendingBookmarkEdits(instapaperDB);
            });
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedFolderWithPendingMoveDoesntFailSyncNotSyncingFolders", () => {
            let instapaperDB: InstapaperDB;
            let movedBookmark: IBookmark;
            let fakeFolder: IFolder;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return WinJS.Promise.join({
                    folder: idb.addFolder({
                        title: Date.now() + "a",
                        folder_id: "345234",
                    }, true),
                    bookmarks: idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                const bookmarks = data.bookmarks;
                assert.ok(bookmarks.length, "need some bookmarks to work with");

                movedBookmark = bookmarks[0];
                fakeFolder = data.folder;

                return instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id).then(() => {
                    return instapaperDB.listCurrentBookmarks(fakeFolder.id);
                });
            }).then((data) => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return WinJS.Promise.join({
                    bookmark: instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                    folder: instapaperDB.getFolderByDbId(fakeFolder.id),
                });
            }).then((data) => {
                assert.ok(data.bookmark, "Expected to get bookmark");
                assert.strictEqual(data.bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");

                assert.notStrictEqual(data.bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
                assert.notStrictEqual(data.bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");
            });
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedFolderWithPendingMoveDoesntFailSync", () => {
            let instapaperDB: InstapaperDB;
            let movedBookmark: IBookmark;
            let fakeFolder: IFolder;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return WinJS.Promise.join({
                    folder: idb.addFolder({
                        title: Date.now() + "a",
                        folder_id: Date.now() + "",
                    }, true),
                    bookmarks: idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                const bookmarks = data.bookmarks;
                assert.ok(bookmarks.length, "need some bookmarks to work with");

                movedBookmark = bookmarks[0];
                fakeFolder = data.folder;

                return instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id);
            }).then(() => {
                return getNewSyncEngine().sync();
            }).then(() => {
                return WinJS.Promise.join({
                    bookmark: instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                    folder: instapaperDB.getFolderByDbId(fakeFolder.id),
                });
            }).then((data) => {
                assert.ok(data.bookmark, "Expected to get bookmark");
                assert.strictEqual(data.bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");

                assert.notStrictEqual(data.bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
                assert.notStrictEqual(data.bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");

                assert.ok(!data.folder, "Didn't expect to find the folder");
            });
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedRemoteFolderCleansupState", () => {
            let instapaperDB: InstapaperDB;
            let fakeFolder: IFolder;
            let movedOutOfFakeFolderBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;


                return WinJS.Promise.join({
                    folder: idb.addFolder({
                        folder_id: "132456",
                        title: Date.now() + "a",
                    }, true),
                    bookmarks: idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                fakeFolder = data.folder;

                assert.ok(data.bookmarks.length > 1, "not enough bookmarks");

                movedOutOfFakeFolderBookmark = data.bookmarks.pop();

                // Move the bookmark into the fake destination folder
                return instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, fakeFolder.id, true);
            }).then(() => {
                // Create a pending edit to move it back to unread
                return instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, instapaperDB.commonFolderDbIds.unread);
            }).then(() => {
                return getNewSyncEngine().sync();
            }).then(() => {
                return WinJS.Promise.join({
                    bookmark: instapaperDB.getBookmarkByBookmarkId(movedOutOfFakeFolderBookmark.bookmark_id),
                    folder: instapaperDB.getFolderByDbId(fakeFolder.id),
                });
            }).then((data) => {
                assert.ok(data.bookmark, "Didn't get bookmark");
                assert.strictEqual(data.bookmark.bookmark_id, movedOutOfFakeFolderBookmark.bookmark_id, "Wrong bookmark");

                assert.strictEqual(data.bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Should be in unread folder");

                assert.ok(!data.folder, "Didn't expect to find the folder");
            });
        });

    });

    describe("InstapaperSyncMultipleBookmarkFolders", () => {
        beforeEach(testDelay);

        it("destroyRemoteData", destroyRemoteAccountData);
        it("addEnoughRemoteBookmarks", addDefaultBookmarks.bind(null, 0));
        it("deleteDb", deleteDb.bind(null, null));

        it("sprinkleBookmarksAcrossTwoNonDefaultFolders", () => {
            let instapaperDB: InstapaperDB;
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            // First we need to set up some remote data for multiple folder edits.
            // This really means moving some bookmarks into specific, known folders,
            // and then pending some edits locally to go up, come down etc

            // Add some folders to work with.
            return Codevoid.Utilities.serialize([
                Date.now() + "a",
                (Date.now() + 10) + "a",
            ], (item) => {
                return folders.add(item);
            }).then(() => {
                // Get the remote data, so we can manipulate it.
                return WinJS.Promise.join({
                    folders: folders.list(),
                    bookmarks: bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                });
            }).then((data) => {
                const bookmarkData = data.bookmarks.bookmarks;
                const folders = data.folders;

                assert.ok(bookmarkData.length > 1, "Not enough bookmarks");
                assert.ok(folders.length > 1, "Not enough folders");

                return Codevoid.Utilities.serialize([
                    { bookmark_id: bookmarkData[0].bookmark_id, destination: folders[0].folder_id },
                    { bookmark_id: bookmarkData[1].bookmark_id, destination: folders[1].folder_id },
                ], (item) => {
                    return bookmarks.move(item);
                });
            });
        });

        // Remote State:
        //   Two Folders
        //   One bookmark in each folder minimum
        // Local State:
        //   Empty

        it("syncsDownAllBookmarksInAllFolders", () => {
            let instapaperDB: InstapaperDB;
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const syncEngine = getNewSyncEngine();
            let startCount = 0;
            let endCount = 0;
            let foldersStarted = 0;
            let foldersEnded = 0;
            let foldersSynced = 0;
            let bookmarksStarted = 0;
            let bookmarksEnded = 0;
            let unknown = 0;

            syncEngine.addEventListener("syncstatusupdate", (e) => {
                const detail = e.detail;
                switch (detail.operation) {
                    case Codevoid.Storyvoid.InstapaperSyncStatus.start:
                        startCount++;
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.end:
                        endCount++;
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.foldersStart:
                        foldersStarted++;
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.foldersEnd:
                        foldersEnded++;
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.folder:
                        if (detail.title) {
                            foldersSynced++;
                        }
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksStart:
                        bookmarksStarted++;
                        break;

                    case Codevoid.Storyvoid.InstapaperSyncStatus.bookmarksEnd:
                        bookmarksEnded++;
                        break;

                    default:
                        unknown = 0;
                        break;
                }
            });

            return syncEngine.sync().then(() => {
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
            }).then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentFolders();
            }).then((currentFolders) => {
                const folders = currentFolders.filter((folder) => {
                    return (defaultFolderIds.indexOf(folder.folder_id) === -1);
                });

                assert.strictEqual(folders.length, 2, "Incorrect folders");

                return Codevoid.Utilities.serialize(folders, (folder) => {
                    return WinJS.Promise.join({
                        remoteBookmarks: bookmarks.list({ folder_id: folder.folder_id }),
                        localBookmarks: instapaperDB.listCurrentBookmarks(folder.id),
                    }).then((data) => {
                        const remoteBookmarks = data.remoteBookmarks.bookmarks;
                        const localBookmarks = data.localBookmarks;

                        remoteBookmarks.forEach((rb) => {
                            let localBookmarkIndex = -1;
                            const isFoundLocally = localBookmarks.some((lb, index) => {

                                if ((lb.bookmark_id === rb.bookmark_id)
                                    && (lb.folder_id === folder.folder_id)) {
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
        });

        // Remote State:
        //   Two Folders
        //   One bookmark in each folder
        // Local State:
        //   Two Folders
        //   One Bookmark in each folder

        it("syncsMovesUpFromAllFolders", () => {
            let instapaperDB: InstapaperDB;
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
            let bookmarkToMoveToUnread: IBookmark;
            let bookmarkToMoveToFolderA: IBookmark;
            let folderAFolderId: string;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentFolders();
            }).then((folders) => {
                folders = folders.filter((folder) => {
                    return (defaultFolderIds.indexOf(folder.folder_id) === -1);
                });

                folderAFolderId = folders[0].folder_id;

                return WinJS.Promise.join({
                    folderA: instapaperDB.listCurrentBookmarks(folders[0].id),
                    folderB: instapaperDB.listCurrentBookmarks(folders[1].id),
                });
            }).then((data) => {
                bookmarkToMoveToUnread = data.folderA[0];
                bookmarkToMoveToFolderA = data.folderB[0];

                return WinJS.Promise.join({
                    moveToUnread: instapaperDB.moveBookmark(bookmarkToMoveToUnread.bookmark_id, instapaperDB.commonFolderDbIds.unread),
                    moveToFolderA: instapaperDB.moveBookmark(bookmarkToMoveToFolderA.bookmark_id, bookmarkToMoveToUnread.folder_dbid),
                });
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return Codevoid.Utilities.serialize([
                    "",
                    folderAFolderId,
                ], (folder_id) => {
                    let param;
                    if (folder_id) {
                        param = { folder_id: folder_id };
                    }

                    return bookmarks.list(param);
                });
            }).then((data) => {
                const unreadBookmarks = data[0].bookmarks;
                const folderABookmarks = data[1].bookmarks;

                assert.notStrictEqual(unreadBookmarks.length, 0, "Only expected one bookmark in unread");
                assert.notStrictEqual(folderABookmarks.length, 0, "Only expected one bookmark in folderA");

                assert.strictEqual(unreadBookmarks[0].bookmark_id, bookmarkToMoveToUnread.bookmark_id, "Bookmark wasn't found in unread folder");
                assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Bookmark wasn't found in folder A");
            }).then((data) => {
                return WinJS.Promise.join({
                    unread: instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                    folderA: instapaperDB.listCurrentBookmarks(bookmarkToMoveToUnread.folder_dbid),
                });
            }).then((data) => {
                const unreadBookmarks = data.unread;
                const folderABookmarks = data.folderA;

                assert.ok(unreadBookmarks, "no unread bookmarks");
                assert.notStrictEqual(unreadBookmarks.length, 0, "Incorrect number of unread bookmarks");
                assert.ok(unreadBookmarks.some((b) => {
                    return b.bookmark_id === bookmarkToMoveToUnread.bookmark_id;
                }), "Moved Bookmark not found");

                assert.ok(folderABookmarks, "No folderA bookmarks");
                assert.notStrictEqual(folderABookmarks.length, 0, "Incorrect number of folder A bookmarks");
                assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Incorrect bookmark");
            });
        });

        // Remote & Local State:
        //   Two Folders
        //   One Unread Bookmark
        //   One Bookmark in a folder
        //   One Emptpy folder

        it("syncMovesIntoArchiveAndProgressIsUpdated", () => {
            let instapaperDB: InstapaperDB;
            let archivedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);
            }).then((bookmarks) => {
                archivedBookmark = bookmarks[0];

                return instapaperDB.moveBookmark(archivedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(archivedBookmark.bookmark_id);
            }).then((bookmark) => {
                return instapaperDB.updateReadProgress(bookmark.bookmark_id, 0.43);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
            }).then((remoteBookmarks) => {
                const inArchive = remoteBookmarks.bookmarks.filter((b) => {
                    return b.bookmark_id === archivedBookmark.bookmark_id;
                })[0];

                assert.ok(inArchive);
                assert.strictEqual(parseFloat(<any>inArchive.progress), 0.43, "Progress in correct");
            });
        });

        // State:
        //   Two Folders
        //   Bookmark in archive w/ non-zero progress
        //   One bookmark in a folder
        //   One Empty Folder

        it("syncingOnlyOneFolderDoesntEffectOthers", () => {
            let instapaperDB: InstapaperDB;
            let folderDbIdToSync: number;
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                // Find the bookmark in a non default folder
                return idb.listCurrentBookmarks();
            }).then((allBookmarks) => {
                const bookmarksInNonDefaultFolder = allBookmarks.filter((b) => {
                    return (defaultFolderIds.indexOf(b.folder_id) === -1);
                });

                assert.strictEqual(bookmarksInNonDefaultFolder.length, 1, "Only expected to find one bookmark");

                folderDbIdToSync = bookmarksInNonDefaultFolder[0].folder_dbid;
                return instapaperDB.updateReadProgress(bookmarksInNonDefaultFolder[0].bookmark_id, 0.93);
            }).then(() => {
                return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.archive);
            }).then((archivedBookmarks) => {
                return instapaperDB.updateReadProgress(archivedBookmarks[0].bookmark_id, 0.32);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true, folder: folderDbIdToSync, singleFolder: true });
            }).then(() => {
                return bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
            }).then((r) => {
                const remoteBookmarks = r.bookmarks;

                assert.strictEqual(parseFloat(<any>remoteBookmarks[0].progress), 0.43, "Incorrect progress on archive bookmark");

                return instapaperDB.getFolderByDbId(folderDbIdToSync);
            }).then((folder) => {
                return bookmarks.list({ folder_id: folder.folder_id });
            }).then((r) => {
                const remoteBookmarks = r.bookmarks;

                assert.strictEqual(parseFloat(<any>remoteBookmarks[0].progress), 0.93, "Incorrect progress on folder bookmark");

                return getNewSyncEngine().sync();
            });
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("orphanedItemsAreCleanedup", () => {
            let instapaperDB: InstapaperDB;
            let removedBookmarkId: number;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentBookmarks();
            }).then((allBookmarks) => {
                allBookmarks = allBookmarks.filter((b) => {
                    return defaultFolderIds.indexOf(b.folder_id) === -1;
                });

                const bookmark = allBookmarks[0];
                removedBookmarkId = bookmark.bookmark_id = bookmark.bookmark_id + 34;
                return instapaperDB.addBookmark(bookmark);
            }).then(() => {
                return getNewSyncEngine().sync({ bookmarks: true });
            }).then(() => {
                return instapaperDB.getBookmarkByBookmarkId(removedBookmarkId);
            }).then((removedBookmark) => {
                assert.ok(!removedBookmark, "Shouldn't be able to find bookmark");

                return instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned);
            }).then((orphanedBookmarks) => {
                assert.strictEqual(orphanedBookmarks.length, 0, "Didn't expect to find any orphaned bookmarks");
            });
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("supplyingFolderIdSyncsItBeforeOtherFolders", () => {
            let instapaperDB: InstapaperDB;
            let expectedFirstSyncedFolder: IFolder;
            const folderSyncOrder = [];

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentFolders();
            }).then((currentFolders) => {
                currentFolders = currentFolders.filter((folder) => {
                    return defaultFolderIds.indexOf(folder.id.toString()) === -1;
                });

                assert.notStrictEqual(currentFolders.length, 0, "Expected some folders");

                expectedFirstSyncedFolder = currentFolders[0];

                return getNewSyncEngine().sync({
                    bookmarks: true,
                    folderToSync: expectedFirstSyncedFolder.folder_dbid,
                    _testPerFolderCallback: (id) => {
                        folderSyncOrder.push(id);
                    },
                });
            }).then(() => {
                assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

                assert.strictEqual(folderSyncOrder[0], expectedFirstSyncedFolder.id, "Folder was not sync'd first");
            });
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("withNoPriorityFolderSuppliedUnreadSyncsFirst", () => {
            let instapaperDB: InstapaperDB;
            const folderSyncOrder = [];

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentFolders();
            }).then((currentFolders) => {
                return getNewSyncEngine().sync({
                    bookmarks: true,
                    _testPerFolderCallback: (id) => {
                        folderSyncOrder.push(id);
                    },
                });
            }).then(() => {
                assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

                assert.strictEqual(folderSyncOrder[0], instapaperDB.commonFolderDbIds.unread, "Folder was not sync'd first");
            });
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("syncingBookmarksForSingleNewLocalFolderStillSyncsTheFolderAdd", () => {
            let instapaperDB: InstapaperDB;
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const newFolderTitle = Date.now() + "a";
            let addedFolderDbId: number;
            let movedBookmark: IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return WinJS.Promise.join({
                    add: idb.addFolder({ title: newFolderTitle }),
                    bookmarks: idb.listCurrentBookmarks(),
                });
            }).then((data) => {
                addedFolderDbId = data.add.id;
                const bookmarks = data.bookmarks.filter((b) => {
                    return defaultFolderIds.indexOf(b.folder_id) === -1;
                });

                movedBookmark = bookmarks[0];
                return instapaperDB.moveBookmark(movedBookmark.bookmark_id, data.add.id);
            }).then(() => {
                return getNewSyncEngine().sync({
                    bookmarks: true,
                    folder: addedFolderDbId,
                    singleFolder: true,
                });
            }).then(() => {
                return folders.list();
            }).then((remoteFolders) => {
                const addedFolder = remoteFolders.filter((f) => f.title === newFolderTitle)[0];

                assert.ok(addedFolder, "Didn't find the added folder remotely");

                return bookmarks.list({ folder_id: addedFolder.folder_id });
            }).then((r) => {
                const folderBookmarks = r.bookmarks;

                assert.strictEqual(folderBookmarks.length, 1, "Expected only one bookmark");
                assert.strictEqual(folderBookmarks[0].bookmark_id, movedBookmark.bookmark_id, "Incorrect bookmark");
            });
        });

        // State:
        //   Three Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   Two Empty Folders

        //it("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);

    });
}