module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

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
        private primaryToolbar: WinJS.UI.ToolBar;
        private secondaryToolbar: WinJS.UI.ToolBar;
        private _pageReady: boolean = false;
        private _toolbarVisible: boolean = true;
        private _navigationManager: Windows.UI.Core.SystemNavigationManager;

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

                        this.element.style.opacity = ""; // Allow default styles to sort themselves out
                        
                        // Update the titlebar style to match the document
                        this._setTitleBarForArticle();

                        // Set commands to the toolbar controls to handle primary/secondary scenarios
                        this.primaryToolbar.data = this.viewModel.getPrimaryCommands();
                        this.secondaryToolbar.data = this.viewModel.getSecondaryCommands();

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
                progresschanged: (e) => {
                    this.viewModel.updateProgress(e.detail);
                },
                dismiss: () => {
                    this.close(null);
                },
                toggletoolbar: this._toggleToolbar.bind(this),
                linkinvoked: (e) => {
                    this._handleLinkInvocation(e.detail);
                }
            }));

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

        private _handleLinkInvocation(url: string): void {;
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

        public close(args: Windows.UI.Core.BackRequestedEventArgs): void {
            if (args != null) {
                args.handled = true; // Make sure the OS doesn't handle it.
            }

            if (this._messenger) {
                this._messenger.dispose();
                this._messenger = null;
            }

            this._navigationManager.appViewBackButtonVisibility = Windows.UI.Core.AppViewBackButtonVisibility.collapsed;
            this._restoreTitlebar();

            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();
            if (view.isFullScreen) {
                view.exitFullScreenMode();
            }

            WinJS.UI.Animation.slideDown(this.element).done(() => {
                // Flip this flag to allow the next navigate to complete, because
                // we're normally supressing navigations after the first load.
                this._pageReady = false;

                // Navigate blank to immediately stop the audio from a video
                // that might be playing, otherwise it'll wait till it gets
                // GC'd. :(
                this._content.navigate("about:blank");

                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
            });
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
            this._content = null;
        }
    }

    export class ArticleViewerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.ArticleViewerExperience" };
        private _toggleLikeCommand: WinJS.UI.Command;
        private _deleteCommand: WinJS.UI.Command;
        private _archiveCommand: WinJS.UI.Command;
        private _fullScreenCommand: WinJS.UI.Command;
        private _eventSource: Utilities.EventSource;

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
        }

        public updateProgress(progress: number): void {
            this._instapaperDB.updateReadProgress(this.bookmark.bookmark_id, progress).done((bookmark) => {
                this.bookmark = bookmark;
            });
        }

        public getPrimaryCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            commands.push(this._toggleLikeCommand);
            commands.push(this._archiveCommand);

            return new WinJS.Binding.List(commands);
        }

        public getSecondaryCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            commands.push(this._fullScreenCommand);
            commands.push(this._deleteCommand);

            return new WinJS.Binding.List(commands);
        }

        public get eventSource(): Utilities.EventSource {
            return this._eventSource;
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
            if (view.isFullScreen) {
                this._setFullScreenCommandToExit();
            } else {
                this._setFullScreenCommandToEnter();
            }
        }

        private _toggleFullScreen() {
            var view = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();

            if (!view.isFullScreen) {
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
                    if (!view.isFullScreen) {
                        return;
                    }

                    initialResizeHandler.cancel();
                    this._updateFullScreenButtonState();

                    var windowResizeHandler = Codevoid.Utilities.addEventListeners(window, {
                        resize: () => {
                            if (view.isFullScreen) {
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
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
}