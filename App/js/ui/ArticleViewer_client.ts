/// <reference path="..\..\OverlayScrollbars\OverlayScrollbars.d.ts" />
module Codevoid.Storyvoid.UI {
    const KEY_PLUS = 187;
    const KEY_MINUS = 189;
    const KEY_ESCAPE = 27;
    const KEY_ALT = 18;

    const ARTICLE_WIDTH_PX = 1000;
    const MIN_SIZE_FOR_IMAGE_STRETCHING = 400;
    const TOOLBAR_UNDERLAY_CLASS = "articleViewer-toolbar-underlay";
    const ELEMENT_MANAGES_WIDTH = "articleViewer-manages-own-width";
    const CONTAINED_ELEMENT_CLASS = "articleViewer-contained";
    const HEADER_ANIMATION_CLASS = "articleViewer-header-animate";
    const HEADER_FORCE_STICKY_CLASS = "articleViewer-header-container-sticky";

    class ArticleViewer_client {
        private _scrollingElement: HTMLElement;
        private _contentElement: HTMLElement;
        // Underlay for the toolbar is primarily for the compact size so that
        // the bottom-toolbar has the underlay in the right place at the right time.
        private _toolbarUnderlay: HTMLElement;
        private _headerContainer: HTMLElement;
        private _currentHeaderContainerHeight: number = 0;
        private _currentImageWidthForImageSizing = 0;
        private _keyDownMap: { [key: number]: boolean } = {};
        private _hadFocus = false;
        private _hadSelection = false;
        private _firstToolbarStateChangeSeen = false;
        private _intersectionObserver: IntersectionObserver;
        private _customScrollbars: OverlayScrollbarsClass;
        private _currentTheme: string;

        public initialize(): void {
            this._customScrollbars = OverlayScrollbars(document.body, {
                scrollbars: {
                    autoHide: "move"
                }
            });

            this._scrollingElement = this._customScrollbars.getElements().viewport;
            this._contentElement = this._customScrollbars.getElements().content;
            this._contentElement.classList.add("scrollingElement");

            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("restorescroll", this._restoreScroll.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("inserttitle", this._insertTitle.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("setbodycssproperty", this._setBodyCssProperty.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("setcontentcssproperty", this._setContentCssProperty.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("refreshimagewidths", this._refreshImageWidths.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("settheme", this._setTheme.bind(this));
            Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("settoolbarstate", this._setToolbarState.bind(this));

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
            this._scrollingElement.addEventListener("scroll", this._handleScroll.bind(this));
        }

        private _insertTitle(data: { title: string, domain: string, url: string }): void {
            var headerContainer = this._headerContainer = document.createElement("div");
            headerContainer.classList.add("articleViewer-header-container");
            headerContainer.classList.add(ELEMENT_MANAGES_WIDTH);

            var wrapper = <HTMLElement>headerContainer.appendChild(document.createElement("div"));
            wrapper.classList.add(CONTAINED_ELEMENT_CLASS);

            var title = <HTMLElement>wrapper.appendChild(document.createElement("div"));
            title.className = "articleViewer-title";
            title.textContent = data.title;

            var subTitle = <HTMLAnchorElement>wrapper.appendChild(document.createElement("a"));
            subTitle.className = "articleViewer-subTitle";
            subTitle.textContent = data.domain;
            subTitle.href = data.url;

            this._scrollingElement.insertBefore(headerContainer, this._scrollingElement.firstChild);

            // Make sure that the document is 'scaled' at the device
            // width. Without this, the scale is all kinds of weird,
            // and some of the elements font size is not scaled by the
            // device scale factor. This ensures they are.
            var meta = document.createElement("meta");
            meta.name = "viewport";
            meta.content = "width=device-width";

            document.head.appendChild(meta);

            var observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => this._handleIntersectionChanged(entries), {
                rootMargin: "28px"
            });
            observer.observe(this._headerContainer);

            this._intersectionObserver = observer;
            setTimeout(() => this._updateHeaderContainerHeight(), 0);
        }

        private _handleIntersectionChanged(entries: IntersectionObserverEntry[]): void {
            // Assume only one intersection entry
            var entry = entries[0];
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("headervisibilitychange", entry.isIntersecting);
        }

        private _setBodyCssProperty(propertyToSet: { property: string, value: string }): void {
            document.body.style[propertyToSet.property] = propertyToSet.value;
        }

        private _setContentCssProperty(propertyToSet: { property: string, value: string }): void {
            var contentElements = Array.prototype.filter.call(this._contentElement.children, (item: HTMLElement) => {
                return !item.classList.contains(ELEMENT_MANAGES_WIDTH);
            });
            contentElements = contentElements.concat(Array.prototype.slice.call(this._contentElement.querySelectorAll(`.${CONTAINED_ELEMENT_CLASS}`)));

            // Since we're adjusting the content properties, we need
            // to go over all the found elements, and stomp the property on them.
            for (var i = 0; i < contentElements.length; i++) {
                (<HTMLElement>contentElements[i]).style[propertyToSet.property] = propertyToSet.value;
            }
        }

        private _setImgCssProperty(propertyToSet: { property: string, value: string }): void {
            var images = this._contentElement.querySelectorAll("img");
            var currentImage: HTMLImageElement;

            for (var i = 0; i < images.length; i++) {
                currentImage = (<HTMLImageElement>images.item(i));

                // Images that are small probably don't want to be fiddled with,
                // so based on some arbitary size, screw it.
                // Note that sometimes naturalWidth is isn't correctly handled by Edge
                // so we check for clientwidth and natural width.
                if (currentImage.clientWidth < MIN_SIZE_FOR_IMAGE_STRETCHING && currentImage.naturalWidth < MIN_SIZE_FOR_IMAGE_STRETCHING) {
                    continue;
                }

                currentImage.style[propertyToSet.property] = propertyToSet.value;
            }
        }

        private _setTheme(theme: string): void {
            let themeClass = "theme-" + theme;
            let overlayScrollbarClass = "os-theme-dark";

            switch (theme.toLowerCase()) {
                case "night":
                case "dusk":
                    overlayScrollbarClass = "os-theme-light";
                    break;
            }

            if (this._currentTheme) {
                document.body.classList.remove(this._currentTheme);
            }

            document.body.classList.add(themeClass);
            this._currentTheme = themeClass;
            this._customScrollbars.options("className", overlayScrollbarClass);
        }

        private _setToolbarState(toolbarIsVisible: boolean): void {
            if (!toolbarIsVisible && this._toolbarUnderlay) {
                this._hideToolbar();
            } else if (toolbarIsVisible && !this._toolbarUnderlay) {
                this._showToolbar();
            }

            this._firstToolbarStateChangeSeen = true;
        }

        private _hideToolbar(): void {
            // Listen for the end of the transition to actually remove
            // the element, rather rather than relying on a timer.
            var self = this;
            var transitionCompleteHandler = function (e: TransitionEvent) {
                if (e.srcElement !== self._toolbarUnderlay || e.propertyName !== "transform") {
                    return;
                }

                // Clean up the toolbar underlay
                self._toolbarUnderlay.removeEventListener("transitionend", transitionCompleteHandler);
                self._toolbarUnderlay.parentElement.removeChild(self._toolbarUnderlay);
                self._toolbarUnderlay = null;

                // Clean up te title -- stop it being sticky, stop it animating, and move it
                // to the natural position.
                self._headerContainer.classList.toggle(HEADER_FORCE_STICKY_CLASS, false);
                self._headerContainer.classList.toggle(HEADER_ANIMATION_CLASS, false)
                self._headerContainer.style.transform = "";
            };

            // Use the toolbarUnderlay here since it's always moving
            // even in the compact size case.
            this._toolbarUnderlay.addEventListener("transitionend", transitionCompleteHandler);

            // Grab the ambient CSS transition property, and if it's not going to do anything
            // then we don't want to transform it -- a bit of an implementation detail, but
            // none the less we're going to take advantage of that knowledge here.
            if (window.getComputedStyle(<Element>this._headerContainer).transitionProperty != "none") {
                // Calculate the delta from where we currently are to where we want to be
                // when the header is at "rest" and scrolled
                var headerHeight = this._headerContainer.clientHeight;
                if (this._scrollingElement.scrollTop < headerHeight) {
                    headerHeight = this._scrollingElement.scrollTop;
                }

                this._headerContainer.style.transform = `translateY(-${headerHeight}px)`;
            }

            // Start the transition to hide the toolbar
            this._toolbarUnderlay.style.transform = "";
        }

        private _showToolbar(): void {
            var toolbarUnderlay = document.createElement("div");
            toolbarUnderlay.classList.add(TOOLBAR_UNDERLAY_CLASS);
            toolbarUnderlay.classList.add(ELEMENT_MANAGES_WIDTH);
            toolbarUnderlay.classList.add(HEADER_ANIMATION_CLASS);

            this._contentElement.insertBefore(toolbarUnderlay, this._contentElement.firstElementChild);
            this._toolbarUnderlay = toolbarUnderlay;

            if (this._firstToolbarStateChangeSeen) {
                // I greatly dislike the web sometimes.
                // The transform below gets applied, and 80% of the time, it animates.
                // But sometimes -- just sometimes -- it doesn't. It just shows.
                // So, force a layout by... calling clientHeight? (Thanks, The Web)
                // Which makes things to the "right thing"
                toolbarUnderlay.clientHeight;
                this._headerContainer.clientHeight;
            }

            // Calculate where the header needs to animate "from". We don't want to
            // show the antimation to this position, so we carefully calculate it...
            var headerHeight = this._headerContainer.clientHeight;
            if (this._scrollingElement.scrollTop < headerHeight) {
                headerHeight = this._scrollingElement.scrollTop;
            }

            // ... set it
            this._headerContainer.style.transform = `translateY(-${headerHeight}px)`;

            // ... force a layout pass so it's now in a good position
            this._headerContainer.clientHeight;

            // THEN we start the animation
            this._headerContainer.classList.toggle(HEADER_ANIMATION_CLASS, true);
            
            toolbarUnderlay.style.transform = "translateY(0)";
            this._headerContainer.style.transform = "translateY(0)";
            this._headerContainer.classList.toggle(HEADER_FORCE_STICKY_CLASS, true)
        }

        private _handleResize(): void {
            this._refreshImageWidths(this._currentImageWidthForImageSizing);
            this._updateHeaderContainerHeight();
        }

        private _updateHeaderContainerHeight(): void {
            if (!this._headerContainer) {
                return;
            }

            const headerContainerHeight = this._headerContainer.clientHeight;
            if (headerContainerHeight === this._currentHeaderContainerHeight) {
                return;
            }

            this._currentHeaderContainerHeight = headerContainerHeight;
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("headerheightchanged", headerContainerHeight);
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

            // If the window is smaller than our max article size
            // we need to set the margin to be negative to pull the item
            // outside of it's original layout and make it look prettier
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
                this._hadSelection = true; // We currently have selection
                return;
            } else if (document.getSelection().isCollapsed && this._hadSelection) {
                // ... and now we don't have one, but we did, so we
                // don't want to toggle the toolbar.
                this._hadSelection = false;
                return;
            }

            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("toggletoolbar", null);
        }

        private _dismiss(): void {
            Codevoid.Utilities.WebViewMessenger_Client.Instance.sendMessage("dismiss", null);
            this._intersectionObserver.unobserve(this._headerContainer);
        }
    }

    var client = new ArticleViewer_client();
    client.initialize();
}