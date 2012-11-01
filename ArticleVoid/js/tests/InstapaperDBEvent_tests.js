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
})();