module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    import Settings = Codevoid.Storyvoid.Settings;

    export class ArticleViewerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _content: MSHTMLWebViewElement;
        private _lastDiv: HTMLElement;
        private _firstDiv: HTMLElement;
        private _toolbarContainer: HTMLElement;
        private viewModel: ArticleViewerViewModel;
        private _previousPrimaryColour: Windows.UI.Color;
        private _previousTextColour: Windows.UI.Color;
        private _messenger: Codevoid.Utilities.WebViewMessenger;
        private _container: HTMLElement;
        private _title: HTMLElement;
        private _displaySettingsFlyout: WinJS.UI.Flyout;
        private _moveFlyout: WinJS.UI.Flyout;
        private toolbar: WinJS.UI.ToolBar;
        private _pageReady: boolean = false;
        private _toolbarVisible: boolean = true;
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _fontSelector: HTMLSelectElement;
        private _fonts: WinJS.UI.Repeater;
        private _flyoutInitialized: boolean = false;
        private _previouslyFocusedElement: HTMLElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();

            WinJS.Utilities.addClass(element, "articleViewer-dialog");
            WinJS.Utilities.addClass(element, "dialog");
            WinJS.Utilities.addClass(element, "win-disposable");
            WinJS.Utilities.addClass(element, "hide");

            // Update the titlebar style to match the document
            // NB: Must be done before setting theme;
            this._saveCurrentTitleBarColours();

            // Capture previously focused element so we focus it when the
            // viewer is dismissed.
            this._previouslyFocusedElement = <HTMLElement>document.activeElement;

            DOM.loadTemplate("/HtmlTemplates.html", "articleViewer").then((template) => {
                return template.render({}, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.ArticleViewerExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                // Create the webview programmatically, because when it was created in markup
                // via the template, there are some really f'up things going on with transitioning
                // in and out of tablet mode *WHEN REMOVING THE PHYSICAL KEYBOARD*. Not just
                // when you transition through sofware, but requiring a physical removal & re-attachcment
                //
                // E.g Remove keyboard,
                //     attach keyboard
                //     spin for ever and eat all the cpu.
                this._content = document.createElement("x-ms-webview");
                this._content.className = "articleViewer-content";
                this._container.insertBefore(this._content, this._lastDiv);

                // Attach a handler so we can prevent the default link handling behaviour.
                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._content, {
                    MSWebViewNavigationStarting: this._preventNavigations.bind(this)
                }));

                // Attach handlers for cross-page messaging
                this._messenger = new Codevoid.Utilities.WebViewMessenger(this._content);

                this._openPage();

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.viewModel.eventSource, {
                    removed: this.close.bind(this),
                }));

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.viewModel.displaySettings.eventSource, {
                    settheme: this._handleThemeChange.bind(this),
                }));

                document.body.appendChild(this._displaySettingsFlyout.element);
                this.viewModel.setDisplaySettingsFlyout(this._displaySettingsFlyout);

                document.body.appendChild(this._moveFlyout.element);
                this.viewModel.setMoveFlyout(this._moveFlyout);

                // Use internal class from WinJS to give me win-keyboard on the buttons in this tree
                // Doesn't really need to do anything, except be initialized
                var kbhelp = new (<any>WinJS.UI)._WinKeyboard(this._displaySettingsFlyout.element);
                kbhelp = new (<any>WinJS.UI)._WinKeyboard(this._moveFlyout.element);

                var viewerSettings = new Settings.ViewerSettings();
                this._setToolbar(viewerSettings.toolbarVisible);
            });
        }

        public _lastDivFocused(): void {
            if (this._toolbarVisible) {
                var firstButton = (<HTMLElement>this.toolbar.element.querySelector("button"));
                WinJS.Utilities.addClass(firstButton, "win-keyboard");
                firstButton.focus();
            } else {
                this._firstDivFocused();
            }
        }

        public _firstDivFocused(): void {
            this._content.focus();
        }

        private _preventNavigations(e: Event): void {
            if (!this._pageReady) {
                return;
            }

            e.preventDefault();
        }

        private _openPage(): void {
            this._title.textContent = this.viewModel.bookmark.title;

            // unhide it, and make it invisible
            // This is to allow the control to layout itself so that
            // when the actual webview is animated, it's rendered correctly
            // Without this, the web view is rendered "zoomed" during
            // the slide in animation.
            WinJS.Utilities.removeClass(this.element, "hide");
            this.element.style.opacity = "0.0";

            var readyHandler = Codevoid.Utilities.addEventListeners(this._messenger.events, {
                ready: () => {
                    readyHandler.cancel();
                    readyHandler = null;

                    this._handleReady();
                },
            });

            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._messenger.events, {
                dismiss: () => {
                    this.close(null);
                },
                toggletoolbar: this._toggleToolbar.bind(this),
                shortcutinvoked: (e: { detail: number }) => {
                    this._handleShortcuts(e.detail);
                }
            }));

            this.viewModel.setMessenger(this._messenger);
            this.viewModel.displaySettings.setMessenger(this._messenger);

            this._content.navigate("ms-appdata:///local" + this.viewModel.bookmark.localFolderRelativePath);
        }

        private _handleReady(): void {
            this._pageReady = true;

            WinJS.Promise.join([
                this._messenger.addStyleSheet("ms-appx-web:///css/viewer.css"),
                this._messenger.addAdditionalScriptInsideWebView("ms-appx-web:///js/ui/ArticleViewer_client.js"),
            ]).done(() => {
                this._messenger.invokeForResult("inserttitle", {
                    title: this.viewModel.bookmark.title,
                    domain: this._extractDomainFromUrl(this.viewModel.bookmark.url),
                    url: this.viewModel.bookmark.url,
                });

                // Set initial states
                this._messenger.invokeForResult("restorescroll", this.viewModel.bookmark.progress);
                this.viewModel.displaySettings.restoreSettings();

                Windows.UI.ViewManagement.ApplicationView.getForCurrentView().title = this.viewModel.bookmark.title;
                        
                // Set commands to the toolbar controls to handle primary/secondary scenarios
                this.toolbar.data = this.viewModel.getCommands();

                this.element.style.opacity = ""; // Allow default styles to sort themselves out
                this._content.focus();

                if (this.viewModel.isRestoring) {
                    this.viewModel.signalArticleDisplayed();
                } else {
                    WinJS.UI.Animation.slideUp(this.element).done(() => {
                        this.viewModel.signalArticleDisplayed();
                    });
                }

                // Setup OS back button support
                this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.visible;
                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                    backrequested: this.close.bind(this),
                }));

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(window, {
                    keydown: (e: KeyboardEvent) => {
                        var handled: boolean = false;

                        if (e.ctrlKey) {
                            this._handleShortcuts(e.keyCode);
                        }

                        switch (e.key.toLowerCase()) {
                            case "esc":
                                this.close(null);
                                handled = true;
                                break;

                            case "alt":
                                this._toggleToolbar();
                                handled = true;
                                break;
                        }

                        if (handled) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    },
                    pointerup: (e: PointerEvent) => {
                        if (e.button != 3) {
                            return;
                        }

                        this.close(null);
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }));
            });
        }

        private _showToolbarIfNotVisible(): WinJS.Promise<any> {
            if (this._toolbarVisible) {
                return WinJS.Promise.as();
            }

            return this._toggleToolbar();
        }

        private _handleShortcuts(keyCode: WinJS.Utilities.Key): void {
            switch (keyCode) {
                case WinJS.Utilities.Key.a:
                    this.viewModel.archiveCommand.onclick();
                    break;

                case WinJS.Utilities.Key.l:
                    this.viewModel.toggleLikeCommand.onclick();
                    break;

                case WinJS.Utilities.Key.f:
                    this.viewModel.fullScreenCommand.onclick();
                    break;

                case WinJS.Utilities.Key.s:
                    this._showToolbarIfNotVisible().done(() => {
                        this.viewModel.displaySettingsCommand.flyout.show(this.viewModel.displaySettingsCommand.element, "autovertical");
                    });
                    break;

                case WinJS.Utilities.Key.m:
                    this._showToolbarIfNotVisible().done(() => {
                        this.viewModel.moveCommand.flyout.show(this.viewModel.moveCommand.element, "autovertical");
                    });
                    break;

                case WinJS.Utilities.Key.d:
                    this.viewModel.deleteCommand.onclick();
                    break;

                case WinJS.Utilities.Key.t:
                    this._lastDivFocused();
                    break;
            }
        }

        private _saveCurrentTitleBarColours(): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            this._previousPrimaryColour = titleBar.backgroundColor;
            this._previousTextColour = titleBar.foregroundColor;
        }

        private _restoreTitlebar(): void {
            this._setTitleBar(this._previousPrimaryColour, this._previousTextColour);
        }

        private _handleThemeChange(e: { detail: IThemeDetails }): void {
            this._toolbarContainer.setAttribute("data-theme", e.detail.viewerCssClass);

            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;
            this._setTitleBar(e.detail.titlebarBackground, e.detail.titlebarForeground);
        }

        private _extractDomainFromUrl(url: string): string {
            // RegEx from:
            // https://regex101.com/r/wN6cZ7/63
            var regEx = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/igm
            var matches = regEx.exec(url);

            return matches[1];
        }

        private _setTitleBar(backgroundColour: Windows.UI.Color, textColour: Windows.UI.Color): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            titleBar.backgroundColor = backgroundColour;
            titleBar.buttonBackgroundColor = backgroundColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = backgroundColour;
            titleBar.buttonInactiveBackgroundColor = backgroundColour;
        }

        private _setToolbar(state: boolean): void {
            this._toolbarVisible = state;

            if (this._toolbarVisible) {
                WinJS.Utilities.removeClass(this._toolbarContainer, "hide");
            } else {
                WinJS.Utilities.addClass(this._toolbarContainer, "hide");
            }
        }

        private _toggleToolbar(): WinJS.Promise<any> {
            var offset = {
                top: null,
                left: "0px",
            };

            var signal = new Utilities.Signal();

            // Adjust the multiplier  for the offset depending on if we're at the bottom
            // or the top of the screen (as determined by window width
            var directionMultiplier = -1;
            if (window.innerWidth <= 640) {
                directionMultiplier = 1;
            }

            if (this._toolbarVisible) {
                offset.top = (directionMultiplier * this._toolbarContainer.clientHeight) + "px";

                WinJS.UI.Animation.hideEdgeUI(this._toolbarContainer, offset).done(() => {
                    WinJS.Utilities.addClass(this._toolbarContainer, "hide");
                    (new Settings.ViewerSettings()).toolbarVisible = this._toolbarVisible = false;
                    signal.complete();
                });
            } else {
                // Remove the class before getting the client width, otherwise it'll
                // be a big fat 0.
                WinJS.Utilities.removeClass(this._toolbarContainer, "hide");
                offset.top = (directionMultiplier * this._toolbarContainer.clientHeight) + "px";

                WinJS.UI.Animation.showEdgeUI(this._toolbarContainer, offset).done(() => {
                    (new Settings.ViewerSettings()).toolbarVisible = this._toolbarVisible = true;
                    signal.complete();
                });
            }

            return signal.promise;
        }

        public fontSelectionChanged(e: UIEvent): void {
            var font = <Settings.Font>parseInt(this._fontSelector.value);
            this.viewModel.displaySettings.updateTypeface(font);
        }

        public displaySettingsFlyoutOpening(e: Event) {
            if (this._flyoutInitialized) {
                return;
            }

            this._fonts.data = new WinJS.Binding.List<IFontChoice>(DisplaySettingsViewModel.fontChoices);
            this._fontSelector = <HTMLSelectElement>this._fonts.element;
            this._fontSelector.selectedIndex = (<number>this.viewModel.displaySettings.currentFont) -1;
            
            this._flyoutInitialized = true;
        }

        public close(args: Windows.UI.Core.BackRequestedEventArgs): void {
            if (args != null) {
                args.handled = true; // Make sure the OS doesn't handle it.
            }

            if (this._messenger) {
                this._messenger.dispose();
                this._messenger = null;
            }

            this.viewModel.dispose();

            this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.collapsed;
            this._restoreTitlebar();

            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            if (view.isFullScreenMode) {
                view.exitFullScreenMode();
            }

            // Reset the title to the default
            view.title = "";

            Codevoid.Utilities.DOM.removeChild(this._displaySettingsFlyout.element.parentElement,
                this._displaySettingsFlyout.element);

            WinJS.UI.Animation.slideDown(this.element).done(() => {
                // Restore focus to a previous element.
                // Note that if you do this in the dismiss handler from the WebView
                // before yielding to the browser, you'll get the escape key event
                // twice for no apparently good reason.
                try {
                    this._previouslyFocusedElement.setActive();
                } catch (e) { }
                this._previouslyFocusedElement = null;

                // Flip this flag to allow the next navigate to complete, because
                // we're normally supressing navigations after the first load.
                this._pageReady = false;

                // Navigate blank to immediately stop the audio from a video
                // that might be playing, otherwise it'll wait till it gets
                // GC'd. :(
                this._content.navigate("about:blank");

                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
                this.viewModel = null;
            });
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
            this._content = null;
        }

        public decreaseFontSize(): void {
            this.viewModel.displaySettings.decreaseFontSize();
        }

        public increaseFontSize(): void {
            this.viewModel.displaySettings.increaseFontSize();
        }

        public decreaseLineHeight(): void {
            this.viewModel.displaySettings.decreaseLineHeight();
        }

        public increaseLineHeight(): void {
            this.viewModel.displaySettings.increaseLineHeight();
        }

        public decreaseMargins(): void {
            this.viewModel.displaySettings.decreaseArticleWidth();
        }

        public increaseMargins(): void {
            this.viewModel.displaySettings.increaseArticleWidth();
        }

        public switchThemeToDay(): void {
            this.viewModel.displaySettings.setTheme(Settings.Theme.Day);
        }

        public switchThemeToPaper(): void {
            this.viewModel.displaySettings.setTheme(Settings.Theme.Paper);
        }

        public switchThemeToDusk(): void {
            this.viewModel.displaySettings.setTheme(Settings.Theme.Dusk);
        }

        public switchThemeToNight(): void {
            this.viewModel.displaySettings.setTheme(Settings.Theme.Night);
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype._firstDivFocused);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype._lastDivFocused);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.displaySettingsFlyoutOpening);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.fontSelectionChanged);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseFontSize);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseFontSize);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseLineHeight);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseLineHeight);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseMargins);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseMargins);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToDay);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToPaper);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToDusk);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToNight);

    export class ArticleViewerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.ArticleViewerExperience" };
        private _displaySettingsCommand: WinJS.UI.Command;
        private _toggleLikeCommand: WinJS.UI.Command;
        private _deleteCommand: WinJS.UI.Command;
        private _archiveCommand: WinJS.UI.Command;
        private _moveCommand: WinJS.UI.Command;
        private _fullScreenCommand: WinJS.UI.Command;
        private _eventSource: Utilities.EventSource;
        private _remoteEventHandlers: Utilities.ICancellable;
        private _messenger: Utilities.WebViewMessenger;
        private _displaySettings: DisplaySettingsViewModel = new DisplaySettingsViewModel();
        private _displayedSignal: Utilities.Signal = new Utilities.Signal();
        public isRestoring: boolean = true;

        constructor(public bookmark: IBookmark, private _instapaperDB: InstapaperDB) {
            this._eventSource = new Utilities.EventSource();

            this._initializeToggleCommand();
            this._initializeArchiveCommand();
            this._initializeFullScreenCommand();

            this._deleteCommand = new WinJS.UI.Command(null, {
                tooltip: "Delete",
                icon: "delete",
                onclick: this._delete.bind(this),
            });

            this._displaySettingsCommand = new WinJS.UI.Command(null, {
                tooltip: "Display Settings",
                icon: WinJS.UI.AppBarIcon.font,
                type: "flyout",
            });

            this._moveCommand = new WinJS.UI.Command(null, {
                tooltip: "Move",
                icon: WinJS.UI.AppBarIcon.movetofolder,
                type: "flyout",
            });

            // Save that we're looking at an article
            var transientSettings = new Settings.TransientSettings();
            transientSettings.lastViewedArticleId = bookmark.bookmark_id;
        }

        public dispose(): void {
            if (this._remoteEventHandlers) {
                this._remoteEventHandlers.cancel();
                this._remoteEventHandlers = null;
            }

            this._messenger = null;
            this._displaySettings.dispose();
            this._displaySettings = null;

            // Clear the article; we've stopped viewing, so no need to restore
            var transientSettings = new Settings.TransientSettings();
            transientSettings.clearLastViewedArticleId();
        }

        public get displaySettingsCommand(): WinJS.UI.Command {
            return this._displaySettingsCommand;
        }

        public get moveCommand(): WinJS.UI.Command {
            return this._moveCommand;
        }

        public get toggleLikeCommand(): WinJS.UI.Command {
            return this._toggleLikeCommand;
        }

        public get deleteCommand(): WinJS.UI.Command {
            return this._deleteCommand;
        }

        public get archiveCommand(): WinJS.UI.Command {
            return this._archiveCommand;
        }

        public get fullScreenCommand(): WinJS.UI.Command {
            return this._fullScreenCommand;
        }

        public signalArticleDisplayed(): void {
            this._displayedSignal.complete();
        }

        public get displayed(): WinJS.Promise<any> {
            return this._displayedSignal.promise;
        }

        public setMessenger(messenger: Utilities.WebViewMessenger) {
            this._messenger = messenger;

            this._remoteEventHandlers = Utilities.addEventListeners(messenger.events, {
                progresschanged: (e) => {
                    this.updateProgress(e.detail);
                },
                linkinvoked: (e) => {
                    this._handleLinkInvocation(e.detail);
                }
            });
        }

        public updateProgress(progress: number): void {
            this._instapaperDB.updateReadProgress(this.bookmark.bookmark_id, progress).done((bookmark) => {
                this.bookmark = bookmark;
            });
        }

        public getCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            commands.push(this._displaySettingsCommand);
            commands.push(this._toggleLikeCommand);
            commands.push(this._moveCommand);
            commands.push(this._archiveCommand);
            commands.push(this._fullScreenCommand);
            commands.push(this._deleteCommand);

            return new WinJS.Binding.List(commands);
        }

        public get eventSource(): Utilities.EventSource {
            return this._eventSource;
        }

        public setDisplaySettingsFlyout(flyout: WinJS.UI.Flyout) {
            this._displaySettingsCommand.flyout = flyout;
        }

        public get displaySettings(): DisplaySettingsViewModel {
            return this._displaySettings;
        }

        public setMoveFlyout(flyout: WinJS.UI.Flyout) {
            this._moveCommand.flyout = flyout;
        }

        private _initializeToggleCommand() {
            this._toggleLikeCommand = new WinJS.UI.Command(null, {
                onclick: this._toggleLike.bind(this),
            });

            if (this.bookmark.starred === 1) {
                this._setToggleLikeToUnlike();
            } else {
                this._setToggleLikeToLike();
            }
        }

        private _setToggleLikeToUnlike() {
            this._toggleLikeCommand.tooltip = "Unlike";
            this._toggleLikeCommand.icon = "\uE00B";
        }

        private _setToggleLikeToLike() {
            this._toggleLikeCommand.tooltip = "Like";
            this._toggleLikeCommand.icon = "\uE006";
        }

        private _toggleLike(): void {
            var updateBookmark;

            if (this.bookmark.starred === 1) {
                updateBookmark = this._instapaperDB.unlikeBookmark(this.bookmark.bookmark_id);
            } else {
                updateBookmark = this._instapaperDB.likeBookmark(this.bookmark.bookmark_id);
            }

            updateBookmark.done((bookmark) => {
                this.bookmark = bookmark;

                if (this.bookmark.starred === 1) {
                    this._setToggleLikeToUnlike();
                } else {
                    this._setToggleLikeToLike();
                }
            });
        }

        private _delete(): void {
            this._instapaperDB.removeBookmark(this.bookmark.bookmark_id).done(() => {
                this._eventSource.dispatchEvent("removed", null);
            });
        }

        private _initializeArchiveCommand(): void {
            this._archiveCommand = new WinJS.UI.Command(null, {
                onclick: this._archive.bind(this),
            });

            if (this.bookmark.folder_dbid === this._instapaperDB.commonFolderDbIds.archive) {
                this._archiveCommand.tooltip = "Move to unread";
                this._archiveCommand.icon = "\uEC51";
            } else {
                this._archiveCommand.tooltip = "Archive";
                this._archiveCommand.icon = "\uEC50";
            }
        }

        private _archive(): void {
            var destinationFolder: number;
            if (this.bookmark.folder_dbid === this._instapaperDB.commonFolderDbIds.archive) {
                destinationFolder = this._instapaperDB.commonFolderDbIds.unread;
            } else {
                destinationFolder = this._instapaperDB.commonFolderDbIds.archive;
            }

            this._instapaperDB.moveBookmark(this.bookmark.bookmark_id, destinationFolder).done(() => {
                this._eventSource.dispatchEvent("removed", null);
            });
        }

        private _initializeFullScreenCommand(): void {
            this._fullScreenCommand = new WinJS.UI.Command(null, {
                onclick: this._toggleFullScreen.bind(this),
            });

            this._updateFullScreenButtonState();
        }

        private _updateFullScreenButtonState(): void {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            if (view.isFullScreenMode) {
                this._setFullScreenCommandToExit();
            } else {
                this._setFullScreenCommandToEnter();
            }
        }

        private _toggleFullScreen() {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();

            if (!view.isFullScreenMode) {
                var transitionedToFullScreen = view.tryEnterFullScreenMode();
                if (transitionedToFullScreen) {
                    this._handleTransitionToFullScreen();
                }
            } else {
                view.exitFullScreenMode();
            }
        }

        private _handleTransitionToFullScreen() {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();

            // Full screen isn't correct for a short while after we have actually transitioned.
            // So, we need to wait for the resize to get to full screen, and *then* we need to
            // listen for another resize event to see if we exited the fullscreen mode.
            var initialResizeHandler = Codevoid.Utilities.addEventListeners(window, {
                resize: () => {
                    if (!view.isFullScreenMode) {
                        return;
                    }

                    initialResizeHandler.cancel();
                    this._updateFullScreenButtonState();

                    var windowResizeHandler = Codevoid.Utilities.addEventListeners(window, {
                        resize: () => {
                            if (view.isFullScreenMode) {
                                return;
                            }

                            windowResizeHandler.cancel();
                            this._setFullScreenCommandToEnter();
                        }
                    });
                }
            });
        }

        private _setFullScreenCommandToExit(): void {
            this._fullScreenCommand.tooltip = "Exit Full Screen";
            this._fullScreenCommand.icon = "\uE1D8";
        }

        private _setFullScreenCommandToEnter(): void {
            this._fullScreenCommand.tooltip = "Exit Full Screen";
            this._fullScreenCommand.icon = "\uE1D9";
        }

        private _handleLinkInvocation(url: string): void {
            var uri;
            try {
                // URL might be badly formed, so we're going to try and parse it. If it fails,
                // Well, screw it.
                uri = new Windows.Foundation.Uri(url);
            }
            catch (e) {
                Utilities.Logging.instance.log("Tried to navigate to bad URL: " + url);
                return;
            }

            Windows.System.Launcher.launchUriAsync(uri);
        }
    }

    const MAX_FONT_SIZE = 36;
    const MIN_FONT_SIZE = 12;
    const MIN_LINE_HEIGHT = 1.0;
    const MAX_LINE_HEIGHT = 3.0;
    const LINE_HEIGHT_INCREMENT = 0.1;
    const ARTICLE_WIDTH_INCREMENT = 2;
    const MAX_ARTICLE_WIDTH = 95;
    const MIN_ARTICLE_WIDTH = 70;
    const MAX_ARTICLE_PX_WIDTH = 1400;

    interface IFontChoice {
        font: Settings.Font;
        label: string;
        fontFamily: string;
    }

    interface IThemeDetails {
        theme: Settings.Theme;
        viewerCssClass: string;
        titlebarForeground: Windows.UI.Color;
        titlebarBackground: Windows.UI.Color;
    }

    export class DisplaySettingsViewModel {
        private _messenger: Utilities.WebViewMessenger;
        private _fontSize: number = 20;
        private _lineHeight: number = 1.6;
        private _articleWidth: number = 80;
        private _eventSource: Utilities.EventSource = new Utilities.EventSource();
        private _settings: Settings.ViewerSettings = new Settings.ViewerSettings();

        public setMessenger(messenger: Utilities.WebViewMessenger): void {
            this._messenger = messenger;
        }

        public get eventSource(): Utilities.EventSource {
            return this._eventSource;
        }

        public dispose(): void {
            this._messenger = null;
        }

        public updateTypeface(newFont: Settings.Font): void {
            var fontChoice: IFontChoice;
            DisplaySettingsViewModel.fontChoices.forEach((details) => {
                if (details.font != newFont) {
                    return;
                }

                fontChoice = details;
            });

            this._messenger.invokeForResult("setbodycssproperty", { property: "fontFamily", value: fontChoice.fontFamily });

            this._settings.currentTypeface = newFont;
        }

        public get currentFont(): Settings.Font {
            return this._settings.currentTypeface;
        }

        public decreaseFontSize(): void {
            if (this._fontSize <= MIN_FONT_SIZE) {
                return;
            }
            
            this._setFontSize(this._fontSize - 1);
        }

        public increaseFontSize(): void {
            if (this._fontSize >= MAX_FONT_SIZE) {
                return;
            }

            this._setFontSize(this._fontSize + 1);
        }

        private _setFontSize(fontSize: number) {
            this._fontSize = fontSize;
            this._settings.currentFontSize = fontSize;
            this._messenger.invokeForResult("setbodycssproperty", { property: "fontSize", value: this._fontSize + "px" });
        }

        public decreaseLineHeight(): void {
            if (this._lineHeight <= MIN_LINE_HEIGHT) {
                return;
            }

            this._setLineHeight(this._lineHeight - LINE_HEIGHT_INCREMENT);
        }

        public increaseLineHeight(): void {
            if (this._lineHeight >= MAX_LINE_HEIGHT) {
                return;
            }
            
            this._setLineHeight(this._lineHeight + LINE_HEIGHT_INCREMENT);
        }

        private _setLineHeight(lineHeight: number) {
            this._lineHeight = lineHeight;
            this._settings.currentLineHeight = lineHeight;
            this._messenger.invokeForResult("setbodycssproperty", { property: "lineHeight", value: this._lineHeight + "em" });
        }

        public decreaseArticleWidth(): void {
            if (this._articleWidth <= MIN_ARTICLE_WIDTH) {
                return;
            }

            this._setArticleWidth(this._articleWidth - ARTICLE_WIDTH_INCREMENT);
        }

        public increaseArticleWidth(): void {
            if ((this._articleWidth >= MAX_ARTICLE_WIDTH) || (window.outerWidth * (this._articleWidth / 100)) >= MAX_ARTICLE_PX_WIDTH) {
                return;
            }

            this._setArticleWidth(this._articleWidth + ARTICLE_WIDTH_INCREMENT);
        }

        private _setArticleWidth(articleWidth: number) {
            this._articleWidth = articleWidth;
            this._settings.currentArticleWidth = articleWidth;
            this._messenger.invokeForResult("setbodycssproperty", { property: "width", value: this._articleWidth + "vw" });
        }

        public setTheme(theme: Settings.Theme): void {
            var themeDetails: IThemeDetails;
            // Find the theme details we want
            DisplaySettingsViewModel.themeDetails.forEach((details) => {
                if (details.theme != theme) {
                    return;
                }

                themeDetails = details;
            });

            // tell everyone
            this._messenger.invokeForResult("settheme", themeDetails.viewerCssClass);
            this._settings.currentTheme = theme;
            this._eventSource.dispatchEvent("settheme", themeDetails);
        }

        public restoreSettings(): void {
            this.setTheme(this._settings.currentTheme);
            this.updateTypeface(this._settings.currentTypeface);
            this._setFontSize(this._settings.currentFontSize);
            this._setLineHeight(this._settings.currentLineHeight);
            this._setArticleWidth(this._settings.currentArticleWidth);
        }

        private static _fontChoices: IFontChoice[];
        public static get fontChoices(): IFontChoice[] {
            if (!DisplaySettingsViewModel._fontChoices) {
                DisplaySettingsViewModel._fontChoices = [
                    { font: Settings.Font.Arial, label: "Arial", fontFamily: "Arial" },
                    { font: Settings.Font.Calibri, label: "Calibri", fontFamily: "Calibri" },
                    { font: Settings.Font.Cambria, label: "Cambria", fontFamily: "Cambria" },
                    { font: Settings.Font.Constantia, label: "Constantia", fontFamily: "Constantia" },
                    { font: Settings.Font.Georgia, label: "Georgia", fontFamily: "Georgia" },
                ];
            }

            return DisplaySettingsViewModel._fontChoices;
        }

        private static _themeDetails: IThemeDetails[];
        private static get themeDetails(): IThemeDetails[] {
            if (!DisplaySettingsViewModel._themeDetails) {
                DisplaySettingsViewModel._themeDetails = [
                    { theme: Settings.Theme.Day, viewerCssClass: "day", titlebarForeground: Windows.UI.Colors.black, titlebarBackground: Windows.UI.Colors.white },
                    { theme: Settings.Theme.Paper, viewerCssClass: "paper", titlebarForeground: Windows.UI.Colors.black, titlebarBackground: Windows.UI.Colors.wheat },
                    { theme: Settings.Theme.Dusk, viewerCssClass: "dusk", titlebarForeground: Windows.UI.Colors.lightGray, titlebarBackground: Windows.UI.Colors.darkSlateGray },
                    { theme: Settings.Theme.Night, viewerCssClass: "night", titlebarForeground: Windows.UI.Colors.white, titlebarBackground: Windows.UI.Colors.black },
                ];
            }

            return DisplaySettingsViewModel._themeDetails;
        }
    }
}