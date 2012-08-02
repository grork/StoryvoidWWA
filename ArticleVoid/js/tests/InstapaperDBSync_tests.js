(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);

    var defaultFolderIds = ["unread", "starred", "archive"];

    function startOnSuccessOfPromise() {
        start();
    }

    function startOnFailureOfPromise(error) {
        debugger;
        ok(false, "Failed: " + error.toString());
        start();
    }

    function promiseTest(name, func) {
        asyncTest(name, function () {
            WinJS.Promise.as(func()).done(startOnSuccessOfPromise, startOnFailureOfPromise);
        });
    }

    function expectNoPendingFolderEdits(idb) {
        return idb.getPendingFolderEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    function expectNoPendingBookmarkEdits(idb) {
        return idb.getPendingBookmarkEdits().then(function (pendingEdits) {
            ok(pendingEdits, "Expected valid pending edits structure");
            strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;

    function multipleEditsOnSameFolderFunction() {
        /*
        If you add a deleted folder, then theres no id from the server
        to ID it. However, the server will barf on similar titles.
        Should we key off the title too? Maybe?
        Does that mean we want an index? Infact, given that it's
        a requirement we should check on adding multiple folders.

        Assuming we enforce that, how can we check to make sure if
        we re-add the same named folder, what we do? Do we just
        resurrect the folder from the deleted hole because we
        left the folder name in there and can use that? Probably.

        What about bookmarks when we're deleting folders?
        Well, we should probably just manually move all the bookmarks
        into the unread folder.
        */
        ok(true);
    }

    module("InstapaperDBFoldersSync");

    function addDefaultRemoteData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return folders.add("sampleFolder1").then(function (folder) {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage1.html",
                folder_id: folder.folder_id
            });
        }).then(function () {
            return folders.add("sampleFolder2");
        }).then(function (folder) {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage2.html",
                folder_id: folder.folder_id,
            });
        }).then(function () {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage3.html"
            });
        }).then(function (addedBookmark) {
            return bookmarks.archive(addedBookmark.bookmark_id);
        }).then(function () {
            return bookmarks.add({
                url: "http://www.codevoid.net/articlevoidtest/TestPage4.html"
            });
        }).then(function (addedBookmark) {
            return bookmarks.star(addedBookmark.bookmark_id);
        }).then(function () {
            ok(true, "it went very very wrong");
        });
    }

    //promiseTest("destroyRemoteAccountDataCleanUpFirst", destroyRemoteAccountData);
    //promiseTest("addDefaultRemoteData", addDefaultRemoteData);

    function addsFoldersOnFirstSight() {
        ok(true);
    }

    //promiseTest("addsFoldersOnFirstSight", addsFoldersOnFirstSight);

    module("InstapaperDBdestroyRemoteAccountData")

    function deleteAllRemoteBookmarks(bookmarksToDelete) {
        var client = this;
        var deletePromises = [];
        bookmarksToDelete.forEach(function (bookmark) {
            client.deleteBookmark(bookmark.bookmark_id);
        });

        return WinJS.Promise.join(deletePromises);
    }

    function destroyRemoteAccountData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        return folders.list().then(function (serverFolders) {
            var deletedFoldersPromises = [];
            serverFolders.forEach(function (folder) {
                // We can't delete the default folders, so skip them
                switch (folder.folder_id) {
                    case "unread":
                    case "starred":
                    case "archive":
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

    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();