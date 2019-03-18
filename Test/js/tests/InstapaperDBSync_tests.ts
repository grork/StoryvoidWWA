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

    function destroyRemoteAccountData(this: Mocha.Context): PromiseLike<void> {
        this.timeout(60000);
        return InstapaperTestUtilities.destroyRemoteAccountData(clientInformation);
    }

    function testDelay(): PromiseLike<void> {
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

    async function addDefaultRemoteFolders(): Promise<void> {
        setSampleFolders();
        const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        try {
            const remoteFolders = await folders.list();
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

            await Codevoid.Utilities.serialize(addedRemoteFolders, async (folder, index) => {
                if (folder.folder_id !== undefined) {
                    // assume we've already got the info
                    return;
                }

                const remoteFolder = await folders.add(folder.title);
                addedRemoteFolders[index] = remoteFolder;
            });
        } catch (errors) {
            let foundNonAlreadyThereError = false;
            foundNonAlreadyThereError = errors.some((item) => (item.error != undefined) && (item.error === 1251));

            assert.ok(!foundNonAlreadyThereError, "Unexpected error when adding folders");
        }
    }

    async function addsFoldersOnFirstSight(): Promise<void> {
        const sync = getNewSyncEngine();

        await sync.sync({ folders: true });
        const instapaperDB = await getNewInstapaperDBAndInit();
        const folders = await instapaperDB.listCurrentFolders();
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

        await expectNoPendingFolderEdits(instapaperDB);
    }

    async function addDefaultBookmarks(neededBookmarks: number): Promise<void> {
        const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const minNumberOfBookmarks = neededBookmarks || 2;
        resetSourceUrls();

        // Get the remote bookmarks so we can add, update, cache etc as needed
        let result = await bookmarksApi.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
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
        if (!remoteBookmarks || remoteBookmarks.length < minNumberOfBookmarks) {
            // We dont have enough remote Bookmarks, so lets add more.
            let needToAdd = minNumberOfBookmarks;
            if (remoteBookmarks && remoteBookmarks.length) {
                needToAdd -= remoteBookmarks.length;
            }

            const adds = [];

            for (let i = 0; i < needToAdd; i++) {
                adds.push(sourceUrls.shift());
            }

            await Codevoid.Utilities.serialize(adds, async (url: Codevoid.Storyvoid.InstapaperApi.IBookmarkAddParameters) => {
                const added = await bookmarksApi.add(url);
                remoteBookmarks.push(added);
            });
        }

        assert.ok(remoteBookmarks, "Didn't get list of current remote bookmarks");
        addedRemoteBookmarks = remoteBookmarks;
        assert.ok(addedRemoteBookmarks, "No remotebookmarks!");
        assert.ok(addedRemoteBookmarks.length, "No remote bookmarks!");

        result = await bookmarksApi.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked })
        // Reset all remote likes.
        await Codevoid.Utilities.serialize(result.bookmarks, (item) => bookmarksApi.unstar(item.bookmark_id));
    }

    describe("InstapaperSync", () => {
        beforeEach(testDelay);
        it("destoryRemoteDataOnStart", destroyRemoteAccountData);

        it("deleteDbOnStart", deleteDb.bind(null, null));

        it("addDefaultRemoteFolders", addDefaultRemoteFolders);

        it("addsFoldersOnFirstSight", addsFoldersOnFirstSight);

        it("differentFolderTitleOnServerIsSyncedToDB",  async () => {
            const sync = getNewSyncEngine();
            const targetRemoteFolder = addedRemoteFolders[0];
            const instapaperDB = await getNewInstapaperDBAndInit();

            let localFolder = await instapaperDB.getFolderFromFolderId(targetRemoteFolder.folder_id);
            localFolder.title = Date.now() + "a";

            const updatedFolder = await instapaperDB.updateFolder(localFolder)
            assert.ok(updatedFolder, "Didn't get updated folder");
            assert.notStrictEqual(updatedFolder.title, targetRemoteFolder.title, "Title didn't change");

            await sync.sync({ folders: true });
            localFolder = await instapaperDB.getFolderFromFolderId(targetRemoteFolder.folder_id);
            assert.strictEqual(localFolder.title, targetRemoteFolder.title, "Title did not correctly sync");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("removedFolderOnServerIsDeletedLocallyOnSync", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const fakeFolder = {
                title: "foo",
                folder_id: "foo_1",
            };

            const folder = await instapaperDB.addFolder(fakeFolder, true);
            let addedFolder = await instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            assert.ok(addedFolder, "Didn't get added folder");
            assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
            assert.ok(!!addedFolder.id, "Folder didn't have DB id");

            await sync.sync({ folders: true });
            addedFolder = await instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            assert.ok(!addedFolder, "Shouldn't have gotten the folder. It should have been removed");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("removedAndAddedFoldersOnServerAreCorrectlySynced", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const fakeFolder: IFolder = {
                title: "foo",
                folder_id: "foo_1",
            };

            const newRemoteFolder: IFolder = {
                title: Date.now() + "a", // now() is an integer. It comes back as a string, Just make it a damn string
            };

            const folder = await instapaperDB.addFolder(fakeFolder, true);
            const addedFolder = await instapaperDB.getFolderFromFolderId(fakeFolder.folder_id);
            assert.ok(addedFolder, "Didn't get added folder");
            assert.strictEqual(addedFolder.folder_id, fakeFolder.folder_id, "Not the correct folder");
            assert.ok(!!addedFolder.id, "Folder didn't have DB id");

            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

            // Add a non-local folder to syncdown at the same time.
            const addedRemoteFolder = await folders.add(newRemoteFolder.title);
            newRemoteFolder.folder_id = addedRemoteFolder.folder_id;

            await sync.sync({ folders: true });
            const [deleted, added] = await Promise.all([
                instapaperDB.getFolderFromFolderId(fakeFolder.folder_id),
                instapaperDB.getFolderFromFolderId(newRemoteFolder.folder_id),
            ]);

            assert.ok(!deleted, "Shouldn't have gotten the folder. It should have been removed");

            assert.ok(added, "Didn't find added folder");
            assert.strictEqual(added.folder_id, newRemoteFolder.folder_id, "Not correct folder ID");
            assert.strictEqual(added.title, newRemoteFolder.title, "Incorrect title");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("pendedAddsAreUploaded", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            let newFolder: IFolder = { title: Date.now() + "a", };

            newFolder = await instapaperDB.addFolder(newFolder);
            assert.ok(!!newFolder.id, "need folder id to find it later");

            await sync.sync({ folders: true });
            const remoteFolders = await (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).list();
            const localFolderWasSynced = remoteFolders.some((item) => item.title === newFolder.title);

            assert.ok(localFolderWasSynced, "Local folder was not found on the server");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("foldersGetUpdatedFolderIdsWhenUploaded", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            let newFolder: IFolder = { title: Date.now() + "a", };

            newFolder = await instapaperDB.addFolder(newFolder);
            assert.ok(!!newFolder.id);
            assert.strictEqual(newFolder.folder_id, undefined, "Shouldn't have had a folder id yet.");

            const pendingEdits = await instapaperDB.getPendingFolderEdits();
            assert.strictEqual(pendingEdits.length, 1, "Only expected one pending edit");

            await sync.sync({ folders: true });
            const syncedFolder = await instapaperDB.getFolderByDbId(newFolder.id);
            assert.ok(!!syncedFolder.folder_id, "Didn't find a folder ID");
            addedRemoteFolders.push(syncedFolder);
            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("sameFolderRemoteAndLocalButUnsynced", async () => {
            interface ISpecialFolder extends IFolder {
                cookie: boolean;
            }

            let local: ISpecialFolder = {
                title: Date.now() + "a",
                cookie: true
            };
            let remote: IFolder = { title: local.title }; // make sure the remote is the same
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            [local, remote] = await Promise.all([
                <Promise<ISpecialFolder>>instapaperDB.addFolder(local),
                (new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation)).add(remote.title),
            ]);

            await sync.sync({ folders: true });
            await expectNoPendingFolderEdits(instapaperDB);
            const localFolder = <ISpecialFolder>await instapaperDB.getFolderByDbId(local.id);

            assert.ok(localFolder, "Didn't find the local folder");
            assert.strictEqual(localFolder.folder_id, remote.folder_id, "Folder ID didn't match the local folder");
            assert.strictEqual(localFolder.title, remote.title, "Folder title didn't match");
            assert.ok(localFolder.cookie, "Cookie was not present on the DB folder. Data Squashed?");
        });

        it("pendedDeletesAreUploaded", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

            let [local, remoteFolders] = await Promise.all([
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                folders.list(),
            ]);
            assert.ok(!!local.id, "need folder id to delete");
            assert.ok(remoteFolders.some((item) => {
                return item.folder_id === local.folder_id;
            }), "Folder to delete wasn't present remotely");

            return instapaperDB.removeFolder(local.id);
            await sync.sync({ folders: true });

            [remoteFolders, local] = await Promise.all([
                folders.list(),
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
            ]);

            assert.ok(!remoteFolders.some((item) => {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!local, "Local folder should be missing");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("deletedLocallyAndRemotelySyncsSuccessfully", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

            let [local, remoteFolders] = await Promise.all([
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                folders.list(),
            ]);

            assert.ok(!!local.id, "need folder id to delete");
            assert.ok(remoteFolders.some((item) => {
                return item.folder_id === local.folder_id;
            }), "Folder to delete wasn't present remotely");

            await Promise.all([
                instapaperDB.removeFolder(local.id),
                folders.deleteFolder(local.folder_id),
            ]);

            await sync.sync({ folders: true });

            [remoteFolders, local] = await Promise.all([
                folders.list(),
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
            ]);

            assert.ok(!remoteFolders.some((item) => {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!local, "Local folder should be missing");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("pendedDeletesAndAddsSyncUp", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetFolder = addedRemoteFolders.pop();
            const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            let newFolder: IFolder = { title: Date.now() + "a" };

            const [toRemove, toAdd, remoteFolders] = await Promise.all([
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                instapaperDB.addFolder(newFolder),
                folders.list(),
            ]);

            assert.ok(!!toRemove.id, "need folder id to delete");
            assert.ok(remoteFolders.some((item) => {
                return item.folder_id === toRemove.folder_id;
            }), "Folder to delete wasn't present remotely");

            assert.ok(toAdd, "Didn't get added folder");
            assert.ok(toAdd.id, "Didn't have an ID");
            newFolder = toAdd;

            await instapaperDB.removeFolder(toRemove.id);
            await sync.sync({ folders: true });

            const [remoteFolders2, removed, added] = await Promise.all([
                folders.list(),
                instapaperDB.getFolderFromFolderId(targetFolder.folder_id),
                instapaperDB.getFolderByDbId(newFolder.id),
            ]);

            assert.ok(!remoteFolders2.some((item) => {
                return item.folder_id === targetFolder.folder_id;
            }), "Item shouldn't have been found remotely");

            assert.ok(!removed, "Local folder should be missing");

            assert.ok(added, "Didn't get added folder. It got lost");
            addedRemoteFolders.push(added);

            await expectNoPendingFolderEdits(instapaperDB);
        });
    });

    describe("InstapaperSyncBookmarks", () => {
        beforeEach(testDelay);

        it("destoryRemoteDataBeforeBookmarks", destroyRemoteAccountData);
        it("deleteDbBeforeBookmarks", deleteDb.bind(null, null));
        it("addDefaultRemoteFoldersBeforeBookmarks", addDefaultRemoteFolders);
        it("addsFoldersOnFirstSightBeforeBookmarks", addsFoldersOnFirstSight);

        it("addDefaultBookmarks", addDefaultBookmarks.bind(null, 0));

        it("bookmarksAddedOnFirstSight", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            await sync.sync({ bookmarks: true });

            const [bookmarks, expectedBookmarks] = await Promise.all([
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
            ]);

            assert.ok(bookmarks, "Didn't get any bookmarks");
            assert.strictEqual(bookmarks.length, addedRemoteBookmarks.length, "Didn't get enough bookmarks");

            // Check all the bookmarks are correctly present.
            assert.ok(expectedBookmarks.bookmarks.length, "Should have added some test pages to check");

            const allInUnread = bookmarks.every((item) => {
                let expectedBookmarkIndex = -1;
                expectedBookmarks.bookmarks.forEach((bookmark, index) => {
                    if (bookmark.url === item.url) {
                        expectedBookmarkIndex = index;
                    }
                });

                if (expectedBookmarkIndex !== -1) {
                    expectedBookmarks.bookmarks.splice(expectedBookmarkIndex, 1);
                }

                return item.folder_dbid === instapaperDB.commonFolderDbIds.unread;
            });

            assert.ok(allInUnread, "Some of the sync'd bookmarks were not in the unread folder");
            assert.strictEqual(expectedBookmarks.bookmarks.length, 0, "Some bookmarks were not found");

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

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("syncingOnlyFoldersOnlySyncsFolders", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const addedFolderName = Date.now() + "a";

            const f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const [addedFolder, bookmarkAdd] = await Promise.all([
                f.add(addedFolderName),
                b.add(sourceUrls.shift()),
            ])

            addedRemoteBookmarks.push(bookmarkAdd);

            let [folders, bookmarks] = await Promise.all([
                instapaperDB.listCurrentFolders(),
                instapaperDB.listCurrentBookmarks(),
            ]);

            const currentBookmarkCount = bookmarks.length;
            const currentFolderCount = folders.length;

            await sync.sync({ folders: true, bookmarks: false });

            [folders, bookmarks] = await Promise.all([
                instapaperDB.listCurrentFolders(),
                instapaperDB.listCurrentBookmarks(),
            ]);

            assert.strictEqual(folders.length, currentFolderCount + 1, "Incorrect number of folders");

            assert.ok(folders.some((folder) => {
                return folder.title === addedFolderName;
            }), "Didn't find the added folder locally");

            assert.strictEqual(bookmarks.length, currentBookmarkCount, "Incorrect number of bookmarks");

            const folder = await instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
            addedRemoteFolders.push(folder);
        });

        it("syncingOnlyBookmarksOnlySyncsBookmarks", async () => {
            const sync = getNewSyncEngine();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const addedFolderName = Date.now() + "a";

            const f = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const b = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const addedFolder = await f.add(addedFolderName);

            let [folders, bookmarks] = await Promise.all([
                instapaperDB.listCurrentFolders(),
                instapaperDB.listCurrentBookmarks(),
            ]);

            const currentBookmarkCount = bookmarks.length;
            const currentFolderCount = folders.length;

            await sync.sync({ folders: false, bookmarks: true });

            [folders, bookmarks] = await Promise.all([
                instapaperDB.listCurrentFolders(),
                instapaperDB.listCurrentBookmarks(),
            ]);

            assert.strictEqual(folders.length, currentFolderCount, "Incorrect number of folders");
            assert.strictEqual(bookmarks.length, currentBookmarkCount + 1, "Incorrect number of bookmarks");

            assert.ok(bookmarks.some((bookmark) => {
                return bookmark.url === addedRemoteBookmarks[addedRemoteBookmarks.length - 1].url;
            }), "Didn't find the expected bookmark");

            await sync.sync();

            const folder = await instapaperDB.getFolderFromFolderId(addedFolder.folder_id);
            addedRemoteFolders.push(folder);
        });

        it("locallyAddedBookmarksGoUpToUnread", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetUrl = sourceUrls.shift().url;
            const targetTitle = Date.now() + "a";

            await instapaperDB.addUrl({ url: targetUrl, title: targetTitle });
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });

            const [rb, lb] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
            ]);

            const remoteBookmark = rb.bookmarks.filter((f) => f.url === targetUrl)[0];
            assert.ok(remoteBookmark, "Didn't find the remote bookmark added");
            assert.strictEqual(remoteBookmark.title, targetTitle, "Remote title was incorrect");

            const addedBookmark = lb.filter((f) => f.url === targetUrl)[0];
            assert.ok(addedBookmark, "Didn't see the added folder locally");
            assert.strictEqual(addedBookmark.title, targetTitle, "Local title was incorrect");

            addedRemoteBookmarks.push(addedBookmark);

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("syncingBookmarkThatIsAlreadyAvailableRemotelyDoesntDuplicate", async () => {
            const targetTitle = Date.now() + "a";
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const current = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            const targetBookmark = current.shift();
            const [added, localBookmarks] = await Promise.all([
                instapaperDB.addUrl({ url: targetBookmark.url, title: targetTitle }),
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
            ]);

            const localBookmarkCountBeforeSync = localBookmarks.length;
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });
            const lb = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);

            assert.strictEqual(lb.length, localBookmarkCountBeforeSync, "Didn't expect any change in the bookmark counts");
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("remoteProgressChangesAreCorrectlySyncedLocally", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            let bookmark = localBookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            assert.notStrictEqual(bookmark.progress, 0.5, "Progress is already where we're going to set it");
            const updatedBookmark = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).updateReadProgress({
                bookmark_id: bookmark.bookmark_id,
                progress: 0.5,
                progress_timestamp: Date.now(),
            });

            await getNewSyncEngine().sync({ bookmarks: true, folders: false });
            bookmark = await instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            assert.equal(bookmark.progress, updatedBookmark.progress, "Progress did not match");
            assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Wrong bookmark timestamp");
            assert.strictEqual(bookmark.hash, updatedBookmark.hash, "hashes were incorrrect");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("likedRemoteBookmarkUpdatedLocallyAfterSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            let bookmark = localBookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            assert.notStrictEqual(bookmark.starred, 1, "Bookmark was already liked. We need  it to not be");

            bookmark = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).star(bookmark.bookmark_id);
            bookmark.starred = parseInt(<any>bookmark.starred);
            const updatedBookmark = bookmark;
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });

            bookmark = await instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            assert.strictEqual(bookmark.starred, 1, "Liked status did not match");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("unlikedRemoteBookmarkUpdatedLocallyAfterSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            const bookmark = localBookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            if (bookmark.starred === 0) {
                await instapaperDB.likeBookmark(bookmark.bookmark_id, true);
            }

            let updatedBookmark = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).unstar(bookmark.bookmark_id);
            bookmark.starred = parseInt(<any>bookmark.starred);
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });

            updatedBookmark = await instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            assert.strictEqual(updatedBookmark.starred, 0, "Liked status did not match");
        });

        it("localLikesAreSyncedToService", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetBookmark = addedRemoteBookmarks.shift();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const [local, remoteLikes] = await Promise.all([
                instapaperDB.likeBookmark(targetBookmark.bookmark_id),
                bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked }),
            ]);

            addedRemoteBookmarks.push(local);

            const likedAlready = remoteLikes.bookmarks.some((bookmark) => {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && ((<any>bookmark.starred) === "1");
            });

            assert.ok(!likedAlready, "Bookmark was already liked on the service");

            await getNewSyncEngine().sync({ bookmarks: true, folders: false });
            const data = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
            const likedRemotely = data.bookmarks.some((bookmark) => {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === <any>"1");
            });

            assert.ok(likedRemotely, "Item was not liked on the server");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("localLnlikesAreSyncedToService", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetBookmark = addedRemoteBookmarks.pop();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            if (targetBookmark.starred === 0) {
                // Force the desired state of a liked item
                await Promise.all([
                    instapaperDB.likeBookmark(targetBookmark.bookmark_id, true),
                    bookmarks.star(targetBookmark.bookmark_id),
                ]);
            }

            //  Now like it unlike it locally (to queue up the change)
            const [local, remoteLikes] = await Promise.all([
                instapaperDB.unlikeBookmark(targetBookmark.bookmark_id),
                bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked }),
            ]);
            addedRemoteBookmarks.push(local);

            const likedAlready = remoteLikes.bookmarks.some((bookmark) => {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && ((<any>bookmark.starred) === "1");
            });
            assert.ok(likedAlready, "Bookmark wasnt already liked on the service");

            await getNewSyncEngine().sync({ bookmarks: true, folders: false });
            const data = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
            const likedRemotely = data.bookmarks.some((bookmark) => {
                return (bookmark.bookmark_id === targetBookmark.bookmark_id) && (bookmark.starred === <any>"1");
            });
            assert.ok(!likedRemotely, "Item was liked on the server");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("remoteTitleAndDescriptionChangesComeDownLocally", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const bookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            const bookmark = bookmarks[0];
            assert.ok(bookmark, "Need a bookmark to work with");

            bookmark.title = "updatedTitle" + Date.now();
            bookmark.description = "updatedDescription" + Date.now();

            const updatedBookmark = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).add(<Codevoid.Storyvoid.InstapaperApi.IBookmarkAddParameters>bookmark);
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });

            const localBookmark = await instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id);
            assert.strictEqual(localBookmark.title, updatedBookmark.title, "Incorrect title");
            assert.strictEqual(localBookmark.description, updatedBookmark.description);
        });

        it("localReadProgressIsPushedUp", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetProgress = Math.round(Math.random() * 100) / 100;

            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            let bookmarkToUpdate = localBookmarks[0];
            assert.ok(bookmarkToUpdate, "need a bookmark to work with");

            assert.notStrictEqual(bookmarkToUpdate.progress, targetProgress, "Progress is already at the target value");

            const updatedBookmark = await instapaperDB.updateReadProgress(bookmarkToUpdate.bookmark_id, targetProgress);

            await getNewSyncEngine().sync({ bookmarks: true, folders: false });

            let [remoteBookmarks, localBookmark] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                instapaperDB.getBookmarkByBookmarkId(updatedBookmark.bookmark_id),
            ]);

            const bookmark = remoteBookmarks.bookmarks.filter((remote) => {
                return remote.bookmark_id === updatedBookmark.bookmark_id;
            })[0];

            assert.ok(bookmark, "Didn't find the remote bookmark");

            assert.equal(bookmark.progress, updatedBookmark.progress, "Progress was unchanged");
            assert.strictEqual(bookmark.progress_timestamp, updatedBookmark.progress_timestamp, "Timestamp for last progress changed was incorrect");
            assert.strictEqual(bookmark.hash, localBookmark.hash, "Hash wasn't updated locally");
        });

        it("archivesAreMovedToArchiveFolder", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetBookmark: IBookmark = addedRemoteBookmarks.shift() || <any>{};

            await instapaperDB.moveBookmark(targetBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
            await getNewSyncEngine().sync();
            const remoteBookmarks = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
            const remote = remoteBookmarks.bookmarks.filter((bookmark) => {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];

            assert.ok(remote, "Bookmark wasn't moved to archive remotely");
            addedRemoteBookmarks.push(remote);

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("movesMoveToAppropriateFolder", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetBookmark = addedRemoteBookmarks.shift();

            let newFolder = await instapaperDB.addFolder({ title: Date.now() + "a" });
            await instapaperDB.moveBookmark(targetBookmark.bookmark_id, newFolder.id);
            await getNewSyncEngine().sync();
            newFolder = await instapaperDB.getFolderByDbId(newFolder.id);
            addedRemoteFolders.push(newFolder);

            const remoteBookmarks = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: newFolder.folder_id });
            const remote = remoteBookmarks.bookmarks.filter((bookmark) => {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            })[0];
            addedRemoteBookmarks.push(remote);
            assert.ok(remote, "Bookmark wasn't moved to archive remotely");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("localDeletesGoUpToTheServer", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const targetBookmark = addedRemoteBookmarks.shift();

            await instapaperDB.removeBookmark(targetBookmark.bookmark_id);
            await getNewSyncEngine().sync({ bookmarks: true, folders: false });
            const data = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
            const bookmarkFoundRemotely = data.bookmarks.some((bookmark) => {
                return bookmark.bookmark_id === targetBookmark.bookmark_id;
            });

            assert.ok(!bookmarkFoundRemotely, "Found the bookmark remotely. It should have been deleted");
            sourceUrls.push({ url: targetBookmark.url });

            await expectNoPendingBookmarkEdits(instapaperDB);
        });
    });

    describe("InstapaperSyncLimits", () => {
        beforeEach(testDelay);

        it("deleteLocalDBBeforeSyncingWithLimits", deleteDb.bind(null, null));
        it("addEnoughRemoteBookmarks", addDefaultBookmarks.bind(null, 0));

        it("syncRespectsLimits", async () => {
            const sync = getNewSyncEngine();
            sync.perFolderBookmarkLimits = {};
            sync.defaultBookmarkLimit = 1;

            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
            const rb = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
            assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.bookmarks.length);

            await sync.sync();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
        });

        it("syncingOnlyOneBookmarkWithOneLikeNotInOneBookmarkBoundaryDoesn'tFailSync", async () => {
            const sync = getNewSyncEngine();
            sync.perFolderBookmarkLimits = {};
            sync.defaultBookmarkLimit = 1;

            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            const rb = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
            assert.ok(rb.bookmarks.length > 1, "Not enough Bookmarks remotely: " + rb.bookmarks.length);

            const lastBookmark = rb.bookmarks[rb.bookmarks.length - 1];

            await bookmarks.star(lastBookmark.bookmark_id);
            await sync.sync();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const localBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            assert.strictEqual(localBookmarks.length, 1, "Only expected on bookmark");
            assert.strictEqual(localBookmarks[0].starred, 0, "Didn't expect it to be starred");
        });

        // We need to clean up before we futz with more limits
        it("deleteLocalDBBeforeSyncingWithLimits", deleteDb.bind(null, null));
        it("addEnoughRemoteBookmarks", () => addDefaultBookmarks(8));
        it("addDefaultRemoteFolders", addDefaultRemoteFolders);

        it("perFolderLimitsOnBookmarksAreApplied", async () => {
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

            const rb = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });
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

            await Promise.all([moves, moves2]);
            await sync.sync();
            const instapaperDB = await getNewInstapaperDBAndInit();
            const [unread, folder1, folder2] = await Promise.all([
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                instapaperDB.listCurrentFolders().then((folders) => {
                    folders = folders.filter((folder) => {
                        return folder.folder_id === remoteFolder1;
                    });

                    return instapaperDB.listCurrentBookmarks(folders[0].id);
                }),
                instapaperDB.listCurrentFolders().then((folders) => {
                    folders = folders.filter((folder) => {
                        return folder.folder_id === remoteFolder2;
                    });

                    return instapaperDB.listCurrentBookmarks(folders[0].id);
                }),
            ]);

            assert.strictEqual(unread.length, 1, "Only expected on bookmark");
            assert.strictEqual(folder1.length, 2, "Only expected two out of three bookmarks synced");
            assert.strictEqual(folder2.length, 2, "Only expected two out of three bookmarks synced");
        });
    });

    describe("InstapaperSyncBookmarkDeletes", () => {
        beforeEach(testDelay);

        it("resetRemoteDataBeforePerformingDeletes", destroyRemoteAccountData);
        it("ensureHaveEnoughRemotebookmarks", addDefaultBookmarks.bind(null, 0));
        it("deleteLocalDbBeforeDeletes", deleteDb.bind(null, null));

        function addLocalOnlyFakeBookmark(instapaperDB: InstapaperDB): PromiseLike<IBookmark> {
            const fakeBookmarkToAdd = {
                bookmark_id: Date.now(),
                url: "http://notreal.com",
                title: "Test",
                folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
                folder_dbid: instapaperDB.commonFolderDbIds.unread,
            };

            return instapaperDB.addBookmark(fakeBookmarkToAdd);
        }

        it("syncDefaultState", async () => {
            await getNewSyncEngine().sync();
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   No other bookmarks

        it("remoteDeletesAreRemovedLocally", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const fakeAddedBookmark = await addLocalOnlyFakeBookmark(instapaperDB);
            await getNewSyncEngine().sync({ bookmarks: true, folders: false, skipOrphanCleanup: true });

            const [bookmarks, bookmark1] = await Promise.all([
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);

            const bookmark1NoLongerInUnread = bookmarks.some((bookmark) => {
                return bookmark.bookmark_id === fakeAddedBookmark.bookmark_id;
            });
            assert.ok(!bookmark1NoLongerInUnread, "Bookmark was still found in unread");

            assert.ok(!!bookmark1, "Fake bookmark should have been found in orphaned folder");
            assert.strictEqual(bookmark1.folder_dbid, instapaperDB.commonFolderDbIds.orphaned, "Bookmark 1 not in orphaned folder");
            assert.strictEqual(bookmark1.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Bookmark 1 not in orphaned folder");

            const orphaned = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned);
            const bookmark1Present = orphaned.some((item) => {
                return item.bookmark_id === bookmark1.bookmark_id;
            });

            assert.ok(bookmark1Present, "Bookmark 1 wasn't present in the orphaned folder");

            await instapaperDB.removeBookmark(bookmark1.bookmark_id, true);
            await expectNoPendingBookmarkEdits(instapaperDB);

        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   No other bookmarks

        it("alreadyDeletedBookmarkDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const fakeAddedBookmark = await addLocalOnlyFakeBookmark(instapaperDB);
            let currentBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            currentBookmarks = currentBookmarks.filter((b) => {
                return b.bookmark_id !== fakeAddedBookmark.bookmark_id;
            });

            assert.ok(currentBookmarks.length, "not enough bookmarks: " + currentBookmarks.length);

            const bookmarkToUpdateProgressFor = currentBookmarks[0];

            await Promise.all([
                instapaperDB.updateReadProgress(bookmarkToUpdateProgressFor.bookmark_id, 0.2),
                instapaperDB.removeBookmark(fakeAddedBookmark.bookmark_id),
            ]);
            await getNewSyncEngine().sync({ bookmarks: true });
            const [remote, removedLocally] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);

            const remoteBookmark = remote.bookmarks.filter((b) => {
                return b.bookmark_id === bookmarkToUpdateProgressFor.bookmark_id;
            })[0];

            assert.ok(remoteBookmark, "didn't find bookmark");
            assert.strictEqual(parseFloat(<any>remoteBookmark.progress), 0.2, "Progress was incorrect");

            assert.ok(!removedLocally, "Didn't expect to be able to find the bookmark locally");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.2 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingLikeDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const progressValue = 0.3;

            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks.length, "not enough bookmarks");

            const updatedBookmarkId = currentBookmarks[0].bookmark_id;

            const [update, fakeAddedBookmark] = await Promise.all([
                instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                addLocalOnlyFakeBookmark(instapaperDB),
            ]);

            await instapaperDB.likeBookmark(fakeAddedBookmark.bookmark_id);
            await getNewSyncEngine().sync({ bookmarks: true });
            let [remoteResult, local] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);
            const remote = remoteResult.bookmarks.filter((b) => {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "Didn't find remote bookmark");
            assert.strictEqual(parseFloat(<any>remote.progress), progressValue, "Incorrect progress value");

            assert.ok(!local, "Shouldn't have been able to find local fake bookmark");

            return expectNoPendingBookmarkEdits(instapaperDB);
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.3 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingUnlikeDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const progressValue = 0.4;

            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks.length, "not enough bookmarks");

            const updatedBookmarkId = currentBookmarks[0].bookmark_id;

            const [update, fakeAddedBookmark] = await Promise.all([
                instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                addLocalOnlyFakeBookmark(instapaperDB),
            ]);

            await instapaperDB.unlikeBookmark(fakeAddedBookmark.bookmark_id);
            await getNewSyncEngine().sync({ bookmarks: true });

            const [remoteResult, local] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);

            const remote = remoteResult.bookmarks.filter((b) => {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "Didn't find remote bookmark");
            assert.strictEqual(parseFloat(<any>remote.progress), progressValue, "Incorrect progress value");
            assert.ok(!local, "Shouldn't have been able to find local fake bookmark");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        // State:
        //   No Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.4 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingMoveDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const progressValue = 0.5;

            await instapaperDB.addFolder({ title: Date.now() + "a" });
            await getNewSyncEngine().sync({ folders: true });
            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

            const updatedBookmarkId = currentBookmarks[0].bookmark_id;

            const [u, folders, fakeAddedBookmark] = await Promise.all([
                instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                instapaperDB.listCurrentFolders(),
                addLocalOnlyFakeBookmark(instapaperDB),
            ]);

            const currentFolders = folders.filter((f) => defaultFolderIds.indexOf(f.folder_id) === -1);
            await instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, currentFolders[0].id);
            await getNewSyncEngine().sync({ bookmarks: true });

            const [remoteResult, local] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);
            const remote = remoteResult.bookmarks.filter((b) => {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "didn't find updated remote bookmark");
            assert.strictEqual(parseFloat(<any>remote.progress), progressValue, "Progress value was in correct");

            assert.ok(!local, "Didn't expect to find the bookmark locally");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        // State:
        //   One Folders
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("alreadyDeletedBookmarkWithPendingArchiveDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const progressValue = 0.5;

            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks.length, "Didn't have enough bookmarks");

            const updatedBookmarkId = currentBookmarks[0].bookmark_id;

            const [_, fakeAddedBookmark] = await Promise.all([
                instapaperDB.updateReadProgress(updatedBookmarkId, progressValue),
                addLocalOnlyFakeBookmark(instapaperDB),
            ]);

            await instapaperDB.moveBookmark(fakeAddedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
            await getNewSyncEngine().sync({ bookmarks: true });
            const [remoteResult, local] = await Promise.all([
                (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list(),
                instapaperDB.getBookmarkByBookmarkId(fakeAddedBookmark.bookmark_id),
            ]);
            const remote = remoteResult.bookmarks.filter((b) => {
                return b.bookmark_id === updatedBookmarkId;
            })[0];

            assert.ok(remote, "didn't find updated remote bookmark");
            assert.strictEqual(parseFloat(<any>remote.progress), progressValue, "Progress value was in correct");

            assert.ok(!local, "Didn't expect to find the bookmark locally");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedFolderWithPendingMoveDoesntFailSyncNotSyncingFolders", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const [fakeFolder, bookmarks] = await Promise.all([
                instapaperDB.addFolder({
                    title: Date.now() + "a",
                    folder_id: "345234",
                }, true),
                instapaperDB.listCurrentBookmarks(),
            ]);

            assert.ok(bookmarks.length, "need some bookmarks to work with");
            const movedBookmark = bookmarks[0];

            await instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id);
            await getNewSyncEngine().sync({ bookmarks: true });
            const [bookmark, folder] = await Promise.all([
                instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                instapaperDB.getFolderByDbId(fakeFolder.id),
            ]);

            assert.ok(bookmark, "Expected to get bookmark");
            assert.strictEqual(bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");
            assert.notStrictEqual(bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
            assert.notStrictEqual(bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedFolderWithPendingMoveDoesntFailSync", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const [fakeFolder, bookmarks] = await Promise.all([
                instapaperDB.addFolder({
                    title: Date.now() + "a",
                    folder_id: Date.now() + "",
                }, true),
                instapaperDB.listCurrentBookmarks(),
            ]);

            assert.ok(bookmarks.length, "need some bookmarks to work with");

            const movedBookmark = bookmarks[0];

            await instapaperDB.moveBookmark(movedBookmark.bookmark_id, fakeFolder.id);
            await getNewSyncEngine().sync();
            const [bookmark, folder] = await Promise.all([
                instapaperDB.getBookmarkByBookmarkId(movedBookmark.bookmark_id),
                instapaperDB.getFolderByDbId(fakeFolder.id),
            ]);

            assert.ok(bookmark, "Expected to get bookmark");
            assert.strictEqual(bookmark.bookmark_id, movedBookmark.bookmark_id, "Didn't get the right bookmark");

            assert.notStrictEqual(bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned, "Shouldn't be in orphaned folder");
            assert.notStrictEqual(bookmark.folder_id, fakeFolder.folder_id, "Shouldn't be in the original folder. Should have been moved somewhere else");

            assert.ok(!folder, "Didn't expect to find the folder");
        });

        // State:
        //   One Folder
        //   Minimum of two bookmarks in unread
        //   One bookmark with 0.5 progress
        //   No other bookmarks

        it("deletedRemoteFolderCleansupState", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const [fakeFolder, bookmarks] = await Promise.all([
                instapaperDB.addFolder({
                    folder_id: "132456",
                    title: Date.now() + "a",
                }, true),
                instapaperDB.listCurrentBookmarks(),
            ]);

            assert.ok(bookmarks.length > 1, "not enough bookmarks");
            const movedOutOfFakeFolderBookmark = bookmarks.pop();

            // Move the bookmark into the fake destination folder
            await instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, fakeFolder.id, true);

            // Create a pending edit to move it back to unread
            await instapaperDB.moveBookmark(movedOutOfFakeFolderBookmark.bookmark_id, instapaperDB.commonFolderDbIds.unread);
            await getNewSyncEngine().sync();

            const [bookmark, folder] = await Promise.all([
                instapaperDB.getBookmarkByBookmarkId(movedOutOfFakeFolderBookmark.bookmark_id),
                instapaperDB.getFolderByDbId(fakeFolder.id),
            ]);

            assert.ok(bookmark, "Didn't get bookmark");
            assert.strictEqual(bookmark.bookmark_id, movedOutOfFakeFolderBookmark.bookmark_id, "Wrong bookmark");

            assert.strictEqual(bookmark.folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Should be in unread folder");

            assert.ok(!folder, "Didn't expect to find the folder");
        });
    });

    describe("InstapaperSyncMultipleBookmarkFolders", () => {
        beforeEach(testDelay);

        it("destroyRemoteData", destroyRemoteAccountData);
        it("addEnoughRemoteBookmarks", addDefaultBookmarks.bind(null, 0));
        it("deleteDb", deleteDb.bind(null, null));

        it("sprinkleBookmarksAcrossTwoNonDefaultFolders", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const foldersApi = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            // First we need to set up some remote data for multiple folder edits.
            // This really means moving some bookmarks into specific, known folders,
            // and then pending some edits locally to go up, come down etc

            // Add some folders to work with.
            await Codevoid.Utilities.serialize([
                Date.now() + "a",
                (Date.now() + 10) + "a",
            ], (item) => foldersApi.add(item));


            // Get the remote data, so we can manipulate it.
            const [folders, bookmarks] = await Promise.all([
                foldersApi.list(),
                bookmarksApi.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread }),
            ]);

            const bookmarkData = bookmarks.bookmarks;
            assert.ok(bookmarkData.length > 1, "Not enough bookmarks");
            assert.ok(folders.length > 1, "Not enough folders");

            await Codevoid.Utilities.serialize([
                { bookmark_id: bookmarkData[0].bookmark_id, destination: folders[0].folder_id },
                { bookmark_id: bookmarkData[1].bookmark_id, destination: folders[1].folder_id },
            ], (item) => bookmarksApi.move(item));
        });

        // Remote State:
        //   Two Folders
        //   One bookmark in each folder minimum
        // Local State:
        //   Empty

        it("syncsDownAllBookmarksInAllFolders", async () => {
            const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

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

            await syncEngine.sync();
            assert.strictEqual(unknown, 0, "Unexpected Unknown count");
            assert.strictEqual(startCount, 1, "Unexpected Start count");
            assert.strictEqual(endCount, 1, "Unexpected End count");
            assert.strictEqual(startCount, 1, "Unexpected Start count");
            assert.strictEqual(foldersStarted, 1, "Wrong number of folders started");
            assert.strictEqual(foldersEnded, 1, "Wrong number of folders ended");
            assert.strictEqual(foldersSynced, 2, "Wrong number of folders");
            assert.strictEqual(bookmarksStarted, 1, "Unexpected bookmarks started");
            assert.strictEqual(bookmarksEnded, 1, "Unexpected bookmarks ended");

            const instapaperDB = await getNewInstapaperDBAndInit();
            const currentFolders = await instapaperDB.listCurrentFolders();
            const folders = currentFolders.filter((folder) => {
                return (defaultFolderIds.indexOf(folder.folder_id) === -1);
            });

            assert.strictEqual(folders.length, 2, "Incorrect folders");

            await Codevoid.Utilities.serialize(folders, async (folder) => {
                const [remoteResult, localBookmarks] = await Promise.all([
                    bookmarksApi.list({ folder_id: folder.folder_id }),
                    instapaperDB.listCurrentBookmarks(folder.id),
                ])
                const remoteBookmarks = remoteResult.bookmarks;

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

        // Remote State:
        //   Two Folders
        //   One bookmark in each folder
        // Local State:
        //   Two Folders
        //   One Bookmark in each folder

        it("syncsMovesUpFromAllFolders", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
            let folders = await instapaperDB.listCurrentFolders();
            folders = folders.filter((folder) => {
                return (defaultFolderIds.indexOf(folder.folder_id) === -1);
            });

            const folderAFolderId = folders[0].folder_id;

            const [folderA, folderB] = await Promise.all([
                instapaperDB.listCurrentBookmarks(folders[0].id),
                instapaperDB.listCurrentBookmarks(folders[1].id),
            ]);

            const bookmarkToMoveToUnread = folderA[0];
            const bookmarkToMoveToFolderA = folderB[0];

            await Promise.all([
                instapaperDB.moveBookmark(bookmarkToMoveToUnread.bookmark_id, instapaperDB.commonFolderDbIds.unread),
                instapaperDB.moveBookmark(bookmarkToMoveToFolderA.bookmark_id, bookmarkToMoveToUnread.folder_dbid),
            ]);
            await getNewSyncEngine().sync({ bookmarks: true });
            const data: Codevoid.Storyvoid.InstapaperApi.IBookmarkListResult[] = await Codevoid.Utilities.serialize([
                "",
                folderAFolderId,
            ], (folder_id) => {
                let param;
                if (folder_id) {
                    param = { folder_id: folder_id };
                }

                return bookmarksApi.list(param);
            });

            let unreadBookmarks = data[0].bookmarks;
            let folderABookmarks = data[1].bookmarks;

            assert.notStrictEqual(unreadBookmarks.length, 0, "Only expected one bookmark in unread");
            assert.notStrictEqual(folderABookmarks.length, 0, "Only expected one bookmark in folderA");

            assert.strictEqual(unreadBookmarks[0].bookmark_id, bookmarkToMoveToUnread.bookmark_id, "Bookmark wasn't found in unread folder");
            assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Bookmark wasn't found in folder A");

            [unreadBookmarks, folderABookmarks] = await Promise.all([
                instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread),
                instapaperDB.listCurrentBookmarks(bookmarkToMoveToUnread.folder_dbid),
            ]);

            assert.ok(unreadBookmarks, "no unread bookmarks");
            assert.notStrictEqual(unreadBookmarks.length, 0, "Incorrect number of unread bookmarks");
            assert.ok(unreadBookmarks.some((b) => {
                return b.bookmark_id === bookmarkToMoveToUnread.bookmark_id;
            }), "Moved Bookmark not found");

            assert.ok(folderABookmarks, "No folderA bookmarks");
            assert.notStrictEqual(folderABookmarks.length, 0, "Incorrect number of folder A bookmarks");
            assert.strictEqual(folderABookmarks[0].bookmark_id, bookmarkToMoveToFolderA.bookmark_id, "Incorrect bookmark");
        });

        // Remote & Local State:
        //   Two Folders
        //   One Unread Bookmark
        //   One Bookmark in a folder
        //   One Emptpy folder

        it("syncMovesIntoArchiveAndProgressIsUpdated", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            const archivedBookmark = bookmarks[0];

            await instapaperDB.moveBookmark(archivedBookmark.bookmark_id, instapaperDB.commonFolderDbIds.archive);
            await getNewSyncEngine().sync({ bookmarks: true });
            const bookmark = await instapaperDB.getBookmarkByBookmarkId(archivedBookmark.bookmark_id);
            await instapaperDB.updateReadProgress(bookmark.bookmark_id, 0.43);
            await getNewSyncEngine().sync({ bookmarks: true });
            const remoteBookmarks = await (new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation)).list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });

            const inArchive = remoteBookmarks.bookmarks.filter((b) => {
                return b.bookmark_id === archivedBookmark.bookmark_id;
            })[0];

            assert.ok(inArchive);
            assert.strictEqual(parseFloat(<any>inArchive.progress), 0.43, "Progress in correct");
        });

        // State:
        //   Two Folders
        //   Bookmark in archive w/ non-zero progress
        //   One bookmark in a folder
        //   One Empty Folder

        it("syncingOnlyOneFolderDoesntEffectOthers", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

            // Find the bookmark in a non default folder
            const allBookmarks = await instapaperDB.listCurrentBookmarks();
            const bookmarksInNonDefaultFolder = allBookmarks.filter((b) => {
                return (defaultFolderIds.indexOf(b.folder_id) === -1);
            });

            assert.strictEqual(bookmarksInNonDefaultFolder.length, 1, "Only expected to find one bookmark");

            const folderDbIdToSync = bookmarksInNonDefaultFolder[0].folder_dbid;
            await instapaperDB.updateReadProgress(bookmarksInNonDefaultFolder[0].bookmark_id, 0.93);
            const archivedBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.archive);
            await instapaperDB.updateReadProgress(archivedBookmarks[0].bookmark_id, 0.32);

            await getNewSyncEngine().sync({ bookmarks: true, folder: folderDbIdToSync, singleFolder: true });

            let r = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
            let remoteBookmarks = r.bookmarks;
            assert.strictEqual(parseFloat(<any>remoteBookmarks[0].progress), 0.43, "Incorrect progress on archive bookmark");

            const folder = await instapaperDB.getFolderByDbId(folderDbIdToSync);
            r = await bookmarks.list({ folder_id: folder.folder_id });
            remoteBookmarks = r.bookmarks;

            assert.strictEqual(parseFloat(<any>remoteBookmarks[0].progress), 0.93, "Incorrect progress on folder bookmark");

            await getNewSyncEngine().sync();
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("orphanedItemsAreCleanedup", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            let allBookmarks = await instapaperDB.listCurrentBookmarks();
            allBookmarks = allBookmarks.filter((b) => {
                return defaultFolderIds.indexOf(b.folder_id) === -1;
            });

            const bookmark = allBookmarks[0];
            const removedBookmarkId = bookmark.bookmark_id = bookmark.bookmark_id + 34;
            await instapaperDB.addBookmark(bookmark);
            await getNewSyncEngine().sync({ bookmarks: true });
            const removedBookmark = await instapaperDB.getBookmarkByBookmarkId(removedBookmarkId);
            assert.ok(!removedBookmark, "Shouldn't be able to find bookmark");

            const orphanedBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.orphaned);
            assert.strictEqual(orphanedBookmarks.length, 0, "Didn't expect to find any orphaned bookmarks");
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("supplyingFolderIdSyncsItBeforeOtherFolders", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const folderSyncOrder = [];

            let currentFolders = await instapaperDB.listCurrentFolders();
            currentFolders = currentFolders.filter((folder) => {
                return defaultFolderIds.indexOf(folder.id.toString()) === -1;
            });

            assert.notStrictEqual(currentFolders.length, 0, "Expected some folders");

            const expectedFirstSyncedFolder = currentFolders[0];

            await getNewSyncEngine().sync({
                bookmarks: true,
                folder: expectedFirstSyncedFolder.folder_dbid,
                _testPerFolderCallback: (id) => {
                    folderSyncOrder.push(id);
                },
            });
            assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

            assert.strictEqual(folderSyncOrder[0], expectedFirstSyncedFolder.id, "Folder was not sync'd first");
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("withNoPriorityFolderSuppliedUnreadSyncsFirst", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const folderSyncOrder = [];

            await getNewSyncEngine().sync({
                bookmarks: true,
                _testPerFolderCallback: (id) => {
                    folderSyncOrder.push(id);
                },
            });

            assert.notStrictEqual(folderSyncOrder.length, 0, "Didn't see any folders synced");

            assert.strictEqual(folderSyncOrder[0], instapaperDB.commonFolderDbIds.unread, "Folder was not sync'd first");
        });

        // State:
        //   Two Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   One Empty folder

        it("syncingBookmarksForSingleNewLocalFolderStillSyncsTheFolderAdd", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarksApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
            const foldersApi = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
            const newFolderTitle = Date.now() + "a";

            const [add, bookmarks] = await Promise.all([
                instapaperDB.addFolder({ title: newFolderTitle }),
                instapaperDB.listCurrentBookmarks(),
            ]);

            const addedFolderDbId = add.id;
            const movedBookmark = bookmarks.filter((b) => {
                return defaultFolderIds.indexOf(b.folder_id) === -1;
            })[0];

            await instapaperDB.moveBookmark(movedBookmark.bookmark_id, add.id);

            await getNewSyncEngine().sync({
                bookmarks: true,
                folder: addedFolderDbId,
                singleFolder: true,
            });

            const remoteFolders = await foldersApi.list();
            const addedFolder = remoteFolders.filter((f) => f.title === newFolderTitle)[0];
            assert.ok(addedFolder, "Didn't find the added folder remotely");

            const r = await bookmarksApi.list({ folder_id: addedFolder.folder_id });
            const folderBookmarks = r.bookmarks;

            assert.strictEqual(folderBookmarks.length, 1, "Expected only one bookmark");
            assert.strictEqual(folderBookmarks[0].bookmark_id, movedBookmark.bookmark_id, "Incorrect bookmark");
        });

        // State:
        //   Three Folders
        //   Bookmark in archive with 0.32 progress
        //   Bookmark in folder with 0.93 progress
        //   Two Empty Folders

        //it("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);

    });
}