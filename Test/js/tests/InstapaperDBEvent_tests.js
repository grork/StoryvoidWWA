(function () {
    "use strict";

    var InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    var Signal = Codevoid.Utilities.Signal;
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive, InstapaperDB.CommonFolderIds.Orphaned];
    var deleteDb = InstapaperTestUtilities.deleteDb;
    var promiseTest = InstapaperTestUtilities.promiseTest;

    module("InstapaperStoreEventingFolders");
    promiseTest("deleteDb", deleteDb);
    promiseTest("hasEventContract", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            ok(idb.addEventListener, "Doesn't have the event listener contract");
        });
    });

    promiseTest("addingFolderRaisesAnEvent", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            var signal = new Signal();

            idb.addEventListener("folderschanged", function () {
                ok("folder event was raised");
                signal.complete();
            });

            return idb.addFolder({ title: Date.now() + "" }).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("addingFolderRaisesEventWithCorrectData", function () {
        return getNewInstapaperDBAndInit().then(function (idb) {
            var signal = new Signal();
            var title = Date.now() + "";

            idb.addEventListener("folderschanged", function (e) {
                var detail = e.detail;

                strictEqual(e.target, idb, "Instances of DB don't match");
                
                ok(detail, "didn't get parameter information");

                strictEqual(detail.operation, InstapaperDB.FolderChangeTypes.ADD, "Incorrect edit type");
                ok(detail.folder_dbid, "Didn't get a folder DB ID");
                strictEqual(detail.title, title, "Incorrect title");

                signal.complete();
            });

            return idb.addFolder({ title: title }).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("updatingFolderRaisesEventWithCorrectData", function () {
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

                ok(detail.folder, "No folder object on detail object");
                strictEqual(detail.operation, InstapaperDB.FolderChangeTypes.UPDATE, "Incorrect operation type");
                strictEqual(detail.folder_dbid, folder.id, "Incorrect folder ID");
                strictEqual(detail.folder.id, folder.id, "Incorrect folder on detail object");

                signal.complete();
            });

            return instapaperDB.updateFolder(folder).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("removingFolderRaisesEventWithCorrectData", function () {
        var instapaperDB;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.addFolder({ title: Date.now() + "" }, true);
        }).then(function (folder) {
            var signal = new Signal();

            instapaperDB.addEventListener("folderschanged", function (e) {
                var detail = e.detail;

                strictEqual(detail.operation, InstapaperDB.FolderChangeTypes.DELETE, "Incorrect operation type");
                strictEqual(detail.folder_dbid, folder.id);

                signal.complete();
            });

            return instapaperDB.removeFolder(folder.id, true).then(function () {
                return signal.promise;
            });
        });
    });

    module("InstapaperStoreEventingBookmarks");

    promiseTest("addingBookmarkRaisesEvent", function () {
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
                
                strictEqual(e.target, instapaperDB, "Event raised on wrong instance");

                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.ADD, "Incorrect bookmark edit type");
                ok(detail.bookmark, "Should have been supplied with a bookmark");
                
                strictEqual(detail.bookmark_id, createdBookmark.bookmark_id, "Incorrect bookmark ID");
                strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark on the event didn't match the bookmark in the detail");

                signal.complete();
            });

            return idb.addBookmark(createdBookmark, true).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("removingBookmarkRaisesEvent", function () {
        var instapaperDB;
        var removedBookmark;

        return getNewInstapaperDBAndInit().then(function (idb) {
            instapaperDB = idb;
            return idb.listCurrentBookmarks();
        }).then(function (bookmarks) {
            var signal = new Signal();

            ok(bookmarks, "No bookmarks to work with");
            ok(bookmarks.length, "No bookmarks to work with");

            removedBookmark = bookmarks.pop();

            instapaperDB.addEventListener("bookmarkschanged", function (e) {
                var detail = e.detail;

                ok(detail, "No detail object provided");
                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.DELETE, "Incorrect operation");
                strictEqual(detail.bookmark_id, removedBookmark.bookmark_id, "Incorrect bookmark ID was removed");

                strictEqual(e.target, instapaperDB, "raised on wrong object");

                signal.complete();
            });

            return instapaperDB.removeBookmark(removedBookmark.bookmark_id, true).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("updatingBookmarkRaisesEvent", function () {
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

                ok(detail, "no detail on event");
                ok(detail.bookmark, "no bookmark details on details");
                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.UPDATE, "Incorrect update type");
                strictEqual(detail.bookmark_id, bookmarkBeingUpdated.bookmark_id, "Incorrect bookmark changed");
                strictEqual(detail.bookmark_id, detail.bookmark.bookmark_id, "Bookmark ID on bookmark data doesn't match the bookmark the even is being raised for");
                strictEqual(detail.bookmark.title, bookmarkBeingUpdated.title, "Bookmark wasn't updated with the new title");

                signal.complete();
            });

            return instapaperDB.updateBookmark(bookmarkBeingUpdated).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("likingBookmarkRaisesEvent", function () {
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
                ok(detail, "didn't get any detail for the event");

                strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.LIKE, "Incorrect operation type");

                signal.complete();
            });

            return instapaperDB.likeBookmark(added.bookmark_id, true).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("unlikingBookmarkRaisesEvent", function () {
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
                ok(detail, "didn't get any detail for the event");

                strictEqual(detail.bookmark_id, added.bookmark_id, "incorrect bookmark");
                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.UNLIKE, "Incorrect operation type");

                signal.complete();
            });

            return instapaperDB.unlikeBookmark(added.bookmark_id, true).then(function () {
                return signal.promise;
            });
        });
    });

    promiseTest("movingBookmarkRaisesEvent", function () {
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

                ok(detail, "no detail on the event");
                strictEqual(e.target, instapaperDB, "Event raised on incorrect instance");

                strictEqual(detail.operation, InstapaperDB.BookmarkChangeTypes.MOVE, "Incorrect operation type");
                strictEqual(detail.bookmark_id, bookmark.bookmark_id, "event raised for wrong bookmark");
                strictEqual(detail.sourcefolder_dbid, instapaperDB.commonFolderDbIds.unread, "source folder was in correct");
                strictEqual(detail.destinationfolder_dbid, folder.id, "Incorrect destination folder");
                
                ok(detail.bookmark, "no bookmark data");
                strictEqual(detail.bookmark.bookmark_id, detail.bookmark_id, "Bookmark on detail was the wrong bookmark");
                strictEqual(detail.bookmark.folder_dbid, folder.id, "Folder data was incorrect");

                signal.complete();
            });

            return instapaperDB.moveBookmark(bookmark.bookmark_id, folder.id).then(function () {
                return signal.promise;
            });
        });
    });
})();