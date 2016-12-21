module CodevoidTests.InstapaperArticleSyncTests {
    import sv = Codevoid.Storyvoid;

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;

    QUnit.module("AutoSyncWatcher");

    test("canConstructAutoSyncWatcher", () => {
        var syncWatcher = new sv.AutoSyncWatcher();
        ok(syncWatcher, "Couldn't construct sync watcher");
    });
}