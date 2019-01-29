/// <reference path="..\..\..\app\js\autosyncwatcher.ts" />

module CodevoidTests.InstapaperArticleSyncTests {
    import sv = Codevoid.Storyvoid;
    import util = Codevoid.Utilities;

    var promiseTest = InstapaperTestUtilities.promiseTest;

    QUnit.module("AutoSyncWatcher");

    function getWatcher() {
        var dbSource = new util.EventSource();
        var appSource = new util.EventSource();
        var networkSource = new util.EventSource();
        var watcher = new sv.AutoSyncWatcher(dbSource, appSource, networkSource);

        return {
            watcher: watcher,
            dbEventSource: dbSource,
            appEventSource: appSource,
            networkEventSource: networkSource,
        };
    }

    function getFakeEnteredBackgroundEventArgs(signal: util.Signal) {
        return {
            getDeferral(): { complete(): void } {
                return signal;
            },
        };
    }

    function getFakeNetworkStatusChanged(status: Windows.Networking.Connectivity.NetworkConnectivityLevel) {
        return {
            getNetworkConnectivityLevel() {
                return status;
            }
        };
    }

    promiseTest("timerDoesNotRaiseWithoutEvent", () => {
        var signal = new util.Signal();

        var syncWatcher = getWatcher().watcher;
        syncWatcher.dbIdleInterval = 100;

        syncWatcher.eventSource.addEventListener("syncneeded", () => {
            signal.error("Promise Shouldn't Complete");
        });

        return WinJS.Promise.any([signal.promise, WinJS.Promise.timeout(200)]).then(() => {
            QUnit.assert.ok(true, "Completed");
        });
    });

    promiseTest("timerDoesRaiseAfterEvent", () => {
        var signal = new util.Signal();

        var w = getWatcher();
        w.watcher.dbIdleInterval = 100;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                QUnit.expect(0);
                signal.complete();
            }
        });

        w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

        return signal.promise;
    });

    promiseTest("timerDoesGetCancelledIfSecondEventHappensInTimeWindow", () => {
        var secondEventDispatched = false;
        var signal = new util.Signal();

        var w = getWatcher();
        w.watcher.dbIdleInterval = 100;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                QUnit.assert.ok(secondEventDispatched, "Second event was not dispatched");
                signal.complete();
            }
        });

        // Start the timer
        w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

        // Reset the timer
        WinJS.Promise.timeout(75).then(() => {
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

            return WinJS.Promise.timeout(75);
        }).then(() => {
            // Reset the timer again
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });
            secondEventDispatched = true;
        });

        return signal.promise;
    });

    promiseTest("timerNotRaisedWhenWatchingPaused", () => {
        var syncEventSeen = false;
        var secondEventDispatched = false;
        var signal = new util.Signal();

        var w = getWatcher();
        w.watcher.dbIdleInterval = 100;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                syncEventSeen = true;
            }
        });

        // Start the timer
        w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

        w.watcher.pauseWatching();

        // Reset the timer
        WinJS.Promise.timeout(75).then(() => {
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

            return WinJS.Promise.timeout(75);
        }).then(() => {
            // Reset the timer again
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });
            secondEventDispatched = true;
        });

        return WinJS.Promise.timeout(500).then(() => {
            QUnit.assert.ok(secondEventDispatched, "second timer wasn't dispatched");
            QUnit.assert.ok(!syncEventSeen, "Didn't expect to see sync needed");
        });
    });

    promiseTest("timerRaisedAfterAnEventAfterWatchingResumed", () => {
        var syncEventSeen = false;
        var signal = new util.Signal();

        var w = getWatcher();
        w.watcher.dbIdleInterval = 50;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                QUnit.assert.ok(!syncEventSeen, "Sync event already seen");
                syncEventSeen = true;

                signal.complete();
            }
        });

        // Start the timer
        w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

        w.watcher.pauseWatching();

        // Reset the timer
        WinJS.Promise.timeout(25).then(() => {
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });

            w.watcher.resumeWatching();

            // wait to make sure the event isn't some how raised
            return WinJS.Promise.timeout(100);
        }).done(() => {

            // Dispatch the event to start the timer
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDB.BookmarkChangeTypes.ADD });
        });

        return signal.promise;
    });

    promiseTest("leavingBackgroundRaisesSyncNeededEventIfIdleForLongerThanMinDuration", () => {
        var syncEventSeen = false;
        var syncSeenSignal = new util.Signal();
        var enteredBackgroundCompleteSignal = new util.Signal();

        var w = getWatcher();
        w.watcher.minTimeInBackgroundBeforeSync = 10;

        w.appEventSource.dispatchEvent("enteredbackground", getFakeEnteredBackgroundEventArgs(enteredBackgroundCompleteSignal));

        WinJS.Promise.timeout(50).done(() => {
            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                    QUnit.assert.ok(!syncEventSeen, "Sync event already seen");
                    syncEventSeen = true;

                    syncSeenSignal.complete();
                }
            });

            w.appEventSource.dispatchEvent("leavingbackground", null);
        });

        return syncSeenSignal.promise;
    });

    QUnit.test("syncNotRequiredWhenTransitioningToOfflineState", () => {
        var syncEventSeen = false;

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeFullSync = -1;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                syncEventSeen = true;
            }
        });

        // Simulate going offline
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        QUnit.assert.ok(!syncEventSeen, "Didn't expect to see sync event");
    });

    QUnit.test("syncRequiredWhenTransitioningFromOfflineToOnlineState", () => {
        var syncEventSeen = false;

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeSync = -1;
        w.watcher.minTimeOfflineBeforeFullSync = -1;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                syncEventSeen = true;
            }
        });

        // Go offline to update previous state
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        // Go online to trigger the event
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess));

        QUnit.assert.ok(syncEventSeen, "Expected to see sync event");
    });

    QUnit.test("syncNotWhenTransitioningFromToOnlineStateToOnline", () => {
        var syncEventSeen = false;

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeSync = -1;
        w.watcher.minTimeOfflineBeforeFullSync = -1;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                syncEventSeen = true;
            }
        });

        // Go online
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess));

        // Go online to trigger the event
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess));

        QUnit.assert.ok(!syncEventSeen, "Didn't expect to see sync event");
    });

    QUnit.test("syncNotRequiredWhenTransitioningOfflineToOfflineState", () => {
        var syncEventSeen = false;

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeSync = -1;
        w.watcher.minTimeOfflineBeforeFullSync = -1;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                syncEventSeen = true;
            }
        });

        // Simulate going offline
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        // Simulate going offline
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        QUnit.assert.ok(!syncEventSeen, "Didn't expect to see sync event");
    });

    promiseTest("syncRequiredWhenOfflineForMoreThanMinimumOfflineTime", () => {
        var syncEventSeenSignal = new util.Signal();

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeSync = 10;
        w.watcher.minTimeOfflineBeforeFullSync = 100;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                QUnit.expect(0);
                syncEventSeenSignal.complete();
            }
        });

        // Go offline to update previous state
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        WinJS.Promise.timeout(50).done(() => {
            // Go online to trigger the event
            w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess));
        });

        return syncEventSeenSignal.promise;
    });

    promiseTest("syncRequiredAndIndicatesArticleSyncWhenOfflineForMoreThanMinimumOfflineTimeForFullSync", () => {
        var syncEventSeenSignal = new util.Signal();

        var w = getWatcher();
        w.watcher.minTimeOfflineBeforeSync = 10;
        w.watcher.minTimeOfflineBeforeFullSync = 40;

        util.addEventListeners(w.watcher.eventSource, {
            syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                QUnit.expect(0);
                syncEventSeenSignal.complete();
            }
        });

        // Go offline to update previous state
        w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.constrainedInternetAccess));

        WinJS.Promise.timeout(50).done(() => {
            // Go online to trigger the event
            w.networkEventSource.dispatchEvent("networkstatuschanged", getFakeNetworkStatusChanged(Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess));
        });

        return syncEventSeenSignal.promise;
    });
}