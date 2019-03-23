﻿namespace Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class FullscreenSpinnerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _cancelButton: HTMLButtonElement;
        private _previouslyFocusedElement: HTMLElement;
        private viewModel: FullscreenSpinnerViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            this.init();
        }

        private async init(): Promise<void> {
            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();

            // Setup OS back button support
            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                backrequested: this.cancel.bind(this),
            }));

            this.element.tabIndex = -1; // Make sure the background can get focus so it doesn't jump to the body
            this.element.classList.add("dialog", "win-disposable", "fullscreenspinner-dialog", "hide");

            const template = await DOM.loadTemplate("/HtmlTemplates.html", "fullscreenSpinner");
            await template.render({}, this.element);

            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.SettingsPopupExperience");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.element, {
                keydown: (e: KeyboardEvent) => {
                    switch (e.keyCode) {
                        case WinJS.Utilities.Key.escape:
                            this.cancel();
                            break;
                    }
                }
            }));

            this.viewModel.dismissCallback = async () => {
                await WinJS.UI.Animation.slideDown(this.element);
                this.element.classList.add("hide");
            };

            this.element.classList.remove("hide");

            await WinJS.UI.Animation.slideUp(this.element);
            // Capture previously focused element so we focus it when the
            // spinner closed.
            this._previouslyFocusedElement = <HTMLElement>document.activeElement;
            this.element.focus();
        }

        public cancel(args?: Windows.UI.Core.BackRequestedEventArgs): void {
            if (args != null) {
                args.handled = true;
            }

            this.viewModel.complete(false);
        }

        public focusCancelButton(): void {
            this._cancelButton.focus();
        }
    }

    WinJS.Utilities.markSupportedForProcessing(FullscreenSpinnerExperience);
    WinJS.Utilities.markSupportedForProcessing(FullscreenSpinnerExperience.prototype.cancel);
    WinJS.Utilities.markSupportedForProcessing(FullscreenSpinnerExperience.prototype.focusCancelButton);

    export class FullscreenSpinnerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.FullscreenSpinnerExperience" };

        private displayDelay: Utilities.Debounce;
        private completionSignal = new Utilities.Signal();

        public dispose() { }

        public dismissCallback: () => PromiseLike<any>;

        public async complete(successful: boolean): Promise<void> {
            if (this.displayDelay) {
                this.displayDelay.cancel();
                this.displayDelay = null;
            }

            if (!this.completionSignal) {
                return;
            }

            const completionSignal = this.completionSignal;
            this.completionSignal = null;

            if (!successful) {
                await this.dismissCallback();
            }

            Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
            completionSignal.complete(successful);
        }

        public waitForCompletion(): PromiseLike<boolean> {
            return this.completionSignal.promise;
        }

        public show(params: { after: number }): void {
            this.displayDelay = new Utilities.Debounce(() => this.makeVisible(), (params && params.after) || 1);

            if (params && params.after) {
                this.displayDelay.bounce();
                return;
            }

            this.displayDelay.triggerNow();
        }

        public cancel(): void {
            this.complete(false);
        }

        private makeVisible(): void {
            this.displayDelay = null;
            Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this);
        }
    }
}