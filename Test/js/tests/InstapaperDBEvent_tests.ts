namespace CodeoidTests {
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    import Signal = Codevoid.Utilities.Signal;
    import getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    import deleteDb = InstapaperTestUtilities.deleteDb;
    const defaultFolderIds = [Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned];

    describe("InstapaperStoreEventingFolders", () => {
        it("deleteDb", deleteDb.bind(null, null));
        it("hasEventContract", () => {
            return getNewInstapaperDBAndInit().then((idb) => assert.ok(idb.addEventListener, "Doesn't have the event listener contract"));
        });

        it("addingFolderRaisesAnEvent", () => {
            return getNewInstapaperDBAndInit().then((idb) => {
                const signal = new Signal();

                idb.addEventListener("folderschanged", () => {
                    assert.ok("folder event was raised");
                    signal.complete();
                });

                return idb.addFolder({ title: Date.now() + "" }).then(() =>  signal.promise);
            });
        });

        it("addingFolderRaisesEventWithCorrectData", () => {
            return getNewInstapaperDBAndInit().then((idb) => {
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

                return idb.addFolder({ title: title }).then(() => signal.promise);
            });
        });

        it("updatingFolderRaisesEventWithCorrectData", () => {
            const newTitle = Date.now() + "";
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentFolders().then((folders) => folders.filter((folder) => !folder.folder_id)[0]);
            }).then((folder) => {
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

                return instapaperDB.updateFolder(folder).then(() => signal.promise);
            });
        });

        it("removingFolderRaisesEventWithCorrectData", () => {
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addFolder({ title: Date.now() + "" }, true);
            }).then(function (folder) {
                const signal = new Signal();

                instapaperDB.addEventListener("folderschanged", function (e) {
                    let detail = e.detail;

                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE, "Incorrect operation type");
                    assert.strictEqual(detail.folder_dbid, folder.id);

                    signal.complete();
                });

                return instapaperDB.removeFolder(folder.id, true).then(() => signal.promise);
            });
        });
    });

    describe("InstapaperStoreEventingBookmarks", () => {

        it("addingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
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

                return idb.addBookmark(createdBookmark).then(() => signal.promise);
            });
        });

        it("removingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;
            let removedBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.listCurrentBookmarks();
            }).then(function (bookmarks) {
                const signal = new Signal();

                assert.ok(bookmarks, "No bookmarks to work with");
                assert.ok(bookmarks.length, "No bookmarks to work with");

                removedBookmark = bookmarks.pop();

                instapaperDB.addEventListener("bookmarkschanged", (e) => {
                    let detail = e.detail;

                    assert.ok(detail, "No detail object provided");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE, "Incorrect operation");
                    assert.strictEqual(detail.bookmark_id, removedBookmark.bookmark_id, "Incorrect bookmark ID was removed");

                    signal.complete();
                });

                return instapaperDB.removeBookmark(removedBookmark.bookmark_id, true).then(() => signal.promise);
            });
        });

        it("updatingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;
            let bookmarkBeingUpdated: Codevoid.Storyvoid.IBookmark;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;

                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                });
            }).then((bookmark) => {
                const signal = new Signal();

                bookmarkBeingUpdated = bookmark;
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

                return instapaperDB.updateBookmark(bookmarkBeingUpdated).then(() => signal.promise);
            });
        });

        it("likingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                });
            }).then((added) => {
                const signal = new Signal();

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    let detail = e.detail;
                    assert.ok(detail, "didn't get any detail for the event");

                    assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Incorrect operation type");

                    signal.complete();
                });

                return instapaperDB.likeBookmark(added.bookmark_id, true).then(() => signal.promise);
            });
        });

        it("unlikingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                });
            }).then((added) => instapaperDB.likeBookmark(added.bookmark_id, true)).then((added) => {
                const signal = new Signal();

                instapaperDB.addEventListener("bookmarkschanged", (e) => {
                    let detail = e.detail;

                    assert.ok(detail, "didn't get any detail for the event");
                    assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Incorrect operation type");

                    signal.complete();
                });

                return instapaperDB.unlikeBookmark(added.bookmark_id, true).then(() => signal.promise);
            });
        });

        it("movingBookmarkRaisesEvent", () => {
            let instapaperDB: InstapaperDB;

            return getNewInstapaperDBAndInit().then((idb) => {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    bookmark: idb.addBookmark({
                        bookmark_id: Date.now(),
                        title: Date.now() + "",
                        url: "http://" + Date.now(),
                        folder_dbid: instapaperDB.commonFolderDbIds.unread,
                    }),
                    folder: idb.addFolder({ title: Date.now() + "" }),
                });
            }).then((data) => {
                let folder = data.folder;
                let bookmark = data.bookmark;
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

                return instapaperDB.moveBookmark(bookmark.bookmark_id, folder.id).then(() => signal.promise);
            });
        });
    });
}