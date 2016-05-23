module Codevoid.Storyvoid.UI {
    var KEY_PLUS = 187;
    var KEY_MINUS = 189;
    var KEY_ESCAPE = 27;
    var KEY_ALT = 18;

    class ArticleViewer_client {
        private _scrollingElement: HTMLElement;

        public initialize(): void {
            this._scrollingElement = document.body;

            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("restorescroll", this._restoreScroll.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("inserttitle", this._insertTitle.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("setbodycssproperty", this._setBodyCssProperty.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("settheme", this._setTheme.bind(this));

            // Handle the mouse wheel event so ctrl+wheel doesn't zoom the page
            document.addEventListener("mousewheel", this._handleWheel);

            // Handle key down to disable zooming via ctrl+ plus /
            document.addEventListener("keydown", this._handleKeyDown.bind(this));

            document.addEventListener("click", this._handleClick.bind(this));
            document.addEventListener("pointerup", this._handlePointerUp.bind(this));
        }

        private _restoreScroll(targetScrollPosition: number, completion): void {
            var targetScrollPosition = this._scrollingElement.scrollHeight * targetScrollPosition;
            this._scrollingElement.scrollTop = targetScrollPosition;

            // Now we've restored the scroll position, we're able to handle pushing scroll
            // changes back to the parent.
            document.addEventListener("scroll", this._handleScroll.bind(this));
        }

        private _insertTitle(data: { title: string, domain: string, url: string }): void {
            var headerContainer = document.createElement("div");
            headerContainer.className = "articleViewer-header-container";

            var title = <HTMLElement>headerContainer.appendChild(document.createElement("div"));
            title.className = "articleViewer-title";

            var subTitle = <HTMLAnchorElement>headerContainer.appendChild(document.createElement("a"));
            subTitle.className = "articleViewer-subTitle";

            title.textContent = data.title;
            subTitle.textContent = data.domain;
            subTitle.href = data.url;

            document.body.insertBefore(headerContainer, document.body.firstChild);
        }

        private _setBodyCssProperty(propertyToSet: { property: string, value: string }): void {
            document.body.style[propertyToSet.property] = propertyToSet.value;
        }

        private _setTheme(theme: string): void {
            var themeClass = "theme-" + theme;

            // This will intentionally overwrite any existing classes that might
            // be on the body element. This is intentional, since we don't want
            // to have to think hard about the CSS classes involved & if they
            // maybe have previously been set.
            document.body.className = themeClass;
        }

        private _handleWheel(ev: MouseWheelEvent): void {
            if (!ev.ctrlKey) {
                return;
            }

            ev.preventDefault();
        }

        private _handleClick(ev: MouseEvent) {
            // We're only going to do anything on left-clik
            if (ev.button != 0) {
                return;
            }

            // We need to see if this click was on an element that was a "a" tag, or
            // was the child of an A tag.
            var wasInsideAnchor = false;
            var parentElement = <HTMLElement>ev.target;
            while (parentElement != null) {
                if (parentElement.tagName.toLowerCase() === 'a') {
                    wasInsideAnchor = true;
                    break;
                }

                parentElement = parentElement.parentElement;
            }

            // If we were inside an anchor element, we don't want
            // to "toggle" anything; we just want notify that a link was clicked
            if (wasInsideAnchor) {
                Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("linkinvoked", (<HTMLAnchorElement>parentElement).href);
                return;
            }

            this._toggleToolbar();
        }

        private _handlePointerUp(ev: PointerEvent) {
            if (ev.button != 3) {
                return;
            }

            ev.stopPropagation();
            ev.preventDefault();
            this._dismiss();
        }

        private _handleKeyDown(ev: KeyboardEvent): void {
            // Handle these keys as 
            if (((ev.keyCode === KEY_PLUS) || (ev.keyCode === KEY_MINUS)) && ev.ctrlKey) {
                ev.preventDefault();
                return;
            }

            if (ev.ctrlKey) {
                Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("shortcutinvoked", ev.keyCode);
                return;
            }

            switch (ev.keyCode) {
                case KEY_ESCAPE:
                    this._dismiss();
                    break;

                case KEY_ALT:
                    this._toggleToolbar();
                    break;
            }
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

        private _toggleToolbar(): void {
            // If there is selection on the document, it means the user his likely to
            // be click-scroll-click-scroll through the document, and the toggling of
            // the toolbar is distracting.
            if (!document.getSelection().isCollapsed) {
                return;
            }

            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("toggletoolbar", null);
        }

        private _dismiss(): void {
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("dismiss", null);
        }
    }

    var client = new ArticleViewer_client();
    client.initialize();
}