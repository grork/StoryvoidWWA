module Codevoid.ArticleVoid.UI {
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
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
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
                            domain: this._extractDomainFromUrl(this.viewModel.bookmark.url)
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
        public experience = { wwa: "Codevoid.ArticleVoid.UI.ArticleViewerExperience" };
        constructor(public bookmark: IBookmark, private _instapaperDB: InstapaperDB) {
        }

        public updateProgress(progress: number): void {
            this._instapaperDB.updateReadProgress(this.bookmark.bookmark_id, progress).done((bookmark) => {
                this.bookmark = bookmark;
            });
        }

        public getPrimaryCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            var like = new WinJS.UI.Command(null, {
                tooltip: "Like",
                icon: "like",
                onclick: () => {
                    this._toggleLike();
                }
            });

            commands.push(like);

            return new WinJS.Binding.List(commands);
        }

        public getSecondaryCommands(): WinJS.Binding.List<WinJS.UI.ICommand> {
            var commands = [];

            var deleteCommand = new WinJS.UI.Command(null, {
                tooltip: "Delete",
                icon: "delete",
                onclick: () => {
                    this._delete();
                }
            });

            commands.push(deleteCommand);

            return new WinJS.Binding.List(commands);
        }


        private _toggleLike(): void {
            // TODO: Toggle the like
        }

        private _delete(): void {
            // TODO: Close & delete
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
}