module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class ArticleViewerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _content: MSHTMLWebViewElement;
        private viewModel: ArticleViewerViewModel;
        private _previousPrimaryColour: Windows.UI.Color;
        private _previousTextColour: Windows.UI.Color;
        private _messenger: Codevoid.Utilities.WebViewMessenger;
        private _container: HTMLElement;
        private _pageReady: boolean = false;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            WinJS.Utilities.addClass(element, "articleViewer-dialog");
            WinJS.Utilities.addClass(element, "dialog");
            WinJS.Utilities.addClass(element, "win-disposable");
            WinJS.Utilities.addClass(element, "hide");

            DOM.loadTemplate("/HtmlTemplates.html", "articleViewer").then((template) => {
                return template.render(this.viewModel, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this._handlersToCleanup.push(Codevoid.Utilities.addEventListeners(window, {
                    keyup: (e: KeyboardEvent) => {
                        if (e.keyCode != WinJS.Utilities.Key.escape) {
                            return;
                        }

                        this.close();
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

                    this._messenger.addStyleSheet("ms-appx-web:///css/viewer.css").done(() => {
                        this.element.style.opacity = ""; // Allow default styles to sort themselves out
                        
                        // Update the titlebar style to match the document
                        this._setTitleBarForArticle();

                        WinJS.UI.Animation.slideUp(this.element);
                    });
                }
            });

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

        private _setTitleBar(primaryColour: Windows.UI.Color, textColour: Windows.UI.Color): void {
            var titleBar = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().titleBar;

            titleBar.backgroundColor = primaryColour;
            titleBar.buttonBackgroundColor = primaryColour;
            titleBar.buttonForegroundColor = textColour;
            titleBar.foregroundColor = textColour;
            titleBar.inactiveBackgroundColor = primaryColour;
            titleBar.buttonInactiveBackgroundColor = primaryColour;
        }

        public close(): void {
            this._restoreTitlebar();
            WinJS.UI.Animation.slideDown(this.element).done(() => {
                Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
            });
        }

        public dispose(): void {
            this._handlersToCleanup.forEach((item) => {
                item.cancel();
            });

            this._handlersToCleanup = null;
        }
    }

    export class ArticleViewerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.ArticleVoid.UI.ArticleViewerExperience" };
        constructor(public bookmark: IBookmark) {
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
}