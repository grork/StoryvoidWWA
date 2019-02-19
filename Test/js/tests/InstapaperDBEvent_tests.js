(function () {
    "use strict";

    var InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    var Signal = Codevoid.Utilities.Signal;
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var defaultFolderIds = [Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned];
    var deleteDb = InstapaperTestUtilities.deleteDb;

    describe("InstapaperStoreEventingFolders", function () {
        it("deleteDb", deleteDb.bind(null, null));
        it("hasEventContract", function () {
            return getNewInstapaperDBAndInit().then(function (idb) {
                assert.ok(idb.addEventListener, "Doesn't have the event listener contract");
            });
        });

        it("addingFolderRaisesAnEvent", function () {
            return getNewInstapaperDBAndInit().then(function (idb) {
                var signal = new Signal();

                idb.addEventListener("folderschanged", function () {
                    assert.ok("folder event was raised");
                    signal.complete();
                });

                return idb.addFolder({ title: Date.now() + "" }).then(function () {
                    return signal.promise;
                });
            });
        });

        it("addingFolderRaisesEventWithCorrectData", function () {
            return getNewInstapaperDBAndInit().then(function (idb) {
                var signal = new Signal();
                var title = Date.now() + "";

                idb.addEventListener("folderschanged", function (e) {
                    var detail = e.detail;

                    assert.strictEqual(e.target, idb, "Instances of DB don't match");

                    assert.ok(detail, "didn't get parameter information");

                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.ADD, "Incorrect edit type");
                    assert.ok(detail.folder_dbid, "Didn't get a folder DB ID");
                    assert.strictEqual(detail.title, title, "Incorrect title");

                    signal.complete();
                });

                return idb.addFolder({ title: title }).then(function () {
                    return signal.promise;
                });
            });
        });

        it("updatingFolderRaisesEventWithCorrectData", function () {
            var newTitle = Date.now() + "";
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return idb.listCurrentFolders().then(function (folders) {
                    return folders.filter(function (folder) {
                        return !folder.folder_id;
                    })[0];
                });
            }).then(function (folder) {
                var signal = new Signal();

                folder.title = newTitle;
                instapaperDB.addEventListener("folderschanged", function (e) {
                    var detail = e.detail;

                    assert.ok(detail.folder, "No folder object on detail object");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.UPDATE, "Incorrect operation type");
                    assert.strictEqual(detail.folder_dbid, folder.id, "Incorrect folder ID");
                    assert.strictEqual(detail.folder.id, folder.id, "Incorrect folder on detail object");

                    signal.complete();
                });

                return instapaperDB.updateFolder(folder).then(function () {
                    return signal.promise;
                });
            });
        });

        it("removingFolderRaisesEventWithCorrectData", function () {
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return idb.addFolder({ title: Date.now() + "" }, true);
            }).then(function (folder) {
                var signal = new Signal();

                instapaperDB.addEventListener("folderschanged", function (e) {
                    var detail = e.detail;

                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBFolderChangeTypes.DELETE, "Incorrect operation type");
                    assert.strictEqual(detail.folder_dbid, folder.id);

                    signal.complete();
                });

                return instapaperDB.removeFolder(folder.id, true).then(function () {
                    return signal.promise;
                });
            });
        });
    });

    describe("InstapaperStoreEventingBookmarks", function () {

        it("addingBookmarkRaisesEvent", function () {
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                var signal = new Signal();
                var createdBookmark = {
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                };

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;

                    assert.strictEqual(e.target, instapaperDB, "Event raised on wrong instance");

                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD, "Incorrect bookmark edit type");
                    assert.ok(detail.bookmark, "Should have been supplied with a bookmark");

                    assert.strictEqual(detail.bookmark_id, createdBookmark.bookmark_id, "Incorrect bookmark ID");
                    assert.strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark on the event didn't match the bookmark in the detail");

                    signal.complete();
                });

                return idb.addBookmark(createdBookmark, true).then(function () {
                    return signal.promise;
                });
            });
        });

        it("removingBookmarkRaisesEvent", function () {
            var instapaperDB;
            var removedBookmark;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return idb.listCurrentBookmarks();
            }).then(function (bookmarks) {
                var signal = new Signal();

                assert.ok(bookmarks, "No bookmarks to work with");
                assert.ok(bookmarks.length, "No bookmarks to work with");

                removedBookmark = bookmarks.pop();

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;

                    assert.ok(detail, "No detail object provided");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.DELETE, "Incorrect operation");
                    assert.strictEqual(detail.bookmark_id, removedBookmark.bookmark_id, "Incorrect bookmark ID was removed");

                    assert.strictEqual(e.target, instapaperDB, "raised on wrong object");

                    signal.complete();
                });

                return instapaperDB.removeBookmark(removedBookmark.bookmark_id, true).then(function () {
                    return signal.promise;
                });
            });
        });

        it("updatingBookmarkRaisesEvent", function () {
            var instapaperDB;
            var bookmarkBeingUpdated;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;

                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                }, true);
            }).then(function (bookmark) {
                var signal = new Signal();

                bookmarkBeingUpdated = bookmark;

                bookmarkBeingUpdated.title = Date.now() + "";

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;

                    assert.ok(detail, "no detail on event");
                    assert.ok(detail.bookmark, "no bookmark details on details");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UPDATE, "Incorrect update type");
                    assert.strictEqual(detail.bookmark_id, bookmarkBeingUpdated.bookmark_id, "Incorrect bookmark changed");
                    assert.strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark ID on bookmark data doesn't match the bookmark the even is being raised for");
                    assert.strictEqual(detail.bookmark.title, bookmarkBeingUpdated.title, "Bookmark wasn't updated with the new title");

                    signal.complete();
                });

                return instapaperDB.updateBookmark(bookmarkBeingUpdated).then(function () {
                    return signal.promise;
                });
            });
        });

        it("likingBookmarkRaisesEvent", function () {
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                }, true);
            }).then(function (added) {
                var signal = new Signal();

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;
                    assert.ok(detail, "didn't get any detail for the event");

                    assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.LIKE, "Incorrect operation type");

                    signal.complete();
                });

                return instapaperDB.likeBookmark(added.bookmark_id, true).then(function () {
                    return signal.promise;
                });
            });
        });

        it("unlikingBookmarkRaisesEvent", function () {
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return idb.addBookmark({
                    bookmark_id: Date.now(),
                    title: Date.now() + "",
                    url: "http://" + Date.now(),
                    folder_dbid: instapaperDB.commonFolderDbIds.unread,
                }, true);
            }).then(function (added) {
                return instapaperDB.likeBookmark(added.bookmark_id, true);
            }).then(function (added) {
                var signal = new Signal();

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;
                    assert.ok(detail, "didn't get any detail for the event");

                    assert.strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.UNLIKE, "Incorrect operation type");

                    signal.complete();
                });

                return instapaperDB.unlikeBookmark(added.bookmark_id, true).then(function () {
                    return signal.promise;
                });
            });
        });

        it("movingBookmarkRaisesEvent", function () {
            var instapaperDB;

            return getNewInstapaperDBAndInit().then(function (idb) {
                instapaperDB = idb;
                return WinJS.Promise.join({
                    bookmark: idb.addBookmark({
                        bookmark_id: Date.now(),
                        title: Date.now() + "",
                        url: "http://" + Date.now(),
                        folder_dbid: instapaperDB.commonFolderDbIds.unread,
                    }, true),
                    folder: idb.addFolder({ title: Date.now() + "" }),
                });
            }).then(function (data) {
                var folder = data.folder;
                var bookmark = data.bookmark;
                var signal = new Signal();

                instapaperDB.addEventListener("bookmarkschanged", function (e) {
                    var detail = e.detail;

                    assert.ok(detail, "no detail on the event");
                    assert.strictEqual(e.target, instapaperDB, "Event raised on incorrect instance");

                    assert.strictEqual(detail.operation, Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.MOVE, "Incorrect operation type");
                    assert.strictEqual(detail.bookmark_id, bookmark.bookmark_id, "event raised for wrong bookmark");
                    assert.strictEqual(detail.sourcefolder_dbid, instapaperDB.commonFolderDbIds.unread, "source folder was in correct");
                    assert.strictEqual(detail.destinationfolder_dbid, folder.id, "Incorrect destination folder");

                    assert.ok(detail.bookmark, "no bookmark data");
                    assert.strictEqual(detail.bookmark.bookmark_id, detail.bookmark_id, "Bookmark on detail was the wrong bookmark");
                    assert.strictEqual(detail.bookmark.folder_dbid, folder.id, "Folder data was incorrect");

                    signal.complete();
                });

                return instapaperDB.moveBookmark(bookmark.bookmark_id, folder.id).then(function () {
                    return signal.promise;
                });
            });
        });
    });
})();