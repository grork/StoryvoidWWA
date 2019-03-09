namespace CodeoidTests {
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    import Signal = Codevoid.Utilities.Signal;
    import getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    import deleteDb = InstapaperTestUtilities.deleteDb;
    const defaultFolderIds = [Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned];

    describe("InstapaperStoreEventingFolders", () => {
        it("deleteDb", deleteDb.bind(null, null));
        it("hasEventContract", async () => {
            const idb = await getNewInstapaperDBAndInit();
            assert.ok(idb.addEventListener, "Doesn't have the event listener contract");
        });

        it("addingFolderRaisesAnEvent", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const signal = new Signal();

            idb.addEventListener("folderschanged", () => {
                assert.ok("folder event was raised");
                signal.complete();
            });

            await idb.addFolder({ title: Date.now() + "" });
            await signal.promise
        });

        it("addingFolderRaisesEventWithCorrectData", async () => {
            const idb = await getNewInstapaperDBAndInit();
            const signal = new Signal();
            const title = Date.now() + "";

            idb.addEventListener("folderschanged", (e) => {
                let detail = e.detail;
                assert.ok(detail, "didn't get parameter information");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD, "Incorrect edit type");
                assert.ok(detail.folder_dbid, "Didn't get a folder DB ID");
                assert.strictEqual(detail.title, title, "Incorrect title");

                signal.complete();
            });

            await idb.addFolder({ title: title });
            await signal.promise;
        });

        it("updatingFolderRaisesEventWithCorrectData", async () => {
            const newTitle = Date.now() + "";

            const instapaperDB = await getNewInstapaperDBAndInit();
            const folder = (await instapaperDB.listCurrentFolders()).filter((folder) => !folder.folder_id)[0];
            const signal = new Signal();

            folder.title = newTitle;
            instapaperDB.addEventListener("folderschanged", function (e) {
                let detail = e.detail;

                assert.ok(detail.folder, "No folder object on detail object");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.UPDATE, "Incorrect operation type");
                assert.strictEqual(detail.folder_dbid, folder.id, "Incorrect folder ID");
                assert.strictEqual(detail.folder.id, folder.id, "Incorrect folder on detail object");

                signal.complete();
            });

            await instapaperDB.updateFolder(folder);
            await signal.promise;
        });

        it("removingFolderRaisesEventWithCorrectData", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const folder = await instapaperDB.addFolder({ title: Date.now() + "" }, true);
            const signal = new Signal();

            instapaperDB.addEventListener("folderschanged", function (e) {
                let detail = e.detail;

                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE, "Incorrect operation type");
                assert.strictEqual(detail.folder_dbid, folder.id);

                signal.complete();
            });

            await instapaperDB.removeFolder(folder.id, true);
            await signal.promise;
        });
    });

    describe("InstapaperStoreEventingBookmarks", () => {

        it("addingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const signal = new Signal();
            const createdBookmark = {
                bookmark_id: Date.now(),
                title: Date.now() + "",
                folder_dbid: instapaperDB.commonFolderDbIds.unread,
            };

            instapaperDB.addEventListener("bookmarkschanged", (e) => {
                let detail = e.detail;

                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD, "Incorrect bookmark edit type");
                assert.ok(detail.bookmark, "Should have been supplied with a bookmark");
                assert.strictEqual(detail.bookmark_id, createdBookmark.bookmark_id, "Incorrect bookmark ID");
                assert.strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark on the event didn't match the bookmark in the detail");

                signal.complete();
            });

            await instapaperDB.addBookmark(createdBookmark);
            await signal.promise;
        });

        it("removingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarks = await instapaperDB.listCurrentBookmarks();
            const signal = new Signal();

            assert.ok(bookmarks, "No bookmarks to work with");
            assert.ok(bookmarks.length, "No bookmarks to work with");

            const removedBookmark = bookmarks.pop();

            instapaperDB.addEventListener("bookmarkschanged", (e) => {
                let detail = e.detail;

                assert.ok(detail, "No detail object provided");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE, "Incorrect operation");
                assert.strictEqual(detail.bookmark_id, removedBookmark.bookmark_id, "Incorrect bookmark ID was removed");

                signal.complete();
            });

            await instapaperDB.removeBookmark(removedBookmark.bookmark_id, true);
            await signal.promise;
        });

        it("updatingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const bookmarkBeingUpdated = await instapaperDB.addBookmark({
                bookmark_id: Date.now(),
                title: Date.now() + "",
                url: "http://" + Date.now(),
                folder_dbid: instapaperDB.commonFolderDbIds.unread,
            });

            const signal = new Signal();
            bookmarkBeingUpdated.title = Date.now() + "";

            instapaperDB.addEventListener("bookmarkschanged", function (e) {
                let detail = e.detail;

                assert.ok(detail, "no detail on event");
                assert.ok(detail.bookmark, "no bookmark details on details");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UPDATE, "Incorrect update type");
                assert.strictEqual(detail.bookmark_id, bookmarkBeingUpdated.bookmark_id, "Incorrect bookmark changed");
                assert.strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark ID on bookmark data doesn't match the bookmark the even is being raised for");
                assert.strictEqual(detail.bookmark.title, bookmarkBeingUpdated.title, "Bookmark wasn't updated with the new title");

                signal.complete();
            });

            await instapaperDB.updateBookmark(bookmarkBeingUpdated);
            await signal.promise;
        });

        it("likingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            const added = await instapaperDB.addBookmark({
                bookmark_id: Date.now(),
                title: Date.now() + "",
                url: "http://" + Date.now(),
                folder_dbid: instapaperDB.commonFolderDbIds.unread,
            });
            const signal = new Signal();

            instapaperDB.addEventListener("bookmarkschanged", function (e) {
                let detail = e.detail;
                assert.ok(detail, "didn't get any detail for the event");

                assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Incorrect operation type");

                signal.complete();
            });

            await instapaperDB.likeBookmark(added.bookmark_id, true);
            await signal.promise
        });

        it("unlikingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();
            let added = await instapaperDB.addBookmark({
                bookmark_id: Date.now(),
                title: Date.now() + "",
                url: "http://" + Date.now(),
                folder_dbid: instapaperDB.commonFolderDbIds.unread,
            });

            added = await instapaperDB.likeBookmark(added.bookmark_id, true);
            const signal = new Signal();

            instapaperDB.addEventListener("bookmarkschanged", (e) => {
                let detail = e.detail;

                assert.ok(detail, "didn't get any detail for the event");
                assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Incorrect operation type");

                signal.complete();
            });

            await instapaperDB.unlikeBookmark(added.bookmark_id, true);
            await signal.promise;
        });

        it("movingBookmarkRaisesEvent", async () => {
            const instapaperDB = await getNewInstapaperDBAndInit();

            const [bookmark, folder] =
                await Promise.all([
                    instapaperDB.addBookmark({
                        bookmark_id: Date.now(),
                        title: Date.now() + "",
                        url: "http://" + Date.now(),
                        folder_dbid: instapaperDB.commonFolderDbIds.unread,
                    }),
                    instapaperDB.addFolder({ title: Date.now() + "" })
                ]);
            const signal = new Signal();

            instapaperDB.addEventListener("bookmarkschanged", (e) => {
                let detail = e.detail;

                assert.ok(detail, "no detail on the event");
                assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "Incorrect operation type");
                assert.strictEqual(detail.bookmark_id, bookmark.bookmark_id, "event raised for wrong bookmark");
                assert.strictEqual(detail.sourcefolder_dbid, instapaperDB.commonFolderDbIds.unread, "source folder was in correct");
                assert.strictEqual(detail.destinationfolder_dbid, folder.id, "Incorrect destination folder");

                assert.ok(detail.bookmark, "no bookmark data");
                assert.strictEqual(detail.bookmark.bookmark_id, detail.bookmark_id, "Bookmark on detail was the wrong bookmark");
                assert.strictEqual(detail.bookmark.folder_dbid, folder.id, "Folder data was incorrect");

                signal.complete();
            });

            await instapaperDB.moveBookmark(bookmark.bookmark_id, folder.id);
            await signal.promise;
        });
    });
}