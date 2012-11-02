(function () {
    "use strict";

    var InstapaperDB = Codevoid.ArticleVoid.InstapaperDB;
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

                strictEqual(detail.operation, InstapaperDB.PendingFolderEditTypes.ADD, "Incorrect edit type");
                ok(detail, "Didn't get any data");

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

                strictEqual(detail.operation, InstapaperDB.PendingFolderEditTypes.UPDATE, "Incorrect operation type");
                strictEqual(detail.folder_dbid, folder.id, "Incorrect folder ID");

                ok(detail.folder, "Wasn't supplied with folder detail");

                strictEqual(detail.folder.id, folder.id, "Incorrect folder detail");
                strictEqual(detail.folder.title, newTitle, "Incorrect title");

                signal.complete();
            });

            return instapaperDB.updateFolder(folder).then(function () {
                return signal.promise;
            });
        });
    });
})();