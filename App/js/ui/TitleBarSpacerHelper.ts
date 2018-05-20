module Codevoid.Storyvoid.UI {
    export enum TitleBarSpacerRequired {
        Unknown,
        Yes,
        No
    }

    export class TitleBarSpaceHelper extends Codevoid.Utilities.EventSource {
        private _titleBarEventSource: Codevoid.Utilities.TitleBarVisibilityHelper;
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _view: Windows.UI.ViewManagement.ApplicationView;
        private _viewSettings: Windows.UI.ViewManagement.UIViewSettings;
        private _titleBarSpacerRequired = TitleBarSpacerRequired.Unknown;
        private _titleBarVisible: boolean;
        private _eventDebounceHandlerId = -1;

        private static _instance: TitleBarSpaceHelper;
        public static getInstance(): TitleBarSpaceHelper {
            if (!TitleBarSpaceHelper._instance) {
                TitleBarSpaceHelper._instance = new TitleBarSpaceHelper();
            }

            return TitleBarSpaceHelper._instance;
        }

        constructor() {
            super();

            this._titleBarEventSource = new Codevoid.Utilities.TitleBarVisibilityHelper();
            this._titleBarVisible = this._titleBarEventSource.isTitleBarVisible();

            this._handlersToCleanup.push(Utilities.addEventListeners(window, {
                resize: () => this._handleResize(),
            }));

            this._handlersToCleanup.push(Utilities.addEventListeners(this._titleBarEventSource, {
                titlebarvisibilitychanged: (args) => {
                    this._titleBarVisible = args.detail[0];
                    this.refresh();
                },
            }));
        }

        public dispose(): void {
            if (this._handlersToCleanup) {
                this._handlersToCleanup.forEach((item) => item.cancel());
                this._handlersToCleanup = null;
            }
        }

        public get spacerRequired(): TitleBarSpacerRequired {
            if (this._titleBarSpacerRequired === TitleBarSpacerRequired.Unknown) {
                this.setSpacerRequired(this.getSpacerRequired());
            }

            return this._titleBarSpacerRequired;
        }

        public refresh(): void {
            this.setSpacerRequired(this.getSpacerRequired());
        }

        private get view(): Windows.UI.ViewManagement.ApplicationView {
            if (!this._view) {
                this._view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            }

            return this._view;
        }

        private get viewSettings(): Windows.UI.ViewManagement.UIViewSettings {
            if (!this._viewSettings) {
                this._viewSettings = Windows.UI.ViewManagement.UIViewSettings.getForCurrentView();
            }

            return this._viewSettings;
        }

        private setSpacerRequired(value: TitleBarSpacerRequired) {
            if (this._titleBarSpacerRequired === value) {
                return;
            }

            this._titleBarSpacerRequired = value;
            this.dispatchEvent("spacerrequiredchanged", value);
        }

        private getSpacerRequired(): TitleBarSpacerRequired {
            const inTabletMode = (this.viewSettings.userInteractionMode === Windows.UI.ViewManagement.UserInteractionMode.touch);
            const isFullScreen = this.view.isFullScreenMode;
            const isTabbingSupported = (<any>this.view).isTabGroupingSupported; // Undefined on RS4 & below

            if (inTabletMode || isFullScreen || !this._titleBarVisible || isTabbingSupported) {
                return TitleBarSpacerRequired.No;
            }

            return TitleBarSpacerRequired.Yes;
        }

        private _handleResize(): void {
            if (this._eventDebounceHandlerId != -1) {
                clearTimeout(this._eventDebounceHandlerId);
                this._eventDebounceHandlerId = -1;
            }

            this._eventDebounceHandlerId = setTimeout(() => {
                this.setSpacerRequired(this.getSpacerRequired());
            }, 250);
        }
    }
}