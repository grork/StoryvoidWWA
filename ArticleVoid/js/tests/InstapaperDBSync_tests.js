(function () {
    "use strict";

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);
    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
    var defaultFolderIds = [InstapaperDB.CommonFolderIds.Unread, InstapaperDB.CommonFolderIds.Liked, InstapaperDB.CommonFolderIds.Archive];
    var getNewInstapaperDBAndInit = InstapaperTestUtilities.getNewInstapaperDBAndInit;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;
    var promiseTest = InstapaperTestUtilities.promiseTest;
    var expectNoPendingFolderEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var expectNoPendingBookmarkEdits = InstapaperTestUtilities.expectNoPendingBookmarkEdits;
    var deleteDb = InstapaperTestUtilities.deleteDb;

    var addedRemoteFolders = [
        { title: "sampleFolder1", },
        { title: "sampleFolder2", },
        { title: "sampleFolder3", },
    ];

    function getNewSyncEngine() {
        return new Codevoid.ArticleVoid.InstapaperSync(clientInformation);
    }

    function deleteAllRemoteBookmarks(bookmarksToDelete) {
        var client = this;
        var deletePromises = [];
        bookmarksToDelete.forEach(function (bookmark) {
            client.deleteBookmark(bookmark.bookmark_id);
        });

        return WinJS.Promise.join(deletePromises);
    }

    module("InstapaperSync");

    function destroyRemoteAccountData() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

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
            return bookmarks.list({ folder_id: "unread" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "starred" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            return bookmarks.list({ folder_id: "archive" }).then(deleteAllRemoteBookmarks.bind(bookmarks));
        }).then(function () {
            ok(true, "It went very very wrong");
        });
    }

    promiseTest("destoryRemoteDataOnStart", destroyRemoteAccountData);
    promiseTest("deleteDbOnStart", deleteDb);

    function addDefaultRemoteFolders() {
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
        return  sync.sync().then(function () {
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
    //promiseTest("destroyRemoteAccountDataCleanUpLast", destroyRemoteAccountData);
})();