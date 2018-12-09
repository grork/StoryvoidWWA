module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    import Settings = Codevoid.Storyvoid.Settings;

    enum ScreenMode {
        Unset,
        Normal,
        ToggleFullScreen,
        FullScreen,
        PictureInPicture,
        TogglePictureInPicture,
    }

    function isFunctionKey(e: KeyboardEvent): boolean {
        return (e.keyCode >= WinJS.Utilities.Key.F1) && (e.keyCode <= WinJS.Utilities.Key.F12);
    }

    function getLikeAndArchiveForBookmark(bookmark: IBookmark): { liked: boolean; archive: boolean } {
        return {
            liked: (bookmark.starred === 1),
            archive: bookmark.folder_id === Codevoid.Storyvoid.InstapaperDB.CommonFolderIds.Archive
        };
    }

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
        private _displaySettingsFlyout: WinJS.UI.Flyout;
        private toolbar: WinJS.UI.ToolBar;
        private _pageReady: boolean = false;
        private _toolbarVisible: boolean = true;
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _fontSelector: HTMLSelectElement;
        private _fonts: WinJS.UI.Repeater;
        private _flyoutInitialized: boolean = false;
        private _currentHeaderHeight: number = 0;
        private _closed: boolean = false;
        private _keyDownMap: { [key: number]: boolean } = {};

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
                this._content = <MSHTMLWebViewElement>document.createElement("x-ms-webview");
                this._content.className = "articleViewer-content";
                this._container.insertBefore(this._content, this._lastDiv);

                // Attach a handler so we can prevent the default link handling behaviour.
                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._content, {
                    MSWebViewNavigationStarting: this._preventNavigations.bind(this),
                    MSWebViewContainsFullScreenElementChanged: () => {
                        // When the hosted content switches full screen state (E.g. YouTube video), then
                        // we need to also transition our fullscreen state
                        if (this._content.containsFullScreenElement) {
                            this.viewModel.videoContentFillsWindow();
                        } else {
                            this.viewModel.videoContentInline();
                        }
                    }
                }));

                // Attach handlers for cross-page messaging
                this._messenger = new Codevoid.Utilities.WebViewMessenger(this._content);

                this._openPage();

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.viewModel.eventSource, {
                    removed: () => this.closeArticle(),
                    dismiss: () => this.closeArticle(),
                    showMove: () => this.toolbar.close(),
                }));

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this.viewModel.displaySettings.eventSource, {
                    settheme: this._handleThemeChange.bind(this),
                    articlewidthchanged: this._handleArticleWidthChanged.bind(this),
                }));

                document.body.appendChild(this._displaySettingsFlyout.element);
                this.viewModel.setDisplaySettingsFlyout(this._displaySettingsFlyout);

                // Use internal class from WinJS to give me win-keyboard on the buttons in this tree
                // Doesn't really need to do anything, except be initialized
                var kbhelper = new (<any>WinJS.UI)._WinKeyboard(this._displaySettingsFlyout.element);

                var viewerSettings = new Settings.ViewerSettings();
                this._setToolbar(viewerSettings.toolbarVisible);
            });

            this._handlersToCleanup.push(Utilities.addEventListeners(window, {
                resize: this._handleResize.bind(this)
            }));

            this._handleResize();
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

        private _handleResize(): void {
            const viewSettings = Windows.UI.ViewManagement.UIViewSettings.getForCurrentView();
            if (viewSettings.userInteractionMode === Windows.UI.ViewManagement.UserInteractionMode.touch) {
                this.viewModel.enteredTabletMode();
            }

            this.viewModel.refreshStateDueToSizeChange();
        }

        private _openPage(): void {
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
                    this.handleDismiss();
                },
                toggletoolbar: this._toggleToolbar.bind(this),
                shortcutinvoked: (e: Utilities.EventObject<number>) => {
                    this._handleShortcuts(e.detail);
                },
                headerheightchanged: this._handleHeaderHeightChanged.bind(this),
            }));

            this.viewModel.setMessenger(this._messenger);
            this.viewModel.displaySettings.setMessenger(this._messenger);

            this._content.navigate("ms-appdata:///local" + this.viewModel.bookmark.localFolderRelativePath);
        }

        private _handleReady(): void {
            this._pageReady = true;

            WinJS.Promise.join([
                this._messenger.addStyleSheet("ms-appx-web:///css/viewer.css"),
                this._messenger.addStyleSheet("ms-appx-web:///OverlayScrollbars/OverlayScrollbars.css"),
                this._messenger.addAdditionalScriptInsideWebView("ms-appx-web:///OverlayScrollbars/OverlayScrollbars.js")
            ]).then(() => {
                return this._messenger.addAdditionalScriptInsideWebView("ms-appx-web:///js/ui/ArticleViewer_client.js");
            }).done(() => {
                this._afterReady();
            });
        }

        private _afterReady(): void {
            this._messenger.invokeForResult("preparefordisplay", {
                title: this.viewModel.bookmark.title,
                domain: this._extractDomainFromUrl(this.viewModel.bookmark.url),
                url: this.viewModel.bookmark.url,
                state: getLikeAndArchiveForBookmark(this.viewModel.bookmark)
            });

            // Set initial states
            this.viewModel.displaySettings.restoreSettings();

            // Restore scroll after we've set the display settings
            // so that all the sizes are correct, rather than having them
            // change immediately after scrolling (or during the scroll)
            this._messenger.invokeForResult("restorescroll", this.viewModel.bookmark.progress);

            Windows.UI.ViewManagement.ApplicationView.getForCurrentView().title = this.viewModel.bookmark.title;

            // Set commands to the toolbar controls to handle primary/secondary scenarios
            this.toolbar.data = this.viewModel.getCommands();

            this.element.style.opacity = ""; // Allow default styles to sort themselves out

            if (this.viewModel.isRestoring) {
                this.viewModel.signalArticleDisplayed();
                setTimeout(() => {
                    this._firstDivFocused();
                }, 20);
            } else {
                WinJS.UI.Animation.slideUp(this.element).done(() => {
                    this._firstDivFocused();
                    this.viewModel.signalArticleDisplayed();
                });
            }

            // Set the toolbar state in the viewer. This is to ensure
            // that the underlay state is correct.
            this._messenger.invokeForResult("settoolbarstate", this._toolbarVisible);

            // Setup OS back button support
            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                backrequested: this.goBack.bind(this),
            }));

            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(window, {
                keydown: this._handleKeyDown.bind(this),
                keyup: (e: KeyboardEvent) => {
                    // Clear this key from the list of keys
                    // we think are currently pressed.
                    this._keyDownMap[e.keyCode] = false;
                },
                pointerup: this._handlePointerUp.bind(this)
            }));
        }

        private _handlePointerUp(e: PointerEvent): void {
            if (e.button != 3) {
                return;
            }

            this.goBack(null);
            e.stopPropagation();
            e.preventDefault();
        }

        private _handleKeyDown(e: KeyboardEvent): void {
            var handled: boolean = false;

            // If we think this key is already down,
            // then assume the key is being held down
            // and thus ignore this keydown event
            if (this._keyDownMap[e.keyCode]) {
                return;
            }

            if (e.ctrlKey || isFunctionKey(e)) {
                this._handleShortcuts(e.keyCode);
            }

            switch (e.keyCode) {
                case WinJS.Utilities.Key.escape:
                case WinJS.Utilities.Key.backspace:
                    this.handleDismiss();
                    handled = true;
                    break;

                case WinJS.Utilities.Key.alt:
                    this._toggleToolbar();
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }

            this._keyDownMap[e.keyCode] = true;
        }

        private _showToolbarIfNotVisible(): WinJS.Promise<any> {
            if (this._toolbarVisible) {
                return WinJS.Promise.as();
            }

            return this._toggleToolbar();
        }

        private _handleShortcuts(keyCode: WinJS.Utilities.Key): void {
            let shortcutInvoked: string;
            switch (keyCode) {
                case WinJS.Utilities.Key.a:
                    shortcutInvoked = "Archive";
                    this.viewModel.archiveCommand.onclick();
                    break;

                case WinJS.Utilities.Key.l:
                    shortcutInvoked = "ToggleLike";
                    this.viewModel.toggleLikeCommand.onclick();
                    break;

                case WinJS.Utilities.Key.F11:
                    shortcutInvoked = "ToggleFullscreen";
                    this.viewModel.fullScreenCommand.onclick();
                    break;

                case WinJS.Utilities.Key.d:
                    shortcutInvoked = "ShowDisplaySettings";
                    this._showToolbarIfNotVisible().done(() => {
                        this.viewModel.displaySettingsCommand.flyout.show(this.viewModel.displaySettingsCommand.element, "autovertical");
                    });
                    break;

                case WinJS.Utilities.Key.m:
                    shortcutInvoked = "Move";
                    this.viewModel.moveCommand.onclick({ currentTarget: this.element });
                    break;

                case WinJS.Utilities.Key.deleteKey:
                    shortcutInvoked = "Delete";
                    this.viewModel.deleteCommand.onclick();
                    break;

                case WinJS.Utilities.Key.t:
                    shortcutInvoked = "FocusToolbar";
                    this._showToolbarIfNotVisible().done(() => {
                        this._lastDivFocused();
                    });
                    break;

                case WinJS.Utilities.Key.w:
                    shortcutInvoked = "Close";
                    this.closeArticle();
                    break;

                case WinJS.Utilities.Key.s:
                    shortcutInvoked = "Share";
                    Sharing.instance.getShareCommand().onclick();
                    break;

                case WinJS.Utilities.Key.p:
                    shortcutInvoked = "TogglePictureInPicture";
                    this.viewModel.pictureInPictureCommand.onclick();
                    break;
            }

            if (!shortcutInvoked) {
                Telemetry.instance.track("ArticleViewerKeyboardCommand" + shortcutInvoked, null);
            }
        }

        private _handleHeaderHeightChanged(e: Utilities.EventObject<number>): void {
            this._currentHeaderHeight = e.detail;

            if (!this.toolbar.element.clientHeight) {
                // If the toolbar doesn't have a height yet, nothing to do.
                return;
            }

            this._updateToolbarPaddingToKeepToolbarBelowTitle();
        }

        private _updateToolbarPaddingToKeepToolbarBelowTitle() {
            this._toolbarContainer.style.top = (this._currentHeaderHeight) - (40) + "px";
        }

        private _saveCurrentTitleBarColours(): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            this._previousPrimaryColour = titleBar.backgroundColor;
            this._previousTextColour = titleBar.foregroundColor;
        }

        private _restoreTitlebar(): void {
            this._setTitleBar(this._previousPrimaryColour, this._previousTextColour);
        }

        private _handleThemeChange(e: Utilities.EventObject<IThemeDetails>): void {
            this._container.setAttribute("data-theme", e.detail.viewerCssClass);
            this.toolbar.element.setAttribute("data-theme", e.detail.viewerCssClass);

            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;
            this._setTitleBar(e.detail.titlebarBackground, e.detail.titlebarForeground);
        }

        private _handleArticleWidthChanged(e: Utilities.EventObject<number>): void {
            this._toolbarContainer.style.width = e.detail + "vw";
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

            if (Windows.UI.ViewManagement.StatusBar) {
                var statusBar = Windows.UI.ViewManagement.StatusBar.getForCurrentView();
                statusBar.backgroundColor = backgroundColour;
                statusBar.foregroundColor = textColour;
            }
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

            // Adjust the multiplier for the offset depending on if we're at the bottom
            // or the top of the screen (as determined by window width
            var directionMultiplier = -1;
            var topOffset = this._toolbarContainer.offsetTop;
            if (window.innerWidth <= 640) {
                directionMultiplier = 1;
                topOffset = 0;
            }

            if (this._toolbarVisible) {
                var hidden = WinJS.Promise.as<void>();
                if (Windows.UI.ViewManagement.StatusBar) {
                    hidden = <WinJS.Promise<void>>Windows.UI.ViewManagement.StatusBar.getForCurrentView().hideAsync();
                }

                hidden.done(() => {
                    offset.top = (directionMultiplier * (this._toolbarContainer.clientHeight + topOffset)) + "px";

                    WinJS.UI.Animation.hideEdgeUI(this._toolbarContainer, offset).done(() => {
                        WinJS.Utilities.addClass(this._toolbarContainer, "hide");
                        (new Settings.ViewerSettings()).toolbarVisible = this._toolbarVisible = false;
                        signal.complete();
                    });

                    // Toggle the state to play our own animation. Needs to happen
                    // after we start the other one for them to run concurrently
                    this._messenger.invokeForResult("settoolbarstate", false);
                });
            } else {
                // Remove the class before getting the client width, otherwise it'll
                // be a big fat 0.
                WinJS.Utilities.removeClass(this._toolbarContainer, "hide");
                this._updateToolbarPaddingToKeepToolbarBelowTitle();
                offset.top = (directionMultiplier * this._toolbarContainer.clientHeight + topOffset) + "px";

                var shown = WinJS.Promise.as<void>();
                if (Windows.UI.ViewManagement.StatusBar) {
                    shown = Windows.UI.ViewManagement.StatusBar.getForCurrentView().showAsync();
                }

                shown.done(() => {
                    WinJS.UI.Animation.showEdgeUI(this._toolbarContainer, offset).done(() => {
                        (new Settings.ViewerSettings()).toolbarVisible = this._toolbarVisible = true;
                        
                        signal.complete();
                    });

                    // Toggle the state to play our own animation. Needs to happen
                    // after we start the other one for them to run concurrently
                    this._messenger.invokeForResult("settoolbarstate", true);
                });
            }

            return signal.promise;
        }

        public fontSelectionChanged(e: UIEvent): void {
            var font = <Settings.Font>parseInt(this._fontSelector.value);
            this.viewModel.displaySettings.updateTypeface(font, true);
        }

        public displaySettingsFlyoutOpening(e: Event) {
            Telemetry.instance.track("DisplaySettingsOpened", null);
            if (this._flyoutInitialized) {
                return;
            }

            this._fonts.data = new WinJS.Binding.List<IFontChoice>(DisplaySettingsViewModel.fontChoices);
            this._fontSelector = <HTMLSelectElement>this._fonts.element;
            this._fontSelector.selectedIndex = (<number>this.viewModel.displaySettings.currentFont) -1;
            
            this._flyoutInitialized = true;
        }

        private goBack(args: Windows.UI.Core.BackRequestedEventArgs): void {
            if (args != null) {
                args.handled = true; // Make sure the OS doesn't handle it.
            }

            this.closeArticle();
        }

        private handleDismiss(): void {
            if (this.viewModel.switchToNormalWindowMode()) {
                return;
            }

            this.closeArticle();
        }

        private closeArticle(): void {
            if (this._closed) {
                return;
            }

            this._closed = true;

            // Make sure when we're closing we actually exit full screen
            this.viewModel.switchToNormalWindowMode();

            if (this._messenger) {
                this._messenger.dispose();
                this._messenger = null;
            }

            this.viewModel.articleClosed();
            this.viewModel.dispose();
            this._restoreTitlebar();

            // Reset the title to the default
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            view.title = "";

            Codevoid.Utilities.DOM.removeChild(this._displaySettingsFlyout.element.parentElement,
                this._displaySettingsFlyout.element);

            WinJS.UI.Animation.slideDown(this.element).done(() => {
                // Flip this flag to allow the next navigate to complete, because
                // we're normally supressing navigations after the first load.
                this._pageReady = false;

                // Navigate blank to immediately stop the audio from a video
                // that might be playing, otherwise it'll wait till it gets
                // GC'd. :(
                this._content.navigate("about:blank");

                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
                this.viewModel.eventSource.dispatchEvent("closed", null);
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
            Telemetry.instance.track("ThemeChanged", toPropertySet({ theme: "day" }));
            this.viewModel.displaySettings.setTheme(Settings.Theme.Day);
        }

        public switchThemeToPaper(): void {
            Telemetry.instance.track("ThemeChanged", toPropertySet({ theme: "paper" }));
            this.viewModel.displaySettings.setTheme(Settings.Theme.Paper);
        }

        public switchThemeToDusk(): void {
            Telemetry.instance.track("ThemeChanged", toPropertySet({ theme: "dusk" }));
            this.viewModel.displaySettings.setTheme(Settings.Theme.Dusk);
        }

        public switchThemeToNight(): void {
            Telemetry.instance.track("ThemeChanged", toPropertySet({ theme: "night" }));
            this.viewModel.displaySettings.setTheme(Settings.Theme.Night);
        }

        public switchThemeToMatchSystem(): void {
            Telemetry.instance.track("ThemeChanged", toPropertySet({ theme: "matchsystem" }));
            this.viewModel.displaySettings.setTheme(Settings.Theme.MatchSystem);
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
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
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToMatchSystem);

    export class ArticleViewerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.ArticleViewerExperience" };
        private _displaySettingsCommand: WinJS.UI.Command;
        private _toggleLikeCommand: WinJS.UI.Command;
        private _closeArticleCommand: WinJS.UI.Command;
        private _deleteCommand: WinJS.UI.Command;
        private _archiveCommand: WinJS.UI.Command;
        private _moveCommand: WinJS.UI.Command;
        private _fullScreenCommand: WinJS.UI.Command;
        private _pictureInPictureCommand: WinJS.UI.Command;
        private _shareCommand: WinJS.UI.Command;
        private _eventSource: Utilities.EventSource;
        private _remoteEventHandlers: Utilities.ICancellable;
        private _messenger: Utilities.WebViewMessenger;
        private _displaySettings: DisplaySettingsViewModel = new DisplaySettingsViewModel();
        private _displayedSignal: Utilities.Signal = new Utilities.Signal();
        private _initialProgress: number;
        private _wasEverInTabletMode: boolean = false;
        private _screenMode: ScreenMode = ScreenMode.Unset;
        private _activity: Activity;
        public isRestoring: boolean = true;

        constructor(public bookmark: IBookmark, private _instapaperDB: InstapaperDB) {
            this.updateCurrentArticle(this);
            this._activity = new Activity(bookmark);
            this._eventSource = new Utilities.EventSource();

            this._initializeToggleCommand();
            this._initializeArchiveCommand();
            this._initializeViewModeCommands();

            this._deleteCommand = new WinJS.UI.Command(null, {
                tooltip: "Delete (Ctrl + Del)",
                label: "Delete",
                icon: "delete",
                onclick: this._delete.bind(this),
                section: "secondary",
            });

            this._displaySettingsCommand = new WinJS.UI.Command(null, {
                tooltip: "Display Settings (Ctrl + D)",
                icon: WinJS.UI.AppBarIcon.font,
                type: "flyout",
            });
            this._displaySettingsCommand.extraClass = "article-viewer-toolbar-button-spacer";

            this._moveCommand = new WinJS.UI.Command(null, {
                tooltip: "Move (Ctrl + M)",
                label: "Move",
                icon: WinJS.UI.AppBarIcon.movetofolder,
                type: "flyout",
                onclick: () => {
                    this._move(<any>{ currentTarget: this._pictureInPictureCommand.element });
                },
                section: "secondary",
            });

            this._closeArticleCommand = new WinJS.UI.Command(null, {
                tooltip: "Close (Esc)",
                icon: WinJS.UI.AppBarIcon.back,
                onclick: this.closeArticle.bind(this),
            });

            const shareCommandOptions = Codevoid.Storyvoid.UI.Sharing.instance.getShareCommand();
            shareCommandOptions.section = "secondary";
            this._shareCommand = new WinJS.UI.Command(null, shareCommandOptions);

            // Save that we're looking at an article
            var transientSettings = new Settings.TransientSettings();
            transientSettings.lastViewedArticleId = bookmark.bookmark_id;

            // Save the progress of the article as we load it, so
            // we can detect if it changes on exit to opportunistically
            // push a progress update to the service when the viewer is
            // is closed.
            this._initialProgress = bookmark.progress;

            // Update current bookmark being shared with the article we've opened
            Sharing.instance.bookmarkToShare = bookmark;
        }

        public dispose(): void {
            if (this._remoteEventHandlers) {
                this._remoteEventHandlers.cancel();
                this._remoteEventHandlers = null;
            }

            if (this._activity) {
                this._activity.end();
                this._activity = null;
            }

            this._messenger = null;
            this._displaySettings.dispose();
            this._displaySettings = null;

            // Clear the article; we've stopped viewing, so no need to restore
            var transientSettings = new Settings.TransientSettings();
            transientSettings.clearLastViewedArticleId();

            // If the progress changed, we're going to cheat and push
            // a progress update directly to the service
            if (this.bookmark.progress != this._initialProgress) {
                var bookmarkApi = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(Codevoid.Storyvoid.Authenticator.getStoredCredentials());

                // Push the update, but who cares if it shits the bed?
                // We already have the data locally in the DB
                bookmarkApi.updateReadProgress({
                    bookmark_id: this.bookmark.bookmark_id,
                    progress: this.bookmark.progress,
                    progress_timestamp: this.bookmark.progress_timestamp
                }).done(() => { }, () => { });
            }

            // When cleaning up, make sure we remove the reference to ourselves
            // as the current article ('cause, you know, we're no longer current)
            if (ArticleViewerViewModel._currentArticle === this) {
                ArticleViewerViewModel._currentArticle = null;
            }
        }

        public enteredTabletMode(): void {
            this._wasEverInTabletMode = true;
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

        public get pictureInPictureCommand(): WinJS.UI.Command {
            return this._pictureInPictureCommand;
        }

        public signalArticleDisplayed(): void {
            let activityStart = this._activity.start();
            Telemetry.instance.updateProfile(Utilities.Mixpanel.UserProfileOperation.add, toPropertySet({
                viewedArticleCount: 1,
            }));

            Telemetry.instance.startTimedEvent("ArticleViewed");

            var articlesViewedThisSession: number = 0;
            if (Telemetry.instance.hasSessionProperty("ArticlesViewed")) {
                articlesViewedThisSession = Telemetry.instance.getSessionPropertyAsInteger("ArticlesViewed");
            }

            articlesViewedThisSession += 1;
            Telemetry.instance.setSessionPropertyAsInteger("ArticlesViewed", articlesViewedThisSession);

            // This is dependent on an OS API that is not widely used, so lets be safe, and eat
            // all errors from it, so we can still show the article
            activityStart.then(null, () => { }).done(() => {
                this._displayedSignal.complete();
            });
        }

        public articleClosed(): void {
            Telemetry.instance.track("ArticleViewed", toPropertySet({
                wasAutomaticallyRestored: this.isRestoring,
                wasScrolled: (this._initialProgress != this.bookmark.progress),
                progressChange: this.bookmark.progress - this._initialProgress,
                wasInTabletMode: this._wasEverInTabletMode
            }));
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

        private closeArticle(): void {
            this.eventSource.dispatchEvent("dismiss", null)
        }

        private static _currentArticle: ArticleViewerViewModel;
        private updateCurrentArticle(article: ArticleViewerViewModel): void {
            if (ArticleViewerViewModel._currentArticle) {
                // Hide it quickly so that keyboard focus does
                // the right thing, rather than showing, and then hiding
                // which will cause the keyboard focus will be in the
                // wrong place (Not in the article)
                ArticleViewerViewModel._currentArticle.closeArticle();
                ArticleViewerViewModel._currentArticle = null;
            }

            ArticleViewerViewModel._currentArticle = article;
        }

        public updateProgress(progress: number): void {
            // When viewing an article that is now orphaned, don't
            // try to update the progress for it.
            if (this.bookmark.folder_dbid === this._instapaperDB.commonFolderDbIds.orphaned) {
                return;
            }

            this._instapaperDB.updateReadProgress(this.bookmark.bookmark_id, progress).done((bookmark) => {
                this.bookmark = bookmark;
            });
        }

        public getCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            commands.push(this._closeArticleCommand);
            commands.push(this._displaySettingsCommand);
            commands.push(this._toggleLikeCommand);
            commands.push(this._moveCommand);
            commands.push(this._archiveCommand);
            commands.push(this._shareCommand);
            commands.push(this._fullScreenCommand);

            if (Windows.UI.ViewManagement.ApplicationView.getForCurrentView().isViewModeSupported(Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay)) {
                commands.push(this._pictureInPictureCommand);
            }

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
            this._toggleLikeCommand.tooltip = "Unlike (Ctrl + L)";
            this._toggleLikeCommand.icon = "\uE00B";
        }

        private _setToggleLikeToLike() {
            this._toggleLikeCommand.tooltip = "Like (Ctrl + L)";
            this._toggleLikeCommand.icon = "\uE006";
        }

        private _toggleLike(): void {
            var updateBookmark;

            if (this.bookmark.starred === 1) {
                updateBookmark = this._instapaperDB.unlikeBookmark(this.bookmark.bookmark_id);
            } else {
                updateBookmark = this._instapaperDB.likeBookmark(this.bookmark.bookmark_id);
            }

            updateBookmark.done((bookmark: IBookmark) => {
                this.bookmark = bookmark;
                let liked = false;

                if (this.bookmark.starred === 1) {
                    liked = true;
                    Telemetry.instance.track("LikedArticle", null);
                    this._setToggleLikeToUnlike();
                } else {
                    Telemetry.instance.track("UnlikedArticle", null);
                    this._setToggleLikeToLike();
                }

                this._messenger.invokeForResult("articlepropertychanged", getLikeAndArchiveForBookmark(bookmark));
            });
        }

        private _delete(): void {
            Telemetry.instance.track("DeletedBookmark", toPropertySet({ location: "Article" }));
            this._instapaperDB.removeBookmark(this.bookmark.bookmark_id).done(() => {
                this._eventSource.dispatchEvent("removed", null);
            });
        }

        private _move(e: UIEvent): void {
            this.eventSource.dispatchEvent("showMove", null);
            var moveViewModel = new MoveToFolderViewModel(this._instapaperDB);
            moveViewModel.move([this.bookmark], <HTMLElement>e.currentTarget).done((result: boolean) => {
                if (!result) {
                    return;
                }
                Telemetry.instance.track("MovedBookmark", toPropertySet({ location: "Article" }));
                this._eventSource.dispatchEvent("removed", null);
            });
        }

        private _initializeArchiveCommand(): void {
            this._archiveCommand = new WinJS.UI.Command(null, {
                onclick: this._archive.bind(this),
            });

            this._archiveCommand.icon = "\uE7B8";

            if (this.bookmark.folder_dbid === this._instapaperDB.commonFolderDbIds.archive) {
                this._archiveCommand.tooltip = "Move to home (Ctrl + A)";
                this._archiveCommand.extraClass = "article-viewer-toolbar-unarchive";
            } else {
                this._archiveCommand.tooltip = "Archive (Ctrl + A)";
            }
        }

        private _archive(): void {
            var destinationFolder: number;
            if (this.bookmark.folder_dbid === this._instapaperDB.commonFolderDbIds.archive) {
                destinationFolder = this._instapaperDB.commonFolderDbIds.unread;
            } else {
                destinationFolder = this._instapaperDB.commonFolderDbIds.archive;
            }

            Telemetry.instance.track("ArchiveBookmark", toPropertySet({ location: "Article" }));

            this._instapaperDB.moveBookmark(this.bookmark.bookmark_id, destinationFolder).done(() => {
                this._eventSource.dispatchEvent("removed", null);
            });
        }

        public refreshStateDueToSizeChange(): void {
            this._updateWindowState();

            if (this._screenMode === ScreenMode.PictureInPicture) {
                this._capturePictureInPictureSize();
            }
        }

        private _initializeViewModeCommands(): void {
            this._fullScreenCommand = new WinJS.UI.Command(null, {
                onclick: () => {
                    Telemetry.instance.track("ToggleFullScreen", null);
                    this._setScreenMode(ScreenMode.ToggleFullScreen);
                }
            });

            this._pictureInPictureCommand = new WinJS.UI.Command(null, {
                onclick: () => {
                    Telemetry.instance.track("TogglePictureInPicture", null);
                    this._setScreenMode(ScreenMode.TogglePictureInPicture);
                }
            });

            this._updateWindowState();
        }

        public videoContentFillsWindow(): void {
            Telemetry.instance.track("VideoContentWentFullScreen", null);
            this._setScreenMode(ScreenMode.FullScreen);

            this.displaySettings.temporarilyApplyTheme(Settings.Theme.Night);
        }

        public videoContentInline(): void {
            Telemetry.instance.track("VideoContentWentWindowed", null);
            this.displaySettings.restoreSettings();
            this.switchToNormalWindowMode();
        }

        private _setScreenMode(targetScreenMode: ScreenMode): void {
            const currentMode = this._getScreenModeFromWindow();

            if (targetScreenMode === currentMode) {
                return;
            }

            if (targetScreenMode === ScreenMode.ToggleFullScreen || targetScreenMode === ScreenMode.TogglePictureInPicture) {
                switch (currentMode) {
                    case ScreenMode.FullScreen:
                        if (targetScreenMode === ScreenMode.ToggleFullScreen) {
                            targetScreenMode = ScreenMode.Normal;
                        }

                        if (targetScreenMode === ScreenMode.TogglePictureInPicture) {
                            targetScreenMode = ScreenMode.PictureInPicture;
                        }
                        break;

                    case ScreenMode.PictureInPicture:
                        if (targetScreenMode === ScreenMode.ToggleFullScreen) {
                            targetScreenMode = ScreenMode.FullScreen;
                        }

                        if (targetScreenMode === ScreenMode.TogglePictureInPicture) {
                            targetScreenMode = ScreenMode.Normal;
                        }
                        break;

                    case ScreenMode.Normal:
                        if (targetScreenMode === ScreenMode.ToggleFullScreen) {
                            targetScreenMode = ScreenMode.FullScreen;
                        } else {
                            targetScreenMode = ScreenMode.PictureInPicture;
                        }
                        break;
                }
            }

            // Always switch to normal mode, since we might be going directly to another state.
            // If we _Are_ in normal mode (which shouldn't happen due to a check above), this just
            // no-ops
            this.switchToNormalWindowMode();

            const view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            switch (targetScreenMode) {
                case ScreenMode.FullScreen:
                    view.tryEnterFullScreenMode();
                    break;

                case ScreenMode.PictureInPicture:
                    view.tryEnterViewModeAsync(Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay, this._getPictureInPictureSize()).done(null, () => { });
                    break;

                case ScreenMode.Normal:
                    break;
            }
        }

        private _capturePictureInPictureSize(): void {
            const size = { width: window.outerWidth, height: window.outerHeight };
            const settings = new Settings.ViewerSettings();
            settings.pictureInPictureSize = size;
        }

        private _getPictureInPictureSize(): Windows.UI.ViewManagement.ViewModePreferences {
            const preferences = Windows.UI.ViewManagement.ViewModePreferences.createDefault(Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay);
            const settings = new Settings.ViewerSettings();
            if (settings.pictureInPictureSize) {
                preferences.customSize = settings.pictureInPictureSize;
            }

            return preferences;
        }

        private _getScreenModeFromWindow(): ScreenMode {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            if (view.isFullScreenMode) {
                return ScreenMode.FullScreen;
            }

            if (view.viewMode === Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay) {
                return ScreenMode.PictureInPicture;
            }

            return ScreenMode.Normal;
        }

        private _updateWindowState(): void {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            const previousScreenMode = this._screenMode;
            this._screenMode = this._getScreenModeFromWindow();

            if (previousScreenMode === this._screenMode) {
                return;
            }

            switch (this._screenMode) {
                case ScreenMode.FullScreen:
                    this._setFullScreenCommandToExit();
                    this._setPictureInPictureCommandToEnter();
                    break;

                case ScreenMode.PictureInPicture:
                    this._setFullScreenCommandToEnter();
                    this._setPictureInPictureCommandToExit();
                    break;

                case ScreenMode.Normal:
                default:
                    this._setFullScreenCommandToEnter();
                    this._setPictureInPictureCommandToEnter();
                    break;
            }

            if (previousScreenMode === ScreenMode.Unset) {
                // Don't log the initial state change
                return;
            }

            Telemetry.instance.track("ScreenModeChanged", toPropertySet({ was: previousScreenMode, is: this._screenMode }));
        }

        public switchToNormalWindowMode(): boolean {
            const screenMode = this._getScreenModeFromWindow();
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();

            switch (screenMode) {
                case ScreenMode.Normal:
                    return false;

                case ScreenMode.FullScreen:
                    view.exitFullScreenMode();
                    break;

                case ScreenMode.PictureInPicture:
                    view.tryEnterViewModeAsync(Windows.UI.ViewManagement.ApplicationViewMode.default).done(null, () => {});
                    break;
            }

            return true;
        }

        private _setFullScreenCommandToExit(): void {
            this._fullScreenCommand.tooltip = "Exit Full Screen (F11)";
            this._fullScreenCommand.icon = "\uE1D8";
        }

        private _setFullScreenCommandToEnter(): void {
            this._fullScreenCommand.tooltip = "Enter Full Screen (F11)";
            this._fullScreenCommand.icon = "\uE1D9";
        }

        private _setPictureInPictureCommandToExit(): void {
            this._pictureInPictureCommand.tooltip = "Exit Picture In Picture (Ctrl + P)";
            this._pictureInPictureCommand.icon = "\uE8A7";
        }

        private _setPictureInPictureCommandToEnter(): void {
            this._pictureInPictureCommand.tooltip = "Enter Picture In Picture (Ctrl + P)";
            this._pictureInPictureCommand.icon = "\uE944";
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

        public updateTypeface(newFont: Settings.Font, fromUserChange?: boolean): void {
            var fontChoice: IFontChoice;
            DisplaySettingsViewModel.fontChoices.forEach((details) => {
                if (details.font != newFont) {
                    return;
                }

                fontChoice = details;
            });

            if (fromUserChange) {
                Telemetry.instance.track("FontChanged", toPropertySet({ font: fontChoice.fontFamily }));
            }

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

            Telemetry.instance.track("FontSizeDecreased", null);
            this._setFontSize(this._fontSize - 1);
        }

        public increaseFontSize(): void {
            if (this._fontSize >= MAX_FONT_SIZE) {
                return;
            }

            Telemetry.instance.track("FontSizeIncreased", null);
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

            Telemetry.instance.track("LineHeightDecreased", null);
            this._setLineHeight(this._lineHeight - LINE_HEIGHT_INCREMENT);
        }

        public increaseLineHeight(): void {
            if (this._lineHeight >= MAX_LINE_HEIGHT) {
                return;
            }

            Telemetry.instance.track("LineHeightIncreased", null);
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

            Telemetry.instance.track("ArticleWidthDecreased", null);
            this._setArticleWidth(this._articleWidth - ARTICLE_WIDTH_INCREMENT);
        }

        public increaseArticleWidth(): void {
            if ((this._articleWidth >= MAX_ARTICLE_WIDTH) || (window.outerWidth * (this._articleWidth / 100)) >= MAX_ARTICLE_PX_WIDTH) {
                return;
            }

            Telemetry.instance.track("ArticleWidthIncreased", null);
            this._setArticleWidth(this._articleWidth + ARTICLE_WIDTH_INCREMENT);
        }

        private _setArticleWidth(articleWidth: number) {
            this._articleWidth = articleWidth;
            this._settings.currentArticleWidth = articleWidth;
            this._messenger.invokeForResult("setcontentcssproperty", { property: "width", value: this._articleWidth + "vw" });
            this._messenger.invokeForResult("refreshimagewidths", this._articleWidth);
            this._eventSource.dispatchEvent("articlewidthchanged", this._articleWidth);
        }

        public setTheme(theme: Settings.Theme): void {
            let targetTheme = theme;
            if (theme === Settings.Theme.MatchSystem) {
                // When we're using the automatic theme, we need
                // to defer to the UI theme that is being used,
                // which itself can be automatic
                theme = Settings.ViewerSettings.getCurrentSystemTheme();
            }

            // Find the theme details we want
            let themeDetails = DisplaySettingsViewModel.getDetailsForTheme(theme);

            // tell everyone
            this._messenger.invokeForResult("settheme", themeDetails.viewerCssClass);
            this._settings.currentTheme = targetTheme;
            this._eventSource.dispatchEvent("settheme", themeDetails);
        }

        public temporarilyApplyTheme(theme: Settings.Theme): void {
            const themeDetails = DisplaySettingsViewModel.getDetailsForTheme(theme);
            this._messenger.invokeForResult("settheme", themeDetails.viewerCssClass);
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
                    { font: Settings.Font.SitkaText, label: "Sitka Text", fontFamily: "SitkaText" },
                ];
            }

            return DisplaySettingsViewModel._fontChoices;
        }

        private static _themeDetails: IThemeDetails[];
        private static get themeDetails(): IThemeDetails[] {
            if (!DisplaySettingsViewModel._themeDetails) {
                DisplaySettingsViewModel._themeDetails = [
                    { theme: Settings.Theme.Day, viewerCssClass: "day", titlebarForeground: Windows.UI.Colors.black, titlebarBackground: Windows.UI.ColorHelper.fromArgb(1.0, 0xF9, 0xF9, 0xF9) },
                    { theme: Settings.Theme.Paper, viewerCssClass: "paper", titlebarForeground: Windows.UI.Colors.black, titlebarBackground: Windows.UI.ColorHelper.fromArgb(1.0, 0xE8, 0xD2, 0xA8) },
                    { theme: Settings.Theme.Dusk, viewerCssClass: "dusk", titlebarForeground: Windows.UI.Colors.lightGray, titlebarBackground: Windows.UI.ColorHelper.fromArgb(1.0, 0x28, 0x43, 0x43) },
                    { theme: Settings.Theme.Night, viewerCssClass: "night", titlebarForeground: Windows.UI.Colors.white, titlebarBackground: Windows.UI.ColorHelper.fromArgb(1.0, 0x20, 0x20, 0x20) },
                    { theme: Settings.Theme.MatchSystem, viewerCssClass: null, titlebarForeground: null, titlebarBackground: null }
                ];
            }

            return DisplaySettingsViewModel._themeDetails;
        }

        private static getDetailsForTheme(theme: Settings.Theme): IThemeDetails {
            // Find the theme details we want
            let themeDetails: IThemeDetails;
            DisplaySettingsViewModel.themeDetails.forEach((details) => {
                if (details.theme != theme) {
                    return;
                }

                themeDetails = details;
            });

            return themeDetails;
        }
    }
}