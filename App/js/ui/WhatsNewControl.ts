module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    const WHATS_NEW_RELEASE = "Update2";
    const WHATS_NEW_MESSAGE = "We've updated! We've added Dark Mode, Picture-in-Picture, Windows Timeline and more.";

    export class WhatsNewControl extends Codevoid.UICore.Control {
        private eventSource: Codevoid.Utilities.EventSource;
        private template: WinJS.Binding.Template;
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _messageContainer: HTMLElement;
        private _close: HTMLAnchorElement;
        private _detailsLink: HTMLAnchorElement;
        private cancelCallback: () => void;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            this.init();
        }

        private async init(): Promise<void> {
            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.WhatsNewControl");

            await this.template.render({}, this.element)
            DOM.marryPartsToControl(this.element, this);
            this._messageContainer.textContent = WHATS_NEW_MESSAGE

            this._handlersToCleanup.push(Utilities.addEventListeners(this._close, {
                click: () => this.dismiss()
            }));

            this._handlersToCleanup.push(Utilities.addEventListeners(this._detailsLink, {
                click: () => this.dismiss()
            }));
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item: Codevoid.Utilities.ICancellable) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
        }

        public dismiss(): void {
            WinJS.Utilities.addClass(this._close, "hide");
            WhatsNewControl.markAsShown();
            this.cancelCallback();
        }

        public static markAsShown(): void {
            const settings = new Settings.PermanentSettings();
            settings.whatsNewShownForRelease = WHATS_NEW_RELEASE;
        }

        public static shouldShowWhatsNew(): boolean {
            const settings = new Settings.PermanentSettings();
            return settings.whatsNewShownForRelease != WHATS_NEW_RELEASE;
        }
    }
}