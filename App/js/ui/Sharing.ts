module Codevoid.Storyvoid.UI {
    import shareApi = Windows.ApplicationModel.DataTransfer;

    export class Sharing {
        private static _instance: Sharing;
        static get instance(): Sharing {
            if (!Sharing._instance) {
                Sharing._instance = new Sharing();
                Sharing._instance.init();
            }

            return Sharing._instance;
        }

        private transferManager: shareApi.DataTransferManager;
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        public bookmarkToShare: IBookmark;

        public getShareCommand(): ICommandOptions {
            return {
                label: "Share",
                tooltip: "Share (Ctrl + S)",
                icon: "\uE72D",
                keyCode: WinJS.Utilities.Key.s,
                onclick: () => shareApi.DataTransferManager.showShareUI(),
            };
        }

        private init(): void {
            if (!shareApi.DataTransferManager.isSupported) {
                return;
            }

            this.transferManager = shareApi.DataTransferManager.getForCurrentView();

            this._handlersToCleanup.push(Utilities.addEventListeners(this.transferManager, {
                datarequested: this.handleDataRequested.bind(this),
                targetApplicationChosen: this.handleTargetApplicationChosen.bind(this),
            }));
        }

        private handleDataRequested(e: shareApi.DataRequestedEventArgs) {
            if (!this.bookmarkToShare) {
                return;
            }

            const shareData = e.request.data;
            const uri = new Windows.Foundation.Uri(this.bookmarkToShare.url);
            shareData.setWebLink(uri);
            shareData.setText(`Saw this, thought you\'d like it: ${this.bookmarkToShare.title} via @Storyvoid`);
            shareData.properties.title = this.bookmarkToShare.title;
            shareData.properties.contentSourceWebLink = uri;
        }

        private handleTargetApplicationChosen(e: shareApi.TargetApplicationChosenEventArgs) {
            Telemetry.instance.track("SharedApplication", toPropertySet({ name: e.applicationName }));
        }
    }
}