﻿module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    interface IFontChoice {
        label: string;
        fontFamily: string;
    }

    export class ArticleViewerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _content: MSHTMLWebViewElement;
        private _toolbarContainer: HTMLElement;
        private viewModel: ArticleViewerViewModel;
        private _previousPrimaryColour: Windows.UI.Color;
        private _previousTextColour: Windows.UI.Color;
        private _messenger: Codevoid.Utilities.WebViewMessenger;
        private _container: HTMLElement;
        private _title: HTMLElement;
        private _displaySettingsFlyout: WinJS.UI.Flyout;
        private toolbar: WinJS.UI.ToolBar;
        private _pageReady: boolean = false;
        private _toolbarVisible: boolean = true;
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;
        private _fontSelector: HTMLSelectElement;
        private _fonts: WinJS.UI.Repeater;
        private _flyoutInitialized: boolean = false;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            this._navigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView();

            WinJS.Utilities.addClass(element, "articleViewer-dialog");
            WinJS.Utilities.addClass(element, "dialog");
            WinJS.Utilities.addClass(element, "win-disposable");
            WinJS.Utilities.addClass(element, "hide");

            DOM.loadTemplate("/HtmlTemplates.html", "articleViewer").then((template) => {
                return template.render({}, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(window, {
                    keyup: (e: KeyboardEvent) => {
                        switch (e.key.toLowerCase()) {
                            case "esc":
                                this.close(null);
                                break;

                            case "alt":
                                this._toggleToolbar();
                                break;
                        }
                    }
                }));

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
                this._container.appendChild(this._content);

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

                document.body.appendChild(this._displaySettingsFlyout.element);
                this.viewModel.setDisplaySettingsFlyout(this._displaySettingsFlyout);
            });
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
                    this._pageReady = true;

                    readyHandler.cancel();
                    readyHandler = null;

                    WinJS.Promise.join([
                        this._messenger.addStyleSheet("ms-appx-web:///css/viewer.css"),
                        this._messenger.addAdditionalScriptInsideWebView("ms-appx-web:///js/ui/ArticleViewer_client.js"),
                    ]).done(() => {
                        this._messenger.invokeForResult("inserttitle", {
                            title: this.viewModel.bookmark.title,
                            domain: this._extractDomainFromUrl(this.viewModel.bookmark.url),
                            url: this.viewModel.bookmark.url,
                        });

                        this._messenger.invokeForResult("restorescroll", this.viewModel.bookmark.progress);

                        // Set the theme on the UI before we reveal it.
                        this._setTheme("day");

                        this.element.style.opacity = ""; // Allow default styles to sort themselves out
                        
                        // Update the titlebar style to match the document
                        this._setTitleBarForArticle();

                        // Set commands to the toolbar controls to handle primary/secondary scenarios
                        this.toolbar.data = this.viewModel.getCommands();

                        WinJS.UI.Animation.slideUp(this.element);

                        // Setup OS back button support
                        this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.visible;
                        this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._navigationManager, {
                            backrequested: this.close.bind(this),
                        }));
                    });
                },
            });

            this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(this._messenger.events, {
                dismiss: () => {
                    this.close(null);
                },
                toggletoolbar: this._toggleToolbar.bind(this),
            }));

            this.viewModel.setMessenger(this._messenger);
            this.viewModel.displaySettings.setMessenger(this._messenger);

            this._content.navigate("ms-appdata:///local" + this.viewModel.bookmark.localFolderRelativePath);
        }

        private _setTitleBarForArticle(): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            this._previousPrimaryColour = titleBar.backgroundColor;
            this._previousTextColour = titleBar.foregroundColor;

            this._setTitleBar(Windows.UI.Colors.white, Windows.UI.Colors.gray);
        }

        private _restoreTitlebar(): void {
            this._setTitleBar(this._previousPrimaryColour, this._previousTextColour);
        }

        private _setTheme(theme: string): void {
            this._messenger.invokeForResult("settheme", theme);
            this._toolbarContainer.setAttribute("data-theme", theme);
        }

        private _extractDomainFromUrl(url: string): string {
            // RegEx from:
            // https://regex101.com/r/wN6cZ7/63
            var regEx = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/igm
            var matches = regEx.exec(url);

            return matches[1];
        }

        private _setTitleBar(primaryColour: Windows.UI.Color, textColour: Windows.UI.Color): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            titleBar.backgroundColor = primaryColour;
            titleBar.buttonBackgroundColor = primaryColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = primaryColour;
            titleBar.buttonInactiveBackgroundColor = primaryColour;
        }

        private _toggleToolbar(): void {
            var offset = {
                top: null,
                left: "0px",
            };

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
                    this._toolbarVisible = false;
                });
            } else {
                // Remove the class before getting the client width, otherwise it'll
                // be a big fat 0.
                WinJS.Utilities.removeClass(this._toolbarContainer, "hide");
                offset.top = (directionMultiplier * this._toolbarContainer.clientHeight) + "px";

                WinJS.UI.Animation.showEdgeUI(this._toolbarContainer, offset).done(() => {
                    this._toolbarVisible = true;
                });
            }
        }

        public fontSelectionChanged(e: UIEvent): void {
            this.viewModel.displaySettings.updateFont(this._fontSelector.selectedIndex);
        }

        public displaySettingsFlyoutOpening(e: Event) {
            if (this._flyoutInitialized) {
                return;
            }

            this._fonts.data = new WinJS.Binding.List<IFontChoice>(DisplaySettingsViewModel.fontChoices);
            this._fontSelector = <HTMLSelectElement>this._fonts.element;
            this._fontSelector.selectedIndex = 2;

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
            this._setTheme("day");
        }

        public switchThemeToNight(): void {
            this._setTheme("night");
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.displaySettingsFlyoutOpening);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.fontSelectionChanged);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseFontSize);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseFontSize);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseLineHeight);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseLineHeight);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.decreaseMargins);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.increaseMargins);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToDay);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.switchThemeToNight);

    export class ArticleViewerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.ArticleViewerExperience" };
        private _displaySettingsCommand: WinJS.UI.Command;
        private _toggleLikeCommand: WinJS.UI.Command;
        private _deleteCommand: WinJS.UI.Command;
        private _archiveCommand: WinJS.UI.Command;
        private _fullScreenCommand: WinJS.UI.Command;
        private _eventSource: Utilities.EventSource;
        private _remoteEventHandlers: Utilities.ICancellable;
        private _messenger: Utilities.WebViewMessenger;
        private _displaySettings: DisplaySettingsViewModel = new DisplaySettingsViewModel();

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
                type: 'flyout',
                onclick: () => { },
            });
        }

        public dispose(): void {
            if (this._remoteEventHandlers) {
                this._remoteEventHandlers.cancel();
                this._remoteEventHandlers = null;
            }

            this._messenger = null;
            this._displaySettings.dispose();
            this._displaySettings = null;
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

    var MAX_FONT_SIZE = 36;
    var MIN_FONT_SIZE = 12;
    var MIN_LINE_HEIGHT = 1.0;
    var MAX_LINE_HEIGHT = 3.0;
    var LINE_HEIGHT_INCREMENT = 0.1;
    var ARTICLE_WIDTH_INCREMENT = 2;
    var MAX_ARTICLE_WIDTH = 95;
    var MIN_ARTICLE_WIDTH = 70;

    export class DisplaySettingsViewModel {
        private _messenger: Utilities.WebViewMessenger;
        private _fontSize: number = 20;
        private _lineHeight: number = 1.6;
        private _articleWidth: number = 80;

        public setMessenger(messenger: Utilities.WebViewMessenger): void {
            this._messenger = messenger;
        }

        public dispose(): void {
            this._messenger = null;
        }

        public updateFont(newFontIndex: number): void {
            var fontChoice = DisplaySettingsViewModel.fontChoices[newFontIndex];

            this._messenger.invokeForResult("setbodycssproperty", { property: "fontFamily", value: fontChoice.fontFamily });
        }

        public decreaseFontSize(): void {
            if (this._fontSize <= MIN_FONT_SIZE) {
                return;
            }

            this._fontSize -= 1;
            this._messenger.invokeForResult("setbodycssproperty", { property: "fontSize", value: this._fontSize + "px" });
        }

        public increaseFontSize(): void {
            if (this._fontSize >= MAX_FONT_SIZE) {
                return;
            }

            this._fontSize += 1;
            this._messenger.invokeForResult("setbodycssproperty", { property: "fontSize", value: this._fontSize + "px" });
        }

        public decreaseLineHeight(): void {
            if (this._lineHeight <= MIN_LINE_HEIGHT) {
                return;
            }

            this._lineHeight -= LINE_HEIGHT_INCREMENT;
            this._messenger.invokeForResult("setbodycssproperty", { property: "lineHeight", value: this._lineHeight + "em" });
        }

        public increaseLineHeight(): void {
            if (this._lineHeight >= MAX_LINE_HEIGHT) {
                return;
            }

            this._lineHeight += LINE_HEIGHT_INCREMENT;
            this._messenger.invokeForResult("setbodycssproperty", { property: "lineHeight", value: this._lineHeight + "em" });
        }

        public decreaseArticleWidth(): void {
            if (this._articleWidth <= MIN_ARTICLE_WIDTH) {
                return;
            }

            this._articleWidth -= ARTICLE_WIDTH_INCREMENT;
            this._messenger.invokeForResult("setbodycssproperty", { property: "maxWidth", value: this._articleWidth + "vw" });
        }

        public increaseArticleWidth(): void {
            if (this._articleWidth >= MAX_ARTICLE_WIDTH) {
                return;
            }

            this._articleWidth += ARTICLE_WIDTH_INCREMENT;
            this._messenger.invokeForResult("setbodycssproperty", { property: "maxWidth", value: this._articleWidth + "vw" });
        }

        private static _fontChoices: IFontChoice[];
        public static get fontChoices(): IFontChoice[] {
            if (!DisplaySettingsViewModel._fontChoices) {
                DisplaySettingsViewModel._fontChoices = [
                    { label: "Arial", fontFamily: "Arial" },
                    { label: "Calibri", fontFamily: "Calibri" },
                    { label: "Cambria", fontFamily: "Cambria" },
                    { label: "Constantia", fontFamily: "Constantia" },
                    { label: "Georgia", fontFamily: "Georgia" },
                ];
            }

            return DisplaySettingsViewModel._fontChoices;
        }
    }
}