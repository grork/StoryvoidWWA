﻿module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    import Settings = Codevoid.Storyvoid.Settings;

    interface HTMLSelectElementWithState extends HTMLSelectElement {
        isOpen: boolean;
    }

    export class SettingsPopupExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private viewModel: SettingsPopupViewModel;
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _homeArticleLimit: HTMLSelectElementWithState;
        private _likedArticleLimit: HTMLSelectElementWithState;
        private _archiveArticleLimit: HTMLSelectElementWithState;
        private _versionElement: HTMLDivElement;
        private _closeButton: HTMLButtonElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            
            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();

            WinJS.Utilities.addClass(element, "settingsPopup-dialog");
            WinJS.Utilities.addClass(element, "dialog");
            WinJS.Utilities.addClass(element, "win-disposable");
            WinJS.Utilities.addClass(element, "hide");

            DOM.loadTemplate("/HtmlTemplates.html", "settingsPopup").then((template) => {
                return WinJS.Promise.join([
                    template.render({}, element),
                    WinJS.Promise.timeout()
                ]);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SettingsPopupExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.element, {
                    keydown: (e: KeyboardEvent) => {
                        switch (e.key.toLowerCase()) {
                            case "esc":
                                this.close(null);
                                break;
                        }
                    }
                }));

                this._manageOpenStateOnSelectElement(this._homeArticleLimit);
                this._manageOpenStateOnSelectElement(this._likedArticleLimit);
                this._manageOpenStateOnSelectElement(this._archiveArticleLimit);

                // Setup OS back button support
                this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.visible;
                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                    backrequested: this.close.bind(this),
                }));

                var syncSettings = new Settings.SyncSettings();
                this._selectOptionBasedOnValue(syncSettings.homeArticleLimit, this._homeArticleLimit);
                this._selectOptionBasedOnValue(syncSettings.likedArticleLimit, this._likedArticleLimit);
                this._selectOptionBasedOnValue(syncSettings.archiveArticleLimit, this._archiveArticleLimit);

                var version = Windows.ApplicationModel.Package.current.id.version;
                var versionLabel = " " + version.major + "." + version.minor + "." + version.build + "." + version.revision;
                this._versionElement.innerText += versionLabel;

                WinJS.Utilities.removeClass(element, "hide");
                WinJS.UI.Animation.slideUp(this.element).done(() => {
                    this._homeArticleLimit.focus();
                });
            });
        }

        /// <summary>
        /// This method tries really hard to maintain open state on a select element,
        /// all with the goal of saying "oh, hey, someone pressed escape. If I'm open
        /// I should stop that event from proprgating so it doesn't do other things".
        /// But, if it's not open, then pretent like nothing happened.
        /// </summary>
        private _manageOpenStateOnSelectElement(dropDown: HTMLSelectElementWithState): void {
            this._handlersToCleanup.push(Utilities.addEventListeners(dropDown, {
                // Keypress is for space, and enter.
                // Space = open the select. Doesn't do anything when opened
                // Enter = selects an item in the liste. Doesn't do anything when closed
                keypress: (e: KeyboardEvent) => {
                    switch (e.keyCode) {
                        case WinJS.Utilities.Key.space:
                            dropDown.isOpen = true;
                            break;

                        case WinJS.Utilities.Key.enter:
                            dropDown.isOpen = false;
                            break;

                    }
                },
                // Keydown is to handle the cases where escape (dismiss), or alt+up/down
                // are pressed. Alt+up/down open/close the dialog, so just toggle the state
                // Escape is the real key -- it's the handler that stops other elements/handlers
                // from seeing escape *IF* it's open
                keydown: (e: KeyboardEvent) => {
                    switch (e.keyCode) {
                        case WinJS.Utilities.Key.escape:
                            console.log("Escaped");
                            if (dropDown.isOpen) {
                                e.stopPropagation();
                            }
                            dropDown.isOpen = false;
                            break;

                        case WinJS.Utilities.Key.upArrow:
                        case WinJS.Utilities.Key.downArrow:
                            dropDown.isOpen = !dropDown.isOpen;
                            break;
                    }
                },
                // Click can happen in & out of the dropdown. This basically
                // handles when you're interacting with it like a normal person.
                click: (e: KeyboardEvent) => {
                    dropDown.isOpen = !dropDown.isOpen;
                },
                // If you click OUTSIDE the dropdown, theres no event. But
                // we DO lose focus. assume focus lost means dismissal.
                focusout: () => {
                    dropDown.isOpen = false;
                }
            }));
        }

        public _firstDivFocused(): void {
            this._closeButton.focus();
        }

        public _lastDivFocused(): void {
            this._homeArticleLimit.focus();
        }

        public close(args?: Windows.UI.Core.BackRequestedEventArgs): void {
            if (args != null) {
                args.handled = true;
            }

            this.viewModel.dispose();
            this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.collapsed;

            WinJS.UI.Animation.slideDown(this.element).done(() => {
                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
                this.viewModel = null;
            });
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
        }

        public handleArticleLimitChanged(): void {
            var homeLimit = parseInt(this._homeArticleLimit.value);
            var likedLimit = parseInt(this._likedArticleLimit.value);
            var archiveLimit = parseInt(this._archiveArticleLimit.value);

            this.viewModel.updateArticleSyncLimits(homeLimit, likedLimit, archiveLimit);
        }

        public resetViewerSettings(): void {
            var viewerSettings = new Settings.ViewerSettings();
            viewerSettings.removeAllSettings();
        }

        public redownload(): void {
            this.viewModel.redownload();
            this.close();
        }

        public showLogViewer(): void {
            Utilities.Logging.instance.showViewer();
            this.close();
        }

        public dumpDb(): void {
            this.viewModel.articleListViewModel.dumpDb().done((dumpData: string) => {
                Utilities.Logging.instance.log("Dumped");

                Utilities.Logging.instance.log(dumpData, true);
            }, () => {
                Utilities.Logging.instance.log("Not dumped");
            });
        }

        public showDbFiddler(): void {
            this.viewModel.articleListViewModel.showDbFiddler();
            this.close();
        }
        private _selectOptionBasedOnValue(value: number, element: HTMLSelectElement): void {
            for (var i = 0; i < element.options.length; i++) {
                var itemValue = parseInt(element.options.item(i).value); // Assume all items are valid integers
                if (itemValue === value) {
                    element.selectedIndex = i;
                    return;
                }
            }   
        }
    }

    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.close);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype._firstDivFocused);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype._lastDivFocused);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.resetViewerSettings);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.redownload);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showLogViewer);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.dumpDb);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showLogViewer);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showDbFiddler);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.handleArticleLimitChanged);

    export class SettingsPopupViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SettingsPopupExperience" };

        constructor(public articleListViewModel: SignedInViewModel)
        { }

        public dispose(): void {
        }

        public redownload(): void {
            var articleListViewModel = this.articleListViewModel;
            articleListViewModel.signOut(false/*clearCredentials*/).then(() => {
                return WinJS.Promise.timeout();
            }).done(() => {
                articleListViewModel.signedIn(false);
            });
        }

        public updateArticleSyncLimits(homeLimit: number, likedLimit: number, archiveLimit: number): void {
            var syncSettings = new Settings.SyncSettings();
            syncSettings.homeArticleLimit = homeLimit;
            syncSettings.likedArticleLimit = likedLimit;
            syncSettings.archiveArticleLimit = archiveLimit;
        }
    }
}