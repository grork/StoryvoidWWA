module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class ArticleViewerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private viewModel: ArticleViewerViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            WinJS.Utilities.addClass(element, "articleViewer-container");
            WinJS.Utilities.addClass(element, "dialog");
            WinJS.Utilities.addClass(element, "win-disposable");

            DOM.loadTemplate("/HtmlTemplates.html", "articleViewer").then((template) => {
                return template.render(null, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedOutExperience");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);
            });
        }

        public close(): void {
            Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this.viewModel);
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
        constructor() {
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience);
    WinJS.Utilities.markSupportedForProcessing(ArticleViewerExperience.prototype.close);
}