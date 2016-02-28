module Codevoid.ArticleVoid.UI {
    class ArticleViewer_client {
        private _scrollingElement: HTMLElement;

        public initialize(): void {
            this._scrollingElement = document.body;

            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("restorescroll", this._restoreScroll.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("inserttitle", this._insertTitle.bind(this));
        }

        private _restoreScroll(targetScrollPosition: number, completion): void {
            var targetScrollPosition = this._scrollingElement.scrollHeight * targetScrollPosition;
            this._scrollingElement.scrollTop = targetScrollPosition;

            // Now we've restored the scroll position, we're able to handle pushing scroll
            // changes back to the parent.
            document.addEventListener("scroll", this._handleScroll.bind(this));
        }

        private _insertTitle(data: { title: string, domain: string }) {
            var headerContainer = document.createElement("div");
            headerContainer.className = "articleViewer-header-container";

            var title = <HTMLElement>headerContainer.appendChild(document.createElement("div"));
            title.className = "articleViewer-title";

            var subTitle = <HTMLElement>headerContainer.appendChild(document.createElement("div"));
            subTitle.className = "articleViewer-subTitle";

            title.textContent = data.title;
            subTitle.textContent = data.domain;

            document.body.insertBefore(headerContainer, document.body.firstChild);
        }

        private _handleScroll(): void {
            // Calculate the % that we're scrolled
            var progress = this._scrollingElement.scrollTop / this._scrollingElement.scrollHeight;

            if ((this._scrollingElement.scrollTop + this._scrollingElement.clientHeight) >= this._scrollingElement.scrollHeight) {
                progress = 1.0;
            }

            // Tell everyone that it's scrolled.
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("progresschanged", progress);
        }
    }

    var client = new ArticleViewer_client();
    client.initialize();
}