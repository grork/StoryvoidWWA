module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class WhatsNewControl extends Codevoid.UICore.Control {
        private eventSource: Codevoid.Utilities.EventSource;
        private initialMessage: string;
        private template: WinJS.Binding.Template;
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _messageContainer: HTMLElement;
        private _cancelSync: HTMLAnchorElement;
        private cancelCallback: () => void;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.WhatsNewControl");

            this.template.render({}, this.element).done(() => {
                DOM.marryPartsToControl(this.element, this);

                this._messageContainer.textContent = this.initialMessage;

                this._handlersToCleanup.push(Utilities.addEventListeners(this._cancelSync, {
                    click: () => this.dismiss()
                }));
            });
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item: Codevoid.Utilities.ICancellable) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
        }

        public dismiss(): void {
            WinJS.Utilities.addClass(this._cancelSync, "hide");
            this.cancelCallback();
        }
    }
}