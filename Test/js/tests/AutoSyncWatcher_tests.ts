module CodevoidTests.InstapaperArticleSyncTests {
    import sv = Codevoid.Storyvoid;
    import util = Codevoid.Utilities;

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;

    QUnit.module("AutoSyncWatcher");

    test("canConstructAutoSyncWatcher", () => {
        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        ok(syncWatcher, "Couldn't construct sync watcher");
    });

    promiseTest("timerDoesNotRaiseWithoutEvent", () => {
        var signal = new util.Signal();

        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        syncWatcher.idleDuration = 100;

        syncWatcher.eventSource.addEventListener("syncneeded", () => {
            signal.error("Promise Shouldn't Complete");
        });

        return WinJS.Promise.any([signal.promise, WinJS.Promise.timeout(200)]).then(() => {
            ok(true, "Completed");
        });
    });

    promiseTest("timerDoesRaiseAfterEvent", () => {
        var signal = new util.Signal();

        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        syncWatcher.idleDuration = 100;

        util.addEventListeners(syncWatcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.IAutoSyncInformation>) => {
                ok(!data.detail.shouldSyncArticleBodies, "Didn't expect full sync to be required");
                signal.complete();
            }
        });

        eventSource.dispatchEvent("bookmarkschanged", null);

        return signal.promise;
    });

    promiseTest("timerDoesRaiseAfterEvent", () => {
        var secondEventDispatched = false;
        var signal = new util.Signal();

        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        syncWatcher.idleDuration = 100;

        util.addEventListeners(syncWatcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.IAutoSyncInformation>) => {
                ok(!data.detail.shouldSyncArticleBodies, "Didn't expect full sync to be required");
                ok(secondEventDispatched, "Second event was not dispatched");
                signal.complete();
            }
        });

        // Start the timer
        eventSource.dispatchEvent("bookmarkschanged", null);

        // Reset the timer
        WinJS.Promise.timeout(75).then(() => {
            eventSource.dispatchEvent("bookmarkschanged", null);

            return WinJS.Promise.timeout(75);
        }).then(() => {
            // Reset the timer again
            eventSource.dispatchEvent("bookmarkschanged", null);
            secondEventDispatched = true;            
        });

        return signal.promise;
    });

    promiseTest("timerNotRaisedWhenWatchingPaused", () => {
        var syncEventSeen = false;
        var secondEventDispatched = false;
        var signal = new util.Signal();

        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        syncWatcher.idleDuration = 100;

        util.addEventListeners(syncWatcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.IAutoSyncInformation>) => {
                syncEventSeen = true;
            }
        });

        // Start the timer
        eventSource.dispatchEvent("bookmarkschanged", null);

        syncWatcher.pauseWatching();

        // Reset the timer
        WinJS.Promise.timeout(75).then(() => {
            eventSource.dispatchEvent("bookmarkschanged", null);

            return WinJS.Promise.timeout(75);
        }).then(() => {
            // Reset the timer again
            eventSource.dispatchEvent("bookmarkschanged", null);
            secondEventDispatched = true;
        });

        return WinJS.Promise.timeout(500).then(() => {
            ok(secondEventDispatched, "second timer wasn't dispatched");
            ok(!syncEventSeen, "Didn't expect to see sync needed");
        });
    });

    promiseTest("timerRaisedAfterAnEventAfterWatchingResumed", () => {
        var syncEventSeen = false;
        var signal = new util.Signal();

        var eventSource = new util.EventSource();
        var syncWatcher = new sv.AutoSyncWatcher(eventSource);
        syncWatcher.idleDuration = 50;

        util.addEventListeners(syncWatcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.IAutoSyncInformation>) => {
                ok(!syncEventSeen, "Sync event already seen");
                syncEventSeen = true;

                signal.complete();
            }
        });

        // Start the timer
        eventSource.dispatchEvent("bookmarkschanged", null);

        syncWatcher.pauseWatching();

        // Reset the timer
        WinJS.Promise.timeout(25).then(() => {
            eventSource.dispatchEvent("bookmarkschanged", null);

            syncWatcher.resumeWatching();

            // wait to make sure the event isn't some how raised
            return WinJS.Promise.timeout(100);
        }).done(() => {

            // Dispatch the event to start the timer
            eventSource.dispatchEvent("bookmarkschanged", null);
        });

        return signal.promise;
    });
}