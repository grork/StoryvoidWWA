module Codevoid.Storyvoid {
    export interface IAutoSyncInformation {
        shouldSyncArticleBodies: boolean;
    }

    export class AutoSyncWatcher {
        public idleDuration: number = 5 * 1000;

        private _eventSource = new Utilities.EventSource();
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        private _currentTimer: WinJS.Promise<any>;
        private _watchingPaused = false;

        constructor(eventSource: Utilities.EventSource) {
            this._handlersToCleanup.push(Utilities.addEventListeners(eventSource, {
                bookmarkschanged: () => {
                    if (this._watchingPaused) {
                        return;
                    }

                    this._resetTimer();
                }
            }));
        }

        private _resetTimer(): void {
            if (this._currentTimer) {
                this._currentTimer.cancel();
            }

            this._currentTimer = WinJS.Promise.timeout(this.idleDuration).then(() => {
                this._considerRaisingSyncNeededEvent();
            });
        }

        private _considerRaisingSyncNeededEvent(): void {
            this._eventSource.dispatchEvent("syncneeded", { shouldSyncArticleBodies: false });
        }

        private _cancelTimer(): void {
            if (!this._currentTimer) {
                return;
            }

            this._currentTimer.cancel();
            this._currentTimer = null;
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
    }
}