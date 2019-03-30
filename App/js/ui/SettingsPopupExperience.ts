module Codevoid.Storyvoid.UI {
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
        private _otherFoldersArticleLimit: HTMLSelectElementWithState;
        private _allowCollectingTelemetry: HTMLSelectElementWithState;
        private _uiTheme: HTMLSelectElementWithState;
        private _versionElement: HTMLDivElement;
        private _closeButton: HTMLButtonElement;
        private _previouslyFocusedElement: HTMLElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            this.init();
        }

        private async init(): Promise<void> {
            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();
            this.element.tabIndex = -1; // Make sure the background can get focus so it doesn't jump to the body

            WinJS.Utilities.addClass(this.element, "settingsPopup-dialog");
            WinJS.Utilities.addClass(this.element, "dialog");
            WinJS.Utilities.addClass(this.element, "win-disposable");
            WinJS.Utilities.addClass(this.element, "hide");

            const template = await DOM.loadTemplate("/HtmlTemplates.html", "settingsPopup");
            await template.render({}, this.element);

            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.SettingsPopupExperience");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.element, {
                keydown: (e: KeyboardEvent) => {
                    switch (e.keyCode) {
                        case WinJS.Utilities.Key.escape:
                            this.close(null);
                            break;
                    }
                }
            }));

            this._manageOpenStateOnSelectElement(this._homeArticleLimit);
            this._manageOpenStateOnSelectElement(this._likedArticleLimit);
            this._manageOpenStateOnSelectElement(this._archiveArticleLimit);
            this._manageOpenStateOnSelectElement(this._otherFoldersArticleLimit);
            this._manageOpenStateOnSelectElement(this._allowCollectingTelemetry);
            this._manageOpenStateOnSelectElement(this._uiTheme);

            // Setup OS back button support
            this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.visible;
            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                backrequested: this.close.bind(this),
            }));

            var syncSettings = new Settings.SyncSettings();
            this._selectOptionBasedOnValueNumber(syncSettings.homeArticleLimit, this._homeArticleLimit);
            this._selectOptionBasedOnValueNumber(syncSettings.likedArticleLimit, this._likedArticleLimit);
            this._selectOptionBasedOnValueNumber(syncSettings.archiveArticleLimit, this._archiveArticleLimit);
            this._selectOptionBasedOnValueNumber(syncSettings.otherFoldersLimit, this._otherFoldersArticleLimit);

            this._selectOptionBasedOnValueBoolean((new Settings.TelemetrySettings()).telemeteryCollectionEnabled, this._allowCollectingTelemetry);

            let viewerSettings = new Settings.ViewerSettings();
            this._selectOptionBasedOnValueNumber(viewerSettings.uiTheme, this._uiTheme);

            var version = Windows.ApplicationModel.Package.current.id.version;
            var versionLabel = " " + version.major + "." + version.minor + "." + version.build + "." + version.revision;
            this._versionElement.innerText += versionLabel;

            WinJS.Utilities.removeClass(this.element, "hide");
            await WinJS.UI.Animation.slideUp(this.element);

            // Capture previously focused element so we focus it when the
            // setting is dismissed.
            //
            // Note, this is a little bit of a cheat. The settings is normally
            // invoked from the flyout nav menu thing. If we captured focus immediately
            // when we were invoked, we'd capture the focus from inside the flyout. Bad.
            // If we wait till we're showing/focusing ourselves, it means that the flyout
            // itself will have restored focus to somewhere helpful. (E.g. back to
            // the content)
            this._previouslyFocusedElement = <HTMLElement>document.activeElement;
            this._homeArticleLimit.focus();
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

        public async close(args?: Windows.UI.Core.BackRequestedEventArgs): Promise<void> {
            if (args != null) {
                args.handled = true;
            }

            this.viewModel.dispose();
            this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.collapsed;

            await WinJS.UI.Animation.slideDown(this.element);
            Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
            this.viewModel = null;

            // Restore focus to whatever was previously focused.
            try {
                this._previouslyFocusedElement.focus();
            }
            catch (e) { }
            this._previouslyFocusedElement = null;
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
            var otherFoldersLimit = parseInt(this._otherFoldersArticleLimit.value);

            this.viewModel.updateArticleSyncLimits(homeLimit, likedLimit, archiveLimit, otherFoldersLimit);
        }

        public handleAllowTelemetryChange(): void {
            var isAllowed = ("true" == this._allowCollectingTelemetry.value);
            this.viewModel.updateAllowTelemetry(isAllowed);
        }

        public handleUIThemeChange(): void {
            let theme = parseInt(this._uiTheme.value);
            this.viewModel.updateUITheme(theme);
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

        public forgetMeAndSignout(): void {
            this.viewModel.forgetMeAndSignout();
            this.close();
        }

        public async dumpDb(): Promise<void> {
            try {
                const dumpData = await this.viewModel.articleListViewModel.dumpDb();
                Utilities.Logging.instance.log("Dumped");

                Utilities.Logging.instance.log(dumpData, true);
            } catch (e) { Utilities.Logging.instance.log("Not dumped"); }
        }

        public showDbFiddler(): void {
            this.viewModel.articleListViewModel.showDbFiddler();
            this.close();
        }

        private _selectOptionBasedOnValueNumber(value: number, element: HTMLSelectElement): void {
            for (var i = 0; i < element.options.length; i++) {
                var itemValue = parseInt((<HTMLOptionElement>element.options.item(i)).value); // Assume all items are valid integers
                if (itemValue === value) {
                    element.selectedIndex = i;
                    return;
                }
            }   
        }

        private _selectOptionBasedOnValueBoolean(value: boolean, element: HTMLSelectElement): void {
            for (var i = 0; i < element.options.length; i++) {
                var itemValue = "true" === (<HTMLOptionElement>element.options.item(i)).value; // Assume all items are valid integers
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
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.forgetMeAndSignout);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showLogViewer);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.dumpDb);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showLogViewer);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.showDbFiddler);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.handleArticleLimitChanged);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.handleAllowTelemetryChange);
    WinJS.Utilities.markSupportedForProcessing(SettingsPopupExperience.prototype.handleUIThemeChange);

    export class SettingsPopupViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.SettingsPopupExperience" };

        constructor(public articleListViewModel: SignedInViewModel)
        { }

        public dispose(): void {
        }

        public async redownload(): Promise<void> {
            var articleListViewModel = this.articleListViewModel;
            await articleListViewModel.signOut(false/*clearCredentials*/);
            articleListViewModel.signedIn(false);
        }

        public updateArticleSyncLimits(homeLimit: number, likedLimit: number, archiveLimit: number, otherFoldersLimit: number): void {
            var syncSettings = new Settings.SyncSettings();
            syncSettings.homeArticleLimit = homeLimit;
            syncSettings.likedArticleLimit = likedLimit;
            syncSettings.archiveArticleLimit = archiveLimit;
            syncSettings.otherFoldersLimit = otherFoldersLimit;
        }

        public async updateAllowTelemetry(allowTelemetry: boolean): Promise<void> {
            var telemetrySettings = new Settings.TelemetrySettings();
            telemetrySettings.telemeteryCollectionEnabled = allowTelemetry;
            Telemetry.instance.dropEventsForPrivacy = !allowTelemetry;

            if (Telemetry.instance.dropEventsForPrivacy) {
                // Since it's off, lets make sure we're not uploading _anything_
                // and handle any errors when it fails, since we don't care about
                // those.
                try {
                    await Telemetry.instance.clearStorageAsync();
                } catch (e) { }
            }
        }

        public updateUITheme(uiTheme: Settings.UITheme): void {
            const viewerSettings = new Settings.ViewerSettings();
            viewerSettings.uiTheme = uiTheme;
            viewerSettings.refreshThemeOnDOM();
        }

        public async forgetMeAndSignout(): Promise<void> {
            await this.articleListViewModel.signOut(true);
            await Telemetry.instance.deleteProfile();
        }
    }
}