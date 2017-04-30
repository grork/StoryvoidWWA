module Codevoid.Storyvoid.UI {
    const KEY_PLUS = 187;
    const KEY_MINUS = 189;
    const KEY_ESCAPE = 27;
    const KEY_ALT = 18;

    const ARTICLE_WIDTH_PX = 1400;
    const MIN_SIZE_FOR_IMAGE_STRETCHING = 300;

    class ArticleViewer_client {
        private _scrollingElement: HTMLElement;
        private _currentImageWidthForImageSizing = 0;
        private _keyDownMap: { [key: number]: boolean } = {};
        private _hadFocus = false;

        public initialize(): void {
            this._scrollingElement = document.body;

            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("restorescroll", this._restoreScroll.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("inserttitle", this._insertTitle.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("setbodycssproperty", this._setBodyCssProperty.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("refreshimagewidths", this._refreshImageWidths.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("settheme", this._setTheme.bind(this));

            // Handle the mouse wheel event so ctrl+wheel doesn't zoom the page
            document.addEventListener("mousewheel", this._handleWheel);

            // Handle key down to disable zooming via ctrl+ plus /
            document.addEventListener("keydown", this._handleKeyDown.bind(this));
            document.addEventListener("keyup", this._handleKeyUp.bind(this));

            document.addEventListener("click", this._handleClick.bind(this));
            document.addEventListener("pointerup", this._handlePointerUp.bind(this));
            document.addEventListener("contextmenu", this._handleContextMenu.bind(this));
            window.addEventListener("resize", this._handleResize.bind(this));
            window.addEventListener("blur", this._handleBlur.bind(this));
            window.addEventListener("focus", this._handleFocus.bind(this));
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

            var subTitle = <HTMLAnchorElement>headerContainer.appendChild(document.createElement("a"));
            subTitle.className = "articleViewer-subTitle";

            var title = <HTMLElement>headerContainer.appendChild(document.createElement("div"));
            title.className = "articleViewer-title";

            title.textContent = data.title;
            subTitle.textContent = data.domain;
            subTitle.href = data.url;

            document.body.insertBefore(headerContainer, document.body.firstChild);

            // Make sure that the document is 'scaled' at the device
            // width. Without this, the scale is all kinds of weird,
            // and some of the elements font size is not scaled by the
            // device scale factor. This ensures they are.
            var meta = document.createElement("meta");
            meta.name = "viewport";
            meta.content = "width=device-width";

            document.head.appendChild(meta);
        }

        private _setBodyCssProperty(propertyToSet: { property: string, value: string }): void {
            document.body.style[propertyToSet.property] = propertyToSet.value;
        }

        private _setImgCssProperty(propertyToSet: { property: string, value: string }): void {
            var images = document.querySelectorAll("img");
            var currentImage: HTMLImageElement;

            for (var i = 0; i < images.length; i++) {
                currentImage = (<HTMLImageElement>images.item(i));

                // Images that are small probably don't want to be fiddled with,
                // so based on some arbitary size, screw it.
                if (currentImage.naturalWidth < MIN_SIZE_FOR_IMAGE_STRETCHING) {
                    continue;
                }

                currentImage.style[propertyToSet.property] = propertyToSet.value;
            }
        }

        private _setTheme(theme: string): void {
            var themeClass = "theme-" + theme;

            // This will intentionally overwrite any existing classes that might
            // be on the body element. This is intentional, since we don't want
            // to have to think hard about the CSS classes involved & if they
            // maybe have previously been set.
            document.body.className = themeClass;
        }

        private _handleResize(): void {
            this._refreshImageWidths(this._currentImageWidthForImageSizing);
        }

        private _refreshImageWidths(articleWidth: number): void {
            this._currentImageWidthForImageSizing = articleWidth;

            var marginValue = {
                property: "margin-left",
                value: "auto",
            };

            var widthProperty = {
                property: "width",
                value: "100vw",
            };

            var properties = [marginValue, widthProperty];

            if (document.body.clientWidth < ARTICLE_WIDTH_PX) {
                marginValue.value = (-(100 - articleWidth) / 2) + "vw";
            } else {
                widthProperty.value = "100%";
            }

            properties.forEach((item) => {
                this._setImgCssProperty(item);
            });
        }

        private _handleWheel(ev: MouseWheelEvent): void {
            if (!ev.ctrlKey) {
                return;
            }

            ev.preventDefault();
        }

        private _handleClick(ev: MouseEvent) {
            // We're only going to do anything on left-click
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

            ev.stopImmediatePropagation();
            ev.stopPropagation();
            ev.preventDefault();

            // If we were inside an anchor element, we don't want
            // to "toggle" anything; we just want notify that a link was clicked
            if (wasInsideAnchor) {
                Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("linkinvoked", (<HTMLAnchorElement>parentElement).href);
                return;
            }

            // If we didn't have focus, then this event is likely coming from when
            // the window itself (not the frame) wasn't in focus, so we dont want
            // to toggle the toolbar & distract the reader
            if (this._hadFocus) {
                this._toggleToolbar();
            }
        }

        private _handlePointerUp(ev: PointerEvent) {
            if (ev.button != 3) {
                return;
            }

            ev.stopPropagation();
            ev.preventDefault();
            this._dismiss();
        }

        private _handleContextMenu(ev: PointerEvent) {
            if (ev.pointerType !== "touch") {
                return;
            }

            // Select the element under the event point
            var range = document.createRange();
            range.selectNode(<HTMLElement>ev.target);
            if (ev.currentTarget === document.body) {
                return;
            }

            document.getSelection().addRange(range);
        }

        private _handleKeyDown(ev: KeyboardEvent): void {
            // Handle these keys as 
            if (((ev.keyCode === KEY_PLUS) || (ev.keyCode === KEY_MINUS)) && ev.ctrlKey) {
                ev.preventDefault();
                return;
            }

            // If this key was already down, we assume that it's being held down, and
            // don't want to handle it again.
            if (this._keyDownMap[ev.keyCode]) {
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

            this._keyDownMap[ev.keyCode] = true;
        }

        private _handleKeyUp(ev: KeyboardEvent): void {
            // Update the map of keys curently pressed to no longer include the
            // key that was just released.
            this._keyDownMap[ev.keyCode] = false;
        }

        private _handleScroll(): void {
            // Calculate the % that we're scrolled
            var progress = this._scrollingElement.scrollTop / this._scrollingElement.scrollHeight;

            // Scroll position + the height of the viewport should be ~the full scroll area. Don't
            // pick the height of the element being scrolled.
            if ((this._scrollingElement.scrollTop + this._scrollingElement.parentElement.clientHeight) >= this._scrollingElement.scrollHeight) {
                progress = 1.0;
            }

            // Tell everyone that it's scrolled.
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("progresschanged", progress);
        }

        private _handleBlur(): void
        {
            this._hadFocus = false;
        }

        private _handleFocus(): void
        {
            // When we get focus, we want to wait to update our state, so that
            // any other events don't see we had focus. Primarily this is to
            // allow us to drop pointer events when the window didn't have focus
            // and they clicked into us to activate the window

            // If we had focus, don't clutter the work queue.
            if (this._hadFocus) {
                return;
            }

            setTimeout(() => {
                this._hadFocus = true;
            }, 150);
        }

        private _toggleToolbar(): void {
            // If there is selection on the document, it means the user his likely to
            // be click-scroll-click-scroll through the document, and the toggling of
            // the toolbar is distracting. However, if it was a touch pointer, then
            // merely clear the selection -- it's enabled by the contextmenu event.
            var wasTouch = (<PointerEvent>window.event).pointerType === "touch";
            if (wasTouch) {
                document.getSelection().removeAllRanges();
            } else if (!document.getSelection().isCollapsed) {
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