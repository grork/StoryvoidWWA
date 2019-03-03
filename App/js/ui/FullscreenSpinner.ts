module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class FullscreenSpinnerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _cancelButton: HTMLButtonElement;
        private _previouslyFocusedElement: HTMLElement;
        private viewModel: FullscreenSpinnerViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();

            // Setup OS back button support
            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                backrequested: this.cancel.bind(this),
            }));

            element.tabIndex = -1; // Make sure the background can get focus so it doesn't jump to the body
            element.classList.add("dialog", "win-disposable", "fullscreenspinner-dialog", "hide");

            DOM.loadTemplate("/HtmlTemplates.html", "fullscreenSpinner").then((template) => {
                return WinJS.Promise.join([
                    template.render({}, element),
                    WinJS.Promise.timeout()
                ]);
            }).then(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SettingsPopupExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.element, {
                    keydown: (e: KeyboardEvent) => {
                        switch (e.keyCode) {
                            case WinJS.Utilities.Key.escape:
                                this.cancel();
                                break;
                        }
                    }
                }));

                element.classList.remove("hide");
                WinJS.UI.Animation.slideUp(this.element).then(() => {
                    // Capture previously focused element so we focus it when the
                    // spinner closed.
                    this._previouslyFocusedElement = <HTMLElement>document.activeElement;
                    this.element.focus();
                });
            });

            this.viewModel.dismissCallback = () => {
                return WinJS.UI.Animation.slideDown(this.element).then(() => {
                    this.element.classList.add("hide");
                });
            };
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

        private displayDelay: WinJS.Promise<any>;
        private completionSignal = new Utilities.Signal();

        public dispose() {

        }

        public dismissCallback: () => WinJS.Promise<any>;

        public complete(successful: boolean): void {
            if (this.displayDelay) {
                this.displayDelay.cancel();
                this.displayDelay = null;
            }

            if (!this.completionSignal) {
                return;
            }

            const completionSignal = this.completionSignal;
            this.completionSignal = null;

            let removalDelay = WinJS.Promise.as();

            if (!successful) {
                removalDelay = this.dismissCallback();
            }

            removalDelay.then(() => {
                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this);
                completionSignal.complete(successful);
            });
        }

        public waitForCompletion(): WinJS.Promise<boolean> {
            return this.completionSignal.promise;
        }

        public show(params: { after: number }): void {
            this.displayDelay = WinJS.Promise.as();

            if (params && params.after) {
                this.displayDelay = WinJS.Promise.timeout(params.after);
            }

            this.displayDelay.then(() => {
                this.makeVisible();
            })
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