module Codevoid.Storyvoid {
    export interface ISyncNeededEventArgs {
        shouldSyncArticleBodies: boolean;
        complete(): void;
    }

    class SyndNeededEventArgs extends Utilities.Signal implements ISyncNeededEventArgs {
        public shouldSyncArticleBodies: boolean;
    }

    export class AutoSyncWatcher {
        public dbIdleDuration = 5 * 1000;
        public suspendedIdleDuration = 15 * 60 * 1000;

        private _eventSource = new Utilities.EventSource();
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        private _currentTimer: WinJS.Promise<any>;
        private _watchingPaused = false;
        private _suspendedTime = 0;

        constructor(dbEventSource: Utilities.EventSource, appEventSource: Utilities.EventSource) {
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
        }

        private _resetTimer(): void {
            if (this._currentTimer) {
                this._currentTimer.cancel();
            }

            this._currentTimer = WinJS.Promise.timeout(this.dbIdleDuration).then(() => {
                this._raiseSyncNeeded(false);
            });
        }

        private _raiseSyncNeeded(syncArticleBodies: boolean): WinJS.Promise<any> {
            var eventPayload = new SyndNeededEventArgs();
            eventPayload.shouldSyncArticleBodies = syncArticleBodies;

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

        // Note the type here to facilitate unit testing, and I apologise for the
        // vomit worthy interpretation of the types being f'd up. But, at the time,
        // I felt this was a better compromise than creating a whole different way
        // to raise an event just for this one case.
        private _handleEnteringBackground(e: any): void {
            var ev: Windows.UI.WebUI.EnteredBackgroundEventArgs = e.detail || e

            this._suspendedTime = Date.now();
            var deferral = ev.getDeferral();

            this._raiseSyncNeeded(false).done(() => {
                deferral.complete();
            }, () => {
                deferral.complete();
            });
        }

        private _handleLeavingBackground() {
            var timeSuspended = Date.now() - this._suspendedTime;
            var isLongerThanIdleDuration = (timeSuspended >= this.suspendedIdleDuration);

            this._raiseSyncNeeded(isLongerThanIdleDuration);
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