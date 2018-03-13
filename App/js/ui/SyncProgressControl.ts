module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SyncProgressControl extends Codevoid.UICore.Control {
        private eventSource: Codevoid.Utilities.EventSource;
        private initialMessage: string;
        private template: WinJS.Binding.Template;
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _messageContainer: HTMLElement;
        private _spinner: HTMLElement;
        private _checkMark: HTMLElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SyncProgressControl");

            this.template.render({}, this.element).done(() => {
                DOM.marryPartsToControl(this.element, this);

                this._messageContainer.textContent = this.initialMessage;

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.eventSource, {
                    syncprogressupdate: (e: Utilities.EventObject<{ message: string }>) => {
                        this._messageContainer.textContent = e.detail.message;
                    },
                    synccompleted: () => {
                        this._syncComplete();
                    }
                }));
            });
        }

        private _syncComplete(): void {
            this._messageContainer.textContent = "Up to date!";

            WinJS.Utilities.addClass(this._spinner, "hide");
            WinJS.Utilities.removeClass(this._checkMark, "hide");
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item: Codevoid.Utilities.ICancellable) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
        }
    }
}