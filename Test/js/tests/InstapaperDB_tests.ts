namespace CodevoidTests {
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    import getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    import expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingFolderEdits;
    import expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    import deleteDb = InstapaperTestUtilities.deleteDb;
    import colludePendingBookmarkEdits = InstapaperTestUtilities.colludePendingBookmarkEdits;
    import IBookmark = Codevoid.Storyvoid.IBookmark;
    import IFolder = Codevoid.Storyvoid.IFolder;
    import IBookmarkPendingEdit = Codevoid.Storyvoid.IBookmarkPendingEdit;

    const LOCAL_BOOKMARK_ID = 42424242;
    const defaultFolderIds: string[] = [
        Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
        Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked,
        Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive,
        Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned
    ];
    const tidyDb: () => Promise<any> = deleteDb.bind(null, null);

    let sampleFolders: IFolder[];
    let sampleBookmarks: IBookmark[];
    let addedFolderDbId: number;

    function setSampleData(): void {
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
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
            bookmark_id: 1
        }, { // 1
            title: "Unread2",
            url: "http://unread2.com",
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
            bookmark_id: 2
        }, { // 2
            title: "Unread3",
            url: "http://unread3.com",
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
            bookmark_id: 3
        }, { // 3
            title: "Archived1",
            url: "http://archive1.com",
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive,
            bookmark_id: 4
        }, { // 4
            title: "Archived2",
            url: "http://archive2.com",
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive,
            bookmark_id: 5
        }, { // 5
            title: "InFolder1-1",
            url: "http://infolder1-1.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: 6
        }, { // 6
            title: "InFolder1-2",
            url: "http://infolder1-2.com",
            folder_id: sampleFolders[0].folder_id,
            bookmark_id: 7
        }, { // 7
            title: "InFolder2-1",
            url: "http://InFolder2-1.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: 8
        }, { // 8
            title: "InFolder2-2",
            url: "http://InFolder2-2.com",
            folder_id: sampleFolders[1].folder_id,
            bookmark_id: 9
        }, { // 9
            title: "Unread4",
            url: "http://unread4.com",
            folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread,
            bookmark_id: 10
        }];
    }

    /// <summary>
    /// this expects the "this" pointer to be bound to the
    /// instapaper db wrapper
    /// </summary>
    async function moveAndValidate(this: InstapaperDB, bookmark: IBookmark, destinationFolder: IFolder, fromServer: boolean): Promise<void> {
        const originalBookmark = await this.getBookmarkByBookmarkId(bookmark.bookmark_id);
        assert.ok(originalBookmark, "Didn't find original bookmark");
        assert.notStrictEqual(originalBookmark.folder_dbid, destinationFolder.id, "Bookmark is already in destination folder");

        const movedBookmark = await this.moveBookmark(bookmark.bookmark_id, destinationFolder.id, fromServer);
        assert.ok(movedBookmark, "no moved bookmark");
        assert.strictEqual(movedBookmark.folder_dbid, destinationFolder.id, "Not in destination folder");
        assert.strictEqual(movedBookmark.folder_id, destinationFolder.folder_id, "Not in destination folder");

        bookmark.folder_id = destinationFolder.folder_id;
        bookmark.folder_dbid = destinationFolder.id;
    }

    function validatePendingEdits(edits: IBookmarkPendingEdit[], bookmark_id: number, folder: IFolder, sourcefolder_dbid: number): void {
        assert.ok(edits, "Expected pending edits");
        assert.strictEqual(edits.length, 1, "Expected single pending edit");

        const pendingEdit = edits[0];
        assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "Not a move edit");
        assert.strictEqual(pendingEdit.bookmark_id, bookmark_id, "not correct bookmark");
        assert.strictEqual(pendingEdit.destinationfolder_dbid, folder.id, "Incorrect folder DB id");
        assert.strictEqual(pendingEdit.sourcefolder_dbid, sourcefolder_dbid, "Not marked with the correct ID");
    }

    async function cleanupPendingEdits(this: InstapaperDB): Promise<void> {
        const edits = await colludePendingBookmarkEdits(this.getPendingBookmarkEdits());
        let deletes = edits.map((edit) => this.deletePendingBookmarkEdit(edit.id));
        await Promise.all(deletes);
    }

    async function canRemoveBookmarkNoPendingEdit(): Promise<void> {
        const instapaperDB = await getNewInstapaperDBAndInit();
        await instapaperDB.removeBookmark(LOCAL_BOOKMARK_ID, true);
        await expectNoPendingBookmarkEdits(instapaperDB);
        const currentBookmarks = await instapaperDB.listCurrentBookmarks();
        assert.ok(currentBookmarks, "no bookmarks returned");
        assert.strictEqual(currentBookmarks.length, 0, "Didn't expect bookmarks");
    }

    async function canAddBookmarkNoPendingEdit(): Promise<void> {
        const bookmark: Codevoid.Storyvoid.IBookmark = {
            title: "LocalBookmark",
            bookmark_id: LOCAL_BOOKMARK_ID,
        };

        const instapaperDB = await getNewInstapaperDBAndInit();
        bookmark.folder_dbid = instapaperDB.commonFolderDbIds.unread;
        const addedBookmark = await instapaperDB.addBookmark(bookmark);

        assert.ok(addedBookmark, "Didn't get bookmark back");
        assert.strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");

        await expectNoPendingBookmarkEdits(instapaperDB);
        const currentBookmarks = await instapaperDB.listCurrentBookmarks();
        assert.ok(currentBookmarks, "no folders returned");
        assert.strictEqual(currentBookmarks.length, 1, "Only expected 1 bookmark");

        assert.strictEqual(currentBookmarks[0].bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
        assert.strictEqual(currentBookmarks[0].folder_id, bookmark.folder_id, "Folder ID didn't match");
        assert.strictEqual(currentBookmarks[0].title, bookmark.title, "Folder ID didn't match");
    }

    async function addSampleData(): Promise<void> {
        setSampleData();
        const expectedFolderIds = defaultFolderIds.concat([]);
        assert.notStrictEqual(sampleFolders.length, 0, "Need more than 0 sample folders to create");

        const instapaperDB = await getNewInstapaperDBAndInit();
        const addedFolders = sampleFolders.map(async (folder) => {
            const addedFolder = await instapaperDB.addFolder({ title: folder.title }, true)
            addedFolder.folder_id = folder.folder_id;
            folder.id = addedFolder.id;
            expectedFolderIds.push(folder.folder_id);
            await instapaperDB.updateFolder(addedFolder);
        });
        await Promise.all(addedFolders);

        const currentFolders = await instapaperDB.listCurrentFolders();
        assert.ok(currentFolders, "Didn't get any added Folders");
        assert.strictEqual(currentFolders.length, defaultFolderIds.length + sampleFolders.length, "Unexpected number of folders");

        const notFoundFolders = currentFolders.filter((folder) => expectedFolderIds.indexOf(folder.folder_id) === -1);
        assert.strictEqual(notFoundFolders.length, 0, "Didn't expect to find unmatched folders");

        currentFolders.forEach((folder) => {
            sampleBookmarks.forEach((bookmark) => {
                if (bookmark.folder_id === folder.folder_id) {
                    bookmark.folder_dbid = folder.id;
                }
            });
        });

        const addedBookmarks = sampleBookmarks.map((bookmark) => instapaperDB.addBookmark(bookmark));
        await Promise.all(addedBookmarks);
        const currentBookmarks = await instapaperDB.listCurrentBookmarks();
        assert.ok(currentBookmarks, "didn't find any bookmarks");
        assert.strictEqual(currentBookmarks.length, sampleBookmarks.length, "Didn't find expected bookmarks");
    }

    async function deleteCoreInfraDbs(): Promise<void> {
        await Promise.all([
            deleteDb("One"),
            deleteDb("Two"),
        ]);
    }

    describe("InstapaperDB Folders", () => {
        it("deleteDb", tidyDb);

        it("hasDefaultFolders", async () => {
            const idb = new InstapaperDB();
            await idb.initialize();
            await idb.dispose();
            const rawServer = await
                db.open({
                    server: InstapaperDB.DBName,
                    version: InstapaperDB.DBVersion,
                });
            const queryResult = await rawServer.query(Codevoid.Storyvoid.InstapaperDBTableNames.Folders).execute<Codevoid.Storyvoid.IFolder>();

            assert.ok(queryResult, "Didn't get any results");
            assert.strictEqual(queryResult.length, 4, "Didn't get the folders expected");

            assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[0].folder_id), -1, "Didn't find folder: " + queryResult[0].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[1].folder_id), -1, "Didn't find folder: " + queryResult[1].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[2].folder_id), -1, "Didn't find folder: " + queryResult[2].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(queryResult[3].folder_id), -1, "Didn't find folder: " + queryResult[3].folder_id);
        });

        it("canEnumerateDefaultFolders", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const folders = await idb.listCurrentFolders();

            assert.ok(folders, "Didn't get any folders");
            assert.strictEqual(folders.length, 4, "Got unexpected number of folders");

            assert.notStrictEqual(defaultFolderIds.indexOf(folders[0].folder_id), -1, "Didn't find folder: " + folders[0].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(folders[1].folder_id), -1, "Didn't find folder: " + folders[1].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(folders[2].folder_id), -1, "Didn't find folder: " + folders[2].folder_id);
            assert.notStrictEqual(defaultFolderIds.indexOf(folders[3].folder_id), -1, "Didn't find folder: " + folders[3].folder_id);
        });

        it("canAddFolderNoPendingEdit", async () => {
            const folderName = "LocalFolder"
            const instapaperDB = await getNewInstapaperDBAndInit();
            const createdFolder = await instapaperDB.addFolder({ title: folderName }, true);
            addedFolderDbId = createdFolder.id;

            const folders = await instapaperDB.listCurrentFolders();
            let folderFound: boolean;
            assert.ok(folders, "no folders returned");

            folders.forEach((folder) => {
                if (folder.title === folderName) {
                    folderFound = true;
                }
            });

            assert.ok(folderFound, "Didn't find the folder we just made");
            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("canGetAddedFolderByDbId", async () => {
            const folderName = "LocalFolder"
            const idb = await getNewInstapaperDBAndInit();
            const retrievedFolder = await idb.getFolderByDbId(addedFolderDbId);

            assert.ok(retrievedFolder, "No folder found");
            assert.strictEqual(retrievedFolder.title, folderName);
            assert.strictEqual(retrievedFolder.id, addedFolderDbId);
        });

        it("canUpdateFolder", async () => {
            const folderName = "LocalFolder"
            const instapaperDB = await getNewInstapaperDBAndInit();
            const retrievedFolder = await instapaperDB.getFolderByDbId(addedFolderDbId);

            assert.ok(retrievedFolder, "No folder found");
            assert.strictEqual(retrievedFolder.title, folderName);
            assert.strictEqual(retrievedFolder.id, addedFolderDbId);

            retrievedFolder.folder_id = "xxx";

            await instapaperDB.updateFolder(retrievedFolder);
            const updatedFolderInformation = await instapaperDB.getFolderByDbId(addedFolderDbId);
            assert.ok(updatedFolderInformation, "No updated folder information");
            assert.strictEqual(updatedFolderInformation.folder_id, "xxx", "Folder ID didn't match");
        });

        it("canGetFolderFromFolderId", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const folder = await idb.getFolderFromFolderId("xxx");
            assert.strictEqual(folder.id, addedFolderDbId, "incorrect folder DB ID");
        });

        it("cantGetFolderDbIdFromInvalidFolderId", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const folder = await idb.getFolderFromFolderId("yyy");
            assert.strictEqual(folder, undefined, "should get 'undefined' for folder db id if it's not in the DB");
        });

        it("addExistingFolderNameFailsAndLeavesNoPendingEdit", async () => {
            let folderName = "LocalFolder"
            const instapaperDB = await getNewInstapaperDBAndInit();

            try {
                await instapaperDB.addFolder({ title: folderName }, true);
                assert.ok(false, "Should have failed");
            } catch (error) {
                assert.strictEqual(error.code, Codevoid.Storyvoid.InstapaperDBErrorCodes.FOLDER_DUPLICATE_TITLE, "Wrong error code");
                assert.ok(true, "Should fail here");
            }

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("canRemoveFolderNoPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            let folders = await instapaperDB.listCurrentFolders();
            let folderId: number;

            assert.ok(folders, "didn't find any folders in db");
            folders.forEach((folder) => {
                if (defaultFolderIds.indexOf(folder.folder_id) === -1) {
                    folderId = folder.id;
                }
            });

            await instapaperDB.removeFolder(folderId, true);
            folders = await instapaperDB.listCurrentFolders();
            let folderFound: boolean;
            folders.forEach((folder) => {
                if (folder.id === folderId) {
                    folderFound = true;
                }
            });

            assert.ok(!folderFound, "Found folder, expected it to be gone");

            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("canAddFolderWithPendingEdit", async () => {
            const folderName = "LocalFolder";

            const instapaperDB = await getNewInstapaperDBAndInit();
            const addFolderResult = await instapaperDB.addFolder({ title: folderName });
            const folders = await instapaperDB.listCurrentFolders();
            let folderFound: IFolder;

            assert.ok(folders, "no folders returned");
            folders.forEach((folder) => {
                if (folder.title === folderName) {
                    folderFound = folder;
                }
            });

            assert.ok(folderFound, "Didn't find the folder we just made");
            assert.strictEqual(folderFound.title, folderName, "Folder name didn't match");
            assert.strictEqual(folderFound.id, addFolderResult.id, "Folder ID didn't match");
            assert.ok(!folderFound.folder_id, "Shouldn't have had folder. Nothing sync'd");

            const pendingEdits = await instapaperDB.getPendingFolderEdits();
            assert.ok(pendingEdits, "Expected some pending edits");
            assert.strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            const pendingEdit = pendingEdits[0];
            assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD, "Expected to be ADD edit type");
            assert.strictEqual(pendingEdit.folder_dbid, addFolderResult.id, "Pending edit wasn't for the folder we added");

            await instapaperDB.deletePendingFolderEdit(pendingEdit.id);
        });

        it("canRemoveFolderWithPendingEdit", async () => {
            let folderToRemove: IFolder;
            const instapaperDB = await getNewInstapaperDBAndInit();
            let folders = await instapaperDB.listCurrentFolders();
            assert.ok(folders, "didn't find any folders in db");
            folders.forEach((folder) => {
                if (defaultFolderIds.indexOf(folder.folder_id) === -1) {
                    folderToRemove = folder;
                }
            });

            await instapaperDB.removeFolder(folderToRemove.id);
            folders = await instapaperDB.listCurrentFolders();
            let folderFound: boolean;
            folders.forEach((folder) => {
                if (folder.id === folderToRemove.id) {
                    folderFound = true;
                }
            });

            assert.ok(!folderFound, "Found folder, expected it to be gone");

            const pendingEdits = await instapaperDB.getPendingFolderEdits();
            assert.ok(pendingEdits, "Expected some pending edits");
            assert.strictEqual(pendingEdits.length, 1, "Expected single pending edit");
            if (pendingEdits.length !== 1) {
                return;
            }

            let pendingEdit = pendingEdits[0];
            assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE, "Expected to be DELETE edit type");
            assert.strictEqual(pendingEdit.removedFolderId, folderToRemove.folder_id, "Pending edit wasn't for the folder we added");
            assert.strictEqual(pendingEdit.title, folderToRemove.title, "Didn't didn't match");

            await instapaperDB.deletePendingFolderEdit(pendingEdit.id);
        });

        it("deletingUnsyncedAddededFolderNoOps", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const addedFolder = await instapaperDB.addFolder({ title: "shouldntBeSyncd" });
            await instapaperDB.removeFolder(addedFolder.id);
            await expectNoPendingFolderEdits(instapaperDB);
        });

        it("addingDeletedFolderWithoutSyncBringsBackFolderId", async () => {
            const folderTitle = "shouldntBeSyncd";
            const instapaperDB = await getNewInstapaperDBAndInit();
            const addedFolder = await instapaperDB.addFolder({ title: folderTitle }, true);

            // Need to give the folder a fake ID to make sure we can resurect it
            // We don't want to sync things in these simple tests
            addedFolder.folder_id = Date.now().toString();
            await instapaperDB.updateFolder(addedFolder);
            await expectNoPendingFolderEdits(instapaperDB);
            await instapaperDB.removeFolder(addedFolder.id);
            const data = await instapaperDB.getFolderByDbId(addedFolder.id);
            assert.ok(!data, "Didn't expect any data");

            const reAddedFolder = await instapaperDB.addFolder({ title: folderTitle });
            assert.strictEqual(reAddedFolder.folder_id, addedFolder.folder_id, "Added Folder ID wasn't the same");

            await expectNoPendingFolderEdits(instapaperDB);
        });
    });

    describe("InstapaperDBBookmarks", () => {
        it("emptyUnreadBookmarksTableReturnsEmptyData", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const results = await idb.listCurrentBookmarks(idb.commonFolderDbIds.unread);

            assert.ok(results, "expected result array");
            assert.strictEqual(results.length, 0, "Didn't expect to get any results");
        });

        it("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

        it("canUpdateBookmarkInformationNoPendingEdits", async () => {
            const bookmark_id = LOCAL_BOOKMARK_ID;
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmark = await instapaperDB.getBookmarkByBookmarkId(bookmark_id);

            assert.notStrictEqual(bookmark.url, "http://www.bing.com", "URL shouldn't have been that which we're about to set it to");
            bookmark.url = "http://www.bing.com";

            await instapaperDB.updateBookmark(bookmark);

            const updatedBookmark = await instapaperDB.getBookmarkByBookmarkId(bookmark_id);
            assert.ok(updatedBookmark, "no bookmark returned");
            assert.strictEqual(updatedBookmark.url, "http://www.bing.com", "Incorrect Url");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);

        it("addingNewUrlDoesntShowUpInBookmarks", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            let pendingEdit = await instapaperDB.addUrl({
                url: "http://www.microsoft.com",
                title: "Microsoft",
            });
            const pendingId = pendingEdit.id;
            const pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());

            assert.ok(pendingEdits, "Expected some pending edits");
            assert.strictEqual(pendingEdits.length, 1, "Expected only 1 pending edit");

            pendingEdit = pendingEdits[0];
            assert.strictEqual(pendingEdit.url, "http://www.microsoft.com", "Incorrect pended URL");
            assert.strictEqual(pendingEdit.title, "Microsoft", "incorrect pended title");
            assert.strictEqual(pendingEdit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD, "Wrong pended edit type");

            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks, "Expected bookmarks result set");
            assert.strictEqual(currentBookmarks.length, 0, "Expected no bookmarks");

            await instapaperDB.deletePendingBookmarkEdit(pendingId);
        });

        it("likingNonExistantBookmarkWithIgnoreMissingFlagSetReturnsNull", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmark = await instapaperDB.likeBookmark(Date.now(), true, true);
            assert.strictEqual(bookmark, null, "Shouldn't have gotten a bookmark");
        });

        it("canLikeBookmarkNoPendingEdit", async () => {
            const bookmark: Codevoid.Storyvoid.IBookmark = {
                title: "LocalBookmark",
                bookmark_id: LOCAL_BOOKMARK_ID,
                starred: 0,
            };

            const instapaperDB = await getNewInstapaperDBAndInit();
            bookmark.folder_dbid = instapaperDB.commonFolderDbIds.unread;

            const addedBookmark = await instapaperDB.addBookmark(bookmark);
            assert.ok(addedBookmark, "Didn't get bookmark back");
            assert.strictEqual(addedBookmark.bookmark_id, bookmark.bookmark_id, "Wrong bookmark ID");

            await expectNoPendingBookmarkEdits(instapaperDB);
            await instapaperDB.likeBookmark(bookmark.bookmark_id, true);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, bookmark.bookmark_id, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.folder_id, bookmark.folder_id, "Folder ID didn't match");
            assert.strictEqual(newBookmark.folder_dbid, instapaperDB.commonFolderDbIds.unread, "Folder DB ID's didn't match");
            assert.strictEqual(newBookmark.title, bookmark.title, "Folder ID didn't match");
            assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("likeingNonExistantBookmarkErrors", async () => {
            const idb = await getNewInstapaperDBAndInit();

            try {
                await idb.likeBookmark(Date.now());
                assert.ok(false, "shouldn't have succeeded");
            } catch (error) {
                assert.ok(error, "didn't get error object");
                assert.strictEqual(error.code, Codevoid.Storyvoid.InstapaperDBErrorCodes.BOOKMARK_NOT_FOUND, "Incorrect Error code");
            }
        });

        it("canUnlikeBookmarkNoPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(bookmark, "Didn't get bookmark");
            assert.strictEqual(bookmark.starred, 1, "Bookmark needs to be liked to unlike it");

            let unlikedBookmark = await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID, true);
            assert.ok(unlikedBookmark, "no bookmark returned");
            assert.strictEqual(unlikedBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark ID");
            assert.strictEqual(unlikedBookmark.starred, 0, "Bookmark shouldn't have been liked");

            unlikedBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(unlikedBookmark, "no bookmark found");
            assert.strictEqual(unlikedBookmark.starred, 0, "Bookmark was still liked");
        });

        it("updatingReadProgressLeavesNoPendingEdit", async () => {
            const targetProgress = 0.452;
            const instapaperDB = await getNewInstapaperDBAndInit();

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.notStrictEqual(bookmark.progress, targetProgress, "Bookmark already had the target progress");

            const updatedBookmark = await instapaperDB.updateReadProgress(bookmark.bookmark_id, targetProgress)
            assert.strictEqual(updatedBookmark.progress, targetProgress, "progress wasn't updated");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        // Remove the just futzed with bookmark
        it("canRemoveBookmarkNoPendingEdit", canRemoveBookmarkNoPendingEdit);

        // Re-add a bookmark to work with
        it("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

        it("removingBookmarkLeavesPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            const folder_dbid = bookmark.folder_dbid;
            await instapaperDB.removeBookmark(LOCAL_BOOKMARK_ID);

            const currentBookmarks = await instapaperDB.listCurrentBookmarks();
            assert.ok(currentBookmarks, "Didn't get any pending bookmarks");

            assert.strictEqual(currentBookmarks.length, 0, "Only expected to find one DB");
            const currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());

            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            const edit = currentPendingEdits[0];
            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");

            await instapaperDB.deletePendingBookmarkEdit(edit.id);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("canAddBookmarkNoPendingEdit", canAddBookmarkNoPendingEdit);

        it("likingBookmarkAddsPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await expectNoPendingBookmarkEdits(instapaperDB);

            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            assert.ok(newBookmark.folder_dbid, "Doesn't have a folder DB ID");
            const folder_dbid = newBookmark.folder_dbid;

            const currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            const edit = currentPendingEdits[0];
            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked for the correct folder");

            await instapaperDB.deletePendingBookmarkEdit(edit.id);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("likingBookmarkWithPendingLikeEditLeavesSinglePendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await expectNoPendingBookmarkEdits(instapaperDB);

            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            assert.ok(newBookmark.folder_dbid, "No folder db id");
            const folder_dbid = newBookmark.folder_dbid;

            let currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            let edit = currentPendingEdits[0];

            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID);
            currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            edit = currentPendingEdits[0];
            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Marked with the wrong source folder ID");

            await instapaperDB.deletePendingBookmarkEdit(edit.id);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("unlikingBookmarkLeavesPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID, true);
            await expectNoPendingBookmarkEdits(instapaperDB);

            await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            const folder_dbid = newBookmark.folder_dbid;

            const currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            const edit = currentPendingEdits[0];

            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Not marked with correct source folder");

            await instapaperDB.deletePendingBookmarkEdit(edit.id);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("unlikingBookmarkWithPendingUnlikeEditLeavesSinglePendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID, true);
            await expectNoPendingBookmarkEdits(instapaperDB);

            await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            const folder_dbid = newBookmark.folder_dbid;

            let currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            let edit = currentPendingEdits[0];

            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID);

            currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            edit = currentPendingEdits[0];
            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "marked with the wrong source folder");

            await instapaperDB.deletePendingBookmarkEdit(edit.id);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("unlikingBookmarkWithPendingLikeEditLeavesNoPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await expectNoPendingBookmarkEdits(instapaperDB);
            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 1, "Didn't get starred");
            const folder_dbid = newBookmark.folder_dbid;

            const currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            let edit = currentPendingEdits[0];
            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "not marked with the correct source folder");

            await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID);
            const unlikedBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(unlikedBookmark, "Expected a bookmark");
            assert.strictEqual(unlikedBookmark.bookmark_id, LOCAL_BOOKMARK_ID);
            assert.strictEqual(unlikedBookmark.starred, 0, "Shouldn't have been liked");

            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("likingBookmarkWithPendingUnlikeEditLeavesNoPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            await expectNoPendingBookmarkEdits(instapaperDB);

            await instapaperDB.unlikeBookmark(LOCAL_BOOKMARK_ID);
            const newBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(newBookmark, "no bookmark returned");

            assert.strictEqual(newBookmark.bookmark_id, LOCAL_BOOKMARK_ID, "Bookmark ID didn't match");
            assert.strictEqual(newBookmark.starred, 0, "Didn't get unstarred");
            const folder_dbid = newBookmark.folder_dbid;

            const currentPendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(currentPendingEdits, "Didn't find any pending edits");
            assert.strictEqual(currentPendingEdits.length, 1, "Only expected to find one pending edit");

            let edit = currentPendingEdits[0];

            assert.strictEqual(edit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Expected Delete type");
            assert.strictEqual(edit.bookmark_id, LOCAL_BOOKMARK_ID, "Wrong bookmark");
            assert.strictEqual(edit.sourcefolder_dbid, folder_dbid, "Incorrect source folder");

            await instapaperDB.likeBookmark(LOCAL_BOOKMARK_ID);
            const unlikedBookmark = await instapaperDB.getBookmarkByBookmarkId(LOCAL_BOOKMARK_ID);
            assert.ok(unlikedBookmark, "Expected a bookmark");
            assert.strictEqual(unlikedBookmark.bookmark_id, LOCAL_BOOKMARK_ID);
            assert.strictEqual(unlikedBookmark.starred, 1, "Shouldn't have been unliked");

            await expectNoPendingBookmarkEdits(instapaperDB);
            await instapaperDB.dispose();
    });

        // We're about to do the folder test, so we want to make sure we've got
        // a clean slate.
        it("deleteDb", tidyDb);

        it("addSampleData", addSampleData);

        it("movingToLikedErrors", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const likedFolder = await instapaperDB.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked);

            try {
                await instapaperDB.moveBookmark(sampleBookmarks[0].bookmark_id, likedFolder.id);
                assert.ok(false, "shouldn't be able to successfully move to liked folder");
            } catch(error) {
                assert.strictEqual(error.code, Codevoid.Storyvoid.InstapaperDBErrorCodes.INVALID_DESTINATION_FOLDER, "incorrect error code");
            };
        });

        it("movingBookmarkLeavesNoPendingEdit", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit()
            await (moveAndValidate.bind(instapaperDB))(sampleBookmarks[0], sampleFolders[0], true);
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("movingBookmarkLeavesPendingEdit", async () => {
            const targetBookmark = sampleBookmarks[1];
            const sourcefolder_dbid = targetBookmark.folder_dbid;
            const instapaperDB = await getNewInstapaperDBAndInit();

            await (moveAndValidate.bind(instapaperDB))(targetBookmark, sampleFolders[1]);
            const pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);

            await instapaperDB.deletePendingBookmarkEdit(pendingEdits[0].id);
        });

        it("multipleMovesLeavesOnlyOnePendingEdit", async () => {
            const targetBookmark = sampleBookmarks[2];
            const sourcefolder_dbid = targetBookmark.folder_dbid;
            const instapaperDB = await getNewInstapaperDBAndInit()

            await (moveAndValidate.bind(instapaperDB))(targetBookmark, sampleFolders[1]);
            let pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[1], sourcefolder_dbid);

            await (moveAndValidate.bind(instapaperDB))(targetBookmark, sampleFolders[0]);
            pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            validatePendingEdits(pendingEdits, targetBookmark.bookmark_id, sampleFolders[0], sampleFolders[1].id);

            await (cleanupPendingEdits.bind(instapaperDB))();
        });

        it("likingThenMovingLeavesCorrectPendingEdits", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const likedBookmark = await instapaperDB.likeBookmark(sampleBookmarks[1].bookmark_id);
            const sourcefolder_dbid = likedBookmark.folder_dbid;
            await (moveAndValidate.bind(instapaperDB))(sampleBookmarks[1], sampleFolders[0]);

            const pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(pendingEdits, "No pending edits");
            assert.strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            let moveEdit: IBookmarkPendingEdit;
            let likeEdit: IBookmarkPendingEdit;

            pendingEdits.forEach((edit) => {
                switch (edit.type) {
                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        assert.ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            assert.ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            assert.strictEqual(moveEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong bookmark id");
            assert.strictEqual(moveEdit.destinationfolder_dbid, sampleFolders[0].id, "Wrong Folder");
            assert.strictEqual(moveEdit.sourcefolder_dbid, sourcefolder_dbid, "Incorrect source folder");

            assert.strictEqual(likeEdit.bookmark_id, sampleBookmarks[1].bookmark_id, "Wrong like bookmark");
            await (cleanupPendingEdits.bind(instapaperDB))();
        });

        it("likingThenMovingThenDeletingLeavesCorrectPendingEdits", async () => {
            const destinationFolder = sampleFolders[1];
            const targetBookmark = sampleBookmarks[2];
            const originalSourceFolderId = targetBookmark.folder_dbid;
            const finalSourceFolderId = destinationFolder.id;
            const instapaperDB = await getNewInstapaperDBAndInit();

            const likedBookmark = await instapaperDB.likeBookmark(targetBookmark.bookmark_id);
            await (moveAndValidate.bind(instapaperDB))(targetBookmark, destinationFolder);

            let pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            assert.ok(pendingEdits, "No pending edits");
            assert.strictEqual(pendingEdits.length, 2, "Unexpected number of edits");
            let moveEdit: IBookmarkPendingEdit;
            let likeEdit: IBookmarkPendingEdit;

            pendingEdits.forEach((edit) => {
                switch (edit.type) {
                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE:
                        moveEdit = edit;
                        break;

                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    default:
                        assert.ok(false, "Unexpected edit type: " + edit.type);
                        break;
                }
            });

            assert.ok(moveEdit && likeEdit, "Edits weren't the expected pair");

            assert.strictEqual(moveEdit.bookmark_id, targetBookmark.bookmark_id, "Move had wrong bookmark id");
            assert.strictEqual(moveEdit.destinationfolder_dbid, destinationFolder.id, "Move was to the wrong Folder");
            assert.strictEqual(moveEdit.sourcefolder_dbid, originalSourceFolderId, "Not marked with the correct folder");

            assert.strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "Like had wrong like bookmark");

            await instapaperDB.removeBookmark(targetBookmark.bookmark_id);
            pendingEdits = await colludePendingBookmarkEdits(instapaperDB.getPendingBookmarkEdits());
            let deleteEdit: IBookmarkPendingEdit;

            assert.ok(pendingEdits, "Didn't get any pending edits");
            assert.strictEqual(pendingEdits.length, 2, "Expected only two pending edits;");

            pendingEdits.forEach((edit) => {
                switch (edit.type) {
                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE:
                        likeEdit = edit;
                        break;

                    case Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE:
                        deleteEdit = edit;
                        break;

                    default:
                        assert.ok(false, "Unexpected edit");
                }
            });

            assert.ok(likeEdit && deleteEdit, "Didn't get correct edits");

            assert.strictEqual(deleteEdit.bookmark_id, targetBookmark.bookmark_id, "Delete had wrong bookmark ID");
            assert.strictEqual(deleteEdit.sourcefolder_dbid, finalSourceFolderId, "Not marked with the source folder");

            assert.strictEqual(likeEdit.bookmark_id, targetBookmark.bookmark_id, "like had wrong bookmark ID");
            assert.strictEqual(likeEdit.sourcefolder_dbid, originalSourceFolderId, "not marked with the source folder");

            await (cleanupPendingEdits.bind(instapaperDB))();
        });

        it("updateSampleBookmarks", async () => {
            const idb = await getNewInstapaperDBAndInit();
            let gets = sampleBookmarks.map(async (bookmark, index) => {
                const dbBookmark = await idb.getBookmarkByBookmarkId(bookmark.bookmark_id);
                sampleBookmarks[index] = dbBookmark;
            });

            assert.strictEqual(gets.length, sampleBookmarks.length);
            await Promise.all(gets);
        });

        it("deleteDb", tidyDb);
        it("addSampleData", addSampleData);

        it("queryingForUnreadFolderReturnsOnlyUnreadItems", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            let unreadBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.unread);
            assert.ok(unreadBookmarks, "Didn't get list of unread bookmarks");
            assert.strictEqual(unreadBookmarks.length, 4, "Incorrect number of bookmarks");

            unreadBookmarks = unreadBookmarks.sort((a, b) => {
                if (a === b) {
                    return 0;
                } else if (a < b) {
                    return -1;
                } else {
                    return 1;
                }
            });

            assert.strictEqual(unreadBookmarks[0].bookmark_id, sampleBookmarks[0].bookmark_id, "Bookmark 1 not found");
            assert.strictEqual(unreadBookmarks[0].folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Bookmark 1 not found in unread folder");

            assert.strictEqual(unreadBookmarks[1].bookmark_id, sampleBookmarks[1].bookmark_id, "Bookmark 2 not found");
            assert.strictEqual(unreadBookmarks[1].folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Bookmark 2 not found in unread folder");

            assert.strictEqual(unreadBookmarks[2].bookmark_id, sampleBookmarks[2].bookmark_id, "Bookmark 3 not found");
            assert.strictEqual(unreadBookmarks[2].folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Bookmark 3 not found in unread folder");

            assert.strictEqual(unreadBookmarks[3].bookmark_id, sampleBookmarks[9].bookmark_id, "Bookmark 4 not found");
            assert.strictEqual(unreadBookmarks[3].folder_id, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, "Bookmark 4 not found in unread folder");
        });

        it("queryingForFolderContentsReturnsOnlyFolderItems", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            let folderBookmarks = await instapaperDB.listCurrentBookmarks(sampleFolders[0].id);
            assert.ok(folderBookmarks, "Didn't get list of folder bookmarks");
            assert.strictEqual(folderBookmarks.length, 2, "Incorrect number of bookmarks");

            folderBookmarks = folderBookmarks.sort((a, b) => {
                if (a === b) {
                    return 0;
                } else if (a < b) {
                    return -1;
                } else {
                    return 1;
                }
            });

            assert.strictEqual(folderBookmarks[0].bookmark_id, sampleBookmarks[5].bookmark_id, "Bookmark 1 not found");
            assert.strictEqual(folderBookmarks[0].folder_id, sampleFolders[0].folder_id, "Bookmark 1 not found in unread folder");

            assert.strictEqual(folderBookmarks[1].bookmark_id, sampleBookmarks[6].bookmark_id, "Bookmark 2 not found");
            assert.strictEqual(folderBookmarks[1].folder_id, sampleFolders[0].folder_id, "Bookmark 2 not found in unread folder");
        });

        it("queryingForLikedFolderReturnsBookmarksAcrossMulipleFolders", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            await Promise.all([
                instapaperDB.likeBookmark(sampleBookmarks[5].bookmark_id, true),
                instapaperDB.likeBookmark(sampleBookmarks[7].bookmark_id, true)
            ]);

            const likedBookmarks = await instapaperDB.listCurrentBookmarks(instapaperDB.commonFolderDbIds.liked);
            const folderHash = {};

            assert.ok(likedBookmarks, "No book marks returned");
            assert.strictEqual(likedBookmarks.length, 2, "Incorrect number of bookmarks returned");

            likedBookmarks.reduce((hash, bookmark) => {
                hash[bookmark.folder_id] = 1;
                assert.strictEqual(bookmark.starred, 1, "Bookmark wasn't liked");

                return hash;
            }, folderHash);

            const folders = Object.keys(folderHash);
            assert.strictEqual(folders.length, 2, "Expected different folders for each bookmark");
        });

        it("gettingPendingEditsWithFolderReturnsOnlyChangesForThatFolder", async () => {
            const targetFolder = sampleFolders[0];
            const destinationFolder = sampleFolders[1];
            const bookmark1 = sampleBookmarks[5];
            const bookmark2 = sampleBookmarks[6];
            const bookmark3 = sampleBookmarks[7]
            const instapaperDB = await getNewInstapaperDBAndInit();

            const [move, like1, like2] = await Promise.all([
                instapaperDB.moveBookmark(bookmark1.bookmark_id, destinationFolder.id),
                instapaperDB.likeBookmark(bookmark2.bookmark_id),
                instapaperDB.likeBookmark(bookmark3.bookmark_id),
            ]);

            sampleBookmarks[5] = move;
            sampleBookmarks[6] = like1;
            sampleBookmarks[7] = like2;

            const pendingEdits = await instapaperDB.getPendingBookmarkEdits();
            assert.ok(pendingEdits, "Didn't get pending edits");

            assert.ok(pendingEdits.likes, "didn't get any likes");
            assert.strictEqual(pendingEdits.likes.length, 2, "Incorrect number of likes");

            assert.ok(pendingEdits.moves, "didn't get any moves");
            assert.strictEqual(pendingEdits.moves.length, 1, "incorrect number of move edits");

            const scopedPendingEdits = await instapaperDB.getPendingBookmarkEdits(targetFolder.id);
            assert.ok(scopedPendingEdits, "didn't get any pending edits");

            assert.ok(scopedPendingEdits.likes, "Didn't get likes");
            assert.ok(scopedPendingEdits.moves, "Didn't get moves");

            assert.strictEqual(scopedPendingEdits.likes.length, 1, "Incorrect number of likes");
            assert.strictEqual(scopedPendingEdits.moves.length, 1, "incorrect number of moves");

            const moveEdit = scopedPendingEdits.moves[0];
            const likeEdit = scopedPendingEdits.likes[0];

            assert.strictEqual(moveEdit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "incorrect move type");
            assert.strictEqual(moveEdit.sourcefolder_dbid, targetFolder.id, "not the correct source folder");
            assert.strictEqual(moveEdit.destinationfolder_dbid, destinationFolder.id, "Not the correct target folder");
            assert.strictEqual(moveEdit.bookmark_id, bookmark1.bookmark_id, "Incorrect bookmark ID");

            assert.strictEqual(likeEdit.type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "incorrect move type");
            assert.strictEqual(likeEdit.sourcefolder_dbid, targetFolder.id, "not the correct source folder");
            assert.strictEqual(likeEdit.bookmark_id, bookmark2.bookmark_id, "Incorrect bookmark ID");

            await (cleanupPendingEdits.bind(instapaperDB))();
        });

        it("deleteDbWithAPI", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const folders = await instapaperDB.listCurrentFolders();

            assert.ok(folders, "Expected folders");
            assert.ok(folders.length > 0, "Expect some folders");

            await instapaperDB.deleteAllData();
        });

        it("gettingPendingBookmarkAddsWithEmptyDbReturnsUndefined", async () => {
            const idb = await getNewInstapaperDBAndInit();

            const adds = await idb.getPendingBookmarkAdds();
            assert.ok(Array.isArray(adds), "Didn't get expected array");
            assert.strictEqual(adds.length, 0, "Shouldn't have had any pending edits");
        });

        it("canGetAllPendingAdds", async () => {
            // Reinitalize the sample data.
            setSampleData();

            const instapaperDB = await getNewInstapaperDBAndInit();
            const addPromises = sampleBookmarks.map((bookmark) => instapaperDB.addUrl({ url: bookmark.url, title: bookmark.title }));
            await Promise.all(addPromises);

            const pendingEdits = await instapaperDB.getPendingBookmarkEdits();
            assert.ok(pendingEdits, "Expected pending edits");
            assert.strictEqual(pendingEdits.adds.length, sampleBookmarks.length, "Didn't find enough pending edits");

            const pendingAdds = await instapaperDB.getPendingBookmarkAdds();
            assert.ok(pendingAdds, "Didn't get any pending adds");
            assert.strictEqual(pendingAdds.length, sampleBookmarks.length, "Didn't find enough pending adds");

            await cleanupPendingEdits.bind(instapaperDB)();
            await expectNoPendingBookmarkEdits(instapaperDB);
        });

        it("gettingPendingAddsWithNoAddsReturnsEmptyArray", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const adds = await idb.getPendingBookmarkAdds();

            assert.ok(Array.isArray(adds), "Didn't get expected array");
            assert.strictEqual(adds.length, 0, "Shouldn't have had any pending edits");
        });

        it("addSampleData", addSampleData);

        it("pendingEditsAreCorrectlyBucketed", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const [like, unreadFolder, archiveFolder, moveBookmarkToSampleFolder] = await Promise.all([
                instapaperDB.likeBookmark(sampleBookmarks[0].bookmark_id, true),
                instapaperDB.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread),
                instapaperDB.getFolderFromFolderId(Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive),
                instapaperDB.moveBookmark(sampleBookmarks[4].bookmark_id, sampleFolders[0].id, true),
            ]);

            const unreadFolderDbId = unreadFolder.id;
            const archiveFolderDbId = archiveFolder.id;

            const operations = [
                instapaperDB.unlikeBookmark(sampleBookmarks[0].bookmark_id),
                instapaperDB.likeBookmark(sampleBookmarks[1].bookmark_id),
                instapaperDB.moveBookmark(sampleBookmarks[2].bookmark_id, sampleFolders[0].id),
                instapaperDB.removeBookmark(sampleBookmarks[3].bookmark_id),
                instapaperDB.moveBookmark(sampleBookmarks[4].bookmark_id, instapaperDB.commonFolderDbIds.unread),
                WinJS.Promise.timeout(),
            ];

            await Promise.all(operations);

            const [unread, archive, sampleFolder] = await Promise.all([
                instapaperDB.getPendingBookmarkEdits(unreadFolderDbId),
                instapaperDB.getPendingBookmarkEdits(archiveFolderDbId),
                instapaperDB.getPendingBookmarkEdits(sampleFolders[0].id),
            ]);

            assert.ok(unread, "No unread info");
            assert.ok(archive, "No archive info");

            assert.ok(!unread.adds, "Didn't expect any adds");

            assert.ok(unread.unlikes, "Didn't get any unlikes");
            assert.strictEqual(unread.unlikes.length, 1, "Only expected one like edit");
            assert.strictEqual(unread.unlikes[0].bookmark_id, sampleBookmarks[0].bookmark_id, "Incorrect bookmark");
            assert.strictEqual(unread.unlikes[0].type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Not correct edit type");

            assert.ok(unread.likes, "Didn't get any likes");
            assert.strictEqual(unread.likes.length, 1, "Didn't get enough likes");
            assert.strictEqual(unread.likes[0].bookmark_id, sampleBookmarks[1].bookmark_id, "Incorrect bookmark ID");
            assert.strictEqual(unread.likes[0].type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Incorrect edit type");

            assert.ok(unread.moves, "Didn't get any moves");

            // Check the item being moved OUT of unread
            assert.strictEqual(unread.moves.length, 2, "Didn't get enough moves");
            assert.strictEqual(unread.moves[0].bookmark_id, sampleBookmarks[2].bookmark_id, "Incorrect bookmark ID");
            assert.strictEqual(unread.moves[0].type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "Incorrect edit type");
            assert.strictEqual(unread.moves[0].destinationfolder_dbid, sampleFolders[0].id, "Wrong destination folder");
            assert.strictEqual(unread.moves[0].sourcefolder_dbid, instapaperDB.commonFolderDbIds.unread, "Incorrect source folder");

            // Check the item being moved INTO unread
            assert.strictEqual(unread.moves[1].bookmark_id, sampleBookmarks[4].bookmark_id, "Incorrect bookmark ID");
            assert.strictEqual(unread.moves[1].type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "Incorrect edit type");
            assert.strictEqual(unread.moves[1].destinationfolder_dbid, instapaperDB.commonFolderDbIds.unread, "Wrong destination folder");
            assert.strictEqual(unread.moves[1].sourcefolder_dbid, sampleFolders[0].id, "Incorrect source folder");

            assert.ok(archive.deletes, "Didn't get any deletes");
            assert.strictEqual(archive.deletes.length, 1, "Didn't get enough deletes");
            assert.strictEqual(archive.deletes[0].bookmark_id, sampleBookmarks[3].bookmark_id, "Incorrect bookmark ID");
            assert.strictEqual(archive.deletes[0].type, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE, "Incorrect edit type");
        });
    });

    describe("InstapaperDBCore", () => {

        it("deleteCoreDbs", deleteCoreInfraDbs);

        it("canCreateTwoDataBasesAndTheyreIsolated", async () => {
            const dbNameOne = "One";
            const dbNameTwo = "Two";

            const bookmarkOne = {
                title: "Bookmark1",
                bookmark_id: 1,
                folder_dbid: null,
            };

            const bookmarkTwo = {
                title: "Bookmark2",
                bookmark_id: 2,
                folder_dbid: null
            };

            let [dbOne, dbTwo] = await Promise.all([
                getNewInstapaperDBAndInit(dbNameOne),
                getNewInstapaperDBAndInit(dbNameTwo)
            ]);

            bookmarkOne.folder_dbid = dbOne.commonFolderDbIds.unread;
            bookmarkTwo.folder_dbid = dbTwo.commonFolderDbIds.unread;

            await Promise.all([
                dbOne.addBookmark(bookmarkOne),
                dbTwo.addBookmark(bookmarkTwo)
            ]);


            let [dbOneBookmarks, dbTwoBookmarks] = await Promise.all([
                dbOne.listCurrentBookmarks(),
                dbTwo.listCurrentBookmarks()
            ]);

            assert.strictEqual(dbOneBookmarks.length, 1, "Wrong number of bookmarks in DB 1");
            assert.strictEqual(dbTwoBookmarks.length, 1, "Wrong number of bookmarks in DB 2");

            assert.strictEqual(dbOneBookmarks[0].title, bookmarkOne.title, "DB one bookmark has wrong title");
            assert.strictEqual(dbOneBookmarks[0].bookmark_id, bookmarkOne.bookmark_id, "DB one bookmark has wrong ID");

            assert.strictEqual(dbTwoBookmarks[0].title, bookmarkTwo.title, "DB two bookmark has wrong title");
            assert.strictEqual(dbTwoBookmarks[0].bookmark_id, bookmarkTwo.bookmark_id, "DB two bookmark has wrong ID");

            await Promise.all([
                dbOne.deleteAllData(),
                dbTwo.deleteAllData()
            ]);

            [dbOne, dbTwo] = await Promise.all([
                getNewInstapaperDBAndInit(dbNameOne),
                getNewInstapaperDBAndInit(dbNameTwo),
            ]);

            [dbOneBookmarks, dbTwoBookmarks] = await Promise.all([
                dbOne.listCurrentBookmarks(),
                dbTwo.listCurrentBookmarks()
            ]);

            assert.strictEqual(dbOneBookmarks.length, 0, "Wrong number of bookmarks in DB 1");
            assert.strictEqual(dbTwoBookmarks.length, 0, "Wrong number of bookmarks in DB 2");
        });

        it("deleteCoreDbsPostTest", deleteCoreInfraDbs);
    });
}