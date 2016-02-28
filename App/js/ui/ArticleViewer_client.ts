module Codevoid.ArticleVoid.UI {
    var KEY_PLUS = 187;
    var KEY_MINUS = 189;

    class ArticleViewer_client {
        private _scrollingElement: HTMLElement;

        public initialize(): void {
            this._scrollingElement = document.body;

            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("restorescroll", this._restoreScroll.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("inserttitle", this._insertTitle.bind(this));

            // Handle the mouse wheel event so ctrl+wheel doesn't zoom the page
            document.addEventListener("mousewheel", this._handleWheel);

            // Handle key down to disable zooming via ctrl+ plus / minus
            document.addEventListener("keydown", this._handleKeyDown);
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

        private _handleWheel(ev: MouseWheelEvent): void {
            if (!ev.ctrlKey) {
                return;
            }

            ev.preventDefault();
        }

        private _handleKeyDown(ev: KeyboardEvent): void {
            if (!ev.ctrlKey) {
                return;
            }

            if (!((ev.keyCode === KEY_PLUS) || (ev.keyCode === KEY_MINUS))) {
                return;
            }

            ev.preventDefault();
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