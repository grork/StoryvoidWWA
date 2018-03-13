module Codevoid.Storyvoid {
    // Temporarily placed here as typescript isn't resolving
    // the type when it's in a separate file
    export enum SyncReason {
        None = "None",
        Initial = "Initial",
        Launched = "Launched",
        Explicit = "Explicit",
        Backgrounded = "Backgrounded",
        Foregrounded = "Foregrounded",
        Timer = "Timer",
        CameOnline = "CameOnline"
    }

    export interface ISyncNeededEventArgs {
        reason: SyncReason;
        shouldSyncArticleBodies: boolean;
        complete(): void;
    }

    class SyndNeededEventArgs extends Utilities.Signal implements ISyncNeededEventArgs {
        public reason: SyncReason;
        public shouldSyncArticleBodies: boolean;
    }

    export class AutoSyncWatcher {
        public dbIdleInterval = 5 * 1000;
        public minTimeInBackgroundBeforeSync = 60 * 1000;
        public minTimeOfflineBeforeSync = 60 * 60 * 1000;
        public minTimeOfflineBeforeFullSync = 60 * 1000;

        private _eventSource = new Utilities.EventSource();
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        private _currentTimer: WinJS.Promise<any>;
        private _watchingPaused = false;
        private _suspendedAt = 0;
        private _wentOfflineAt = 0;
        private _previousInternetState = Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess;

        constructor(dbEventSource: Utilities.EventSource,
                    appEventSource: Utilities.EventSource,
                    networkEventSource: Utilities.EventSource) {

            this._handlersToCleanup.push(Utilities.addEventListeners(dbEventSource, {
                bookmarkschanged: () => {
                    if (this._watchingPaused) {
                        return;
                    }

                    this._resetTimer();
                }
            }));

            this._handlersToCleanup.push(Utilities.addEventListeners(appEventSource, {
                enteredbackground: this._handleEnteringBackground.bind(this),
                leavingbackground: this._handleLeavingBackground.bind(this),
            }));

            this._handlersToCleanup.push(Utilities.addEventListeners(networkEventSource, {
                networkstatuschanged: this._handleNetworkStatusChanged.bind(this),
            }));
        }

        private _resetTimer(): void {
            if (this._currentTimer) {
                this._currentTimer.cancel();
            }

            this._currentTimer = WinJS.Promise.timeout(this.dbIdleInterval).then(() => {
                this._raiseSyncNeeded(false, SyncReason.Timer);
            });
        }

        private _raiseSyncNeeded(syncArticleBodies: boolean, reason: SyncReason): WinJS.Promise<any> {
            var eventPayload = new SyndNeededEventArgs();
            eventPayload.shouldSyncArticleBodies = syncArticleBodies;
            eventPayload.reason = reason;

            this._eventSource.dispatchEvent("syncneeded", eventPayload);
            
            return eventPayload.promise;
        }

        private _cancelTimer(): void {
            if (!this._currentTimer) {
                return;
            }

            this._currentTimer.cancel();
            this._currentTimer = null;
        }

        private _handleEnteringBackground(e: any): void {
            this._suspendedAt = Date.now();
        }

        private _handleLeavingBackground() {
            var timeSuspended = Date.now() - this._suspendedAt;
            this._suspendedAt = 0;

            // If we're not in the background for long enough, lets not kick off a sync
            // we dont want to constantly be picking off a sync when the user is switching
            // between apps
            var wasSuspendedLongEnoughToRequireSync = (timeSuspended >= this.minTimeInBackgroundBeforeSync);
            if (!wasSuspendedLongEnoughToRequireSync) {
                return;
            }

            this._raiseSyncNeeded(true, SyncReason.Foregrounded);
        }

        private _handleNetworkStatusChanged(e: any) {
            var internetProfile: { getNetworkConnectivityLevel(): Windows.Networking.Connectivity.NetworkConnectivityLevel } = e.target != null ? e.detail : Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            var newInternetState = Windows.Networking.Connectivity.NetworkConnectivityLevel.none;
            if (internetProfile) {
                newInternetState = internetProfile.getNetworkConnectivityLevel();
            }

            // When the status is unchanged, there's nothing for us to do
            if (this._previousInternetState === newInternetState) {
                return;
            }

            if (newInternetState != Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess) {
                if (this._previousInternetState === Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess) {
                    // If we *were* previously offline, we need to capture the time to measure how long we were offline
                    this._wentOfflineAt = Date.now();
                }

                this._previousInternetState = newInternetState;

                // We're not online, so theres nothing for us to do
                return;
            }

            this._previousInternetState = newInternetState;

            // It's different from before, and we're now definitely online, so lets raise the event
            var timeOffline = Date.now() - this._wentOfflineAt;
            var wasOfflineLongEnoughToRequireFullSync = (timeOffline >= this.minTimeOfflineBeforeFullSync);
            this._wentOfflineAt = 0;

            var wasOfflineLongEnoughToRequireSync = (timeOffline >= this.minTimeOfflineBeforeSync);
            if (!wasOfflineLongEnoughToRequireSync) {
                return;
            }

            this._raiseSyncNeeded(wasOfflineLongEnoughToRequireFullSync, SyncReason.CameOnline);
        }

        public get eventSource(): Utilities.EventSource {
            return this._eventSource;
        }

        public pauseWatching(): void {
            this._watchingPaused = true;
            this._cancelTimer();
        }

        public resumeWatching(): void {
            this._watchingPaused = false;
        }

        public dispose(): void {
            this._cancelTimer();

            if (!this._handlersToCleanup || !this._handlersToCleanup.length) {
                return;
            }

            this._handlersToCleanup.forEach((item) => {
                item.cancel();
            });

            this._handlersToCleanup = [];
        }
    }
}