module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class ArticleViewerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _content: MSHTMLWebViewElement;
        private viewModel: ArticleViewerViewModel;
        private _previousPrimaryColour: Windows.UI.Color;
        private _previousTextColour: Windows.UI.Color;

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

                // unhide it, and make it invisible
                // This is to allow the control to layout itself so that
                // when the actual webview is animated, it's rendered correctly
                // Without this, the web view is rendered "zoomed" during
                // the slide in animation.
                WinJS.Utilities.removeClass(element, "hide");
                element.style.opacity = "0.0";
                WinJS.Promise.timeout().done(() => {
                    this._setTitleBarForArticle();
                    element.style.opacity = ""; // Allow default styles to sort themselves out
                    WinJS.UI.Animation.slideUp(this.element);

                    this._content.navigate("ms-appdata:///local" + this.viewModel.bookmark.localFolderRelativePath);
                });
            });
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