/// <reference path="..\..\..\app\js\autosyncwatcher.ts" />

module CodevoidTests.InstapaperArticleSyncTests {
    import sv = Codevoid.Storyvoid;
    import util = Codevoid.Utilities;

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

    describe("AutoSyncWatcher", function () {

        it("timerDoesNotRaiseWithoutEvent", () => {
            var signal = new util.Signal();

            var syncWatcher = getWatcher().watcher;
            syncWatcher.dbIdleInterval = 100;

            syncWatcher.eventSource.addEventListener("syncneeded", () => {
                signal.error("Promise Shouldn't Complete");
            });

            return WinJS.Promise.any([signal.promise, WinJS.Promise.timeout(200)]).then(() => {
                assert.ok(true, "Completed");
            });
        });

        it("timerDoesRaiseAfterEvent", () => {
            var signal = new util.Signal();

            var w = getWatcher();
            w.watcher.dbIdleInterval = 100;

            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                    signal.complete();
                }
            });

            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

            return signal.promise;
        });

        it("timerDoesGetCancelledIfSecondEventHappensInTimeWindow", () => {
            var secondEventDispatched = false;
            var signal = new util.Signal();

            var w = getWatcher();
            w.watcher.dbIdleInterval = 100;

            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                    assert.ok(secondEventDispatched, "Second event was not dispatched");
                    signal.complete();
                }
            });

            // Start the timer
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

            // Reset the timer
            WinJS.Promise.timeout(75).then(() => {
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

                return WinJS.Promise.timeout(75);
            }).then(() => {
                // Reset the timer again
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });
                secondEventDispatched = true;
            });

            return signal.promise;
        });

        it("timerNotRaisedWhenWatchingPaused", () => {
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
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

            w.watcher.pauseWatching();

            // Reset the timer
            WinJS.Promise.timeout(75).then(() => {
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

                return WinJS.Promise.timeout(75);
            }).then(() => {
                // Reset the timer again
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });
                secondEventDispatched = true;
            });

            return WinJS.Promise.timeout(500).then(() => {
                assert.ok(secondEventDispatched, "second timer wasn't dispatched");
                assert.ok(!syncEventSeen, "Didn't expect to see sync needed");
            });
        });

        it("timerRaisedAfterAnEventAfterWatchingResumed", () => {
            var syncEventSeen = false;
            var signal = new util.Signal();

            var w = getWatcher();
            w.watcher.dbIdleInterval = 50;

            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                    assert.ok(!syncEventSeen, "Sync event already seen");
                    syncEventSeen = true;

                    signal.complete();
                }
            });

            // Start the timer
            w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

            w.watcher.pauseWatching();

            // Reset the timer
            WinJS.Promise.timeout(25).then(() => {
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });

                w.watcher.resumeWatching();

                // wait to make sure the event isn't some how raised
                return WinJS.Promise.timeout(100);
            }).done(() => {

                // Dispatch the event to start the timer
                w.dbEventSource.dispatchEvent("bookmarkschanged", { operation: Codevoid.Storyvoid.InstapaperDBBookmarkChangeTypes.ADD });
            });

            return signal.promise;
        });

        it("leavingBackgroundRaisesSyncNeededEventIfIdleForLongerThanMinDuration", () => {
            var syncEventSeen = false;
            var syncSeenSignal = new util.Signal();
            var enteredBackgroundCompleteSignal = new util.Signal();

            var w = getWatcher();
            w.watcher.minTimeInBackgroundBeforeSync = 10;

            w.appEventSource.dispatchEvent("enteredbackground", getFakeEnteredBackgroundEventArgs(enteredBackgroundCompleteSignal));

            WinJS.Promise.timeout(50).done(() => {
                util.addEventListeners(w.watcher.eventSource, {
                    syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
                        assert.ok(!syncEventSeen, "Sync event already seen");
                        syncEventSeen = true;

                        syncSeenSignal.complete();
                    }
                });

                w.appEventSource.dispatchEvent("leavingbackground", null);
            });

            return syncSeenSignal.promise;
        });

        it("syncNotRequiredWhenTransitioningToOfflineState", () => {
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

            assert.ok(!syncEventSeen, "Didn't expect to see sync event");
        });

        it("syncRequiredWhenTransitioningFromOfflineToOnlineState", () => {
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

            assert.ok(syncEventSeen, "Expected to see sync event");
        });

        it("syncNotWhenTransitioningFromToOnlineStateToOnline", () => {
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

            assert.ok(!syncEventSeen, "Didn't expect to see sync event");
        });

        it("syncNotRequiredWhenTransitioningOfflineToOfflineState", () => {
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

            assert.ok(!syncEventSeen, "Didn't expect to see sync event");
        });

        it("syncRequiredWhenOfflineForMoreThanMinimumOfflineTime", () => {
            var syncEventSeenSignal = new util.Signal();

            var w = getWatcher();
            w.watcher.minTimeOfflineBeforeSync = 10;
            w.watcher.minTimeOfflineBeforeFullSync = 100;

            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
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

        it("syncRequiredAndIndicatesArticleSyncWhenOfflineForMoreThanMinimumOfflineTimeForFullSync", () => {
            var syncEventSeenSignal = new util.Signal();

            var w = getWatcher();
            w.watcher.minTimeOfflineBeforeSync = 10;
            w.watcher.minTimeOfflineBeforeFullSync = 40;

            util.addEventListeners(w.watcher.eventSource, {
                syncneeded: (data: util.EventObject<sv.ISyncNeededEventArgs>) => {
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
    });
}