module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    function executeMatchingCommand(commands: ICommandOptions[], ev: KeyboardEvent): boolean {
        let foundCommand: ICommandOptions;
        commands.some((command) => {
            if (ev.keyCode !== command.keyCode) {
                return false;
            }

            foundCommand = command;
            return true;
        });

        if (!foundCommand) {
            return false;
        }

        foundCommand.onclick(ev);
        return true;
    }

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _emptyStateListeners: Codevoid.Utilities.ICancellable;
        private _folderNameElement: HTMLElement;
        private _headerCommandsContainer: HTMLElement;
        private _contentContainer: HTMLDivElement;
        private _articleTemplate: WinJS.Binding.Template;
        private _imageArticleTemplate: WinJS.Binding.Template;
        private _progressTemplate: WinJS.Binding.Template;
        private _whatsNewTemplate: WinJS.Binding.Template;
        private _contentList: WinJS.UI.ListView<any>;
        private _emptyStateContainer: HTMLDivElement;
        private _splitToggle: WinJS.UI.SplitViewPaneToggle;
        private _splitView: WinJS.UI.SplitView;
        private _selectModeToggle: WinJS.UI.Command;
        private _folderList: WinJS.UI.Repeater;
        private _sorts: WinJS.UI.Repeater;
        private _sortsElement: HTMLSelectElement;
        private _toolBarContainer: HTMLDivElement;
        private _notificationContainer: HTMLDivElement;
        private _toolBar: WinJS.UI.ToolBar;
        private _inSelectionMode: boolean = false;
        private viewModel: SignedInViewModel;
        private _menu: WinJS.UI.Menu;
        private _wasTouchHeld: boolean = false;
        private _contentHasItems: boolean = true;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.SignedInExperience");

            WinJS.UI.processAll(element).done(() => {
                this._initialize();
            });
        }

        private _initialize(): void {
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this._splitToggle.splitView = this._splitView.element;

            this._handlersToCleanup.push(Utilities.addEventListeners(this.viewModel.events, {
                folderchanging: () => {
                    this._clearEmptyStateListeners();
                    this._contentList.itemDataSource = null;
                },
                folderchanged: (e: Utilities.EventObject<IFolderDetails>) => {
                    this._renderFolderDetails(e.detail);
                },
                foldertitleupdated: (e: Utilities.EventObject<IFolder>) => {
                    this._folderNameElement.textContent = e.detail.title;
                },
                sortchanged: (e: Utilities.EventObject<SortOption>) => {
                    this._sortsElement.value = e.detail.toString();
                },
                syncstarting: (e: Utilities.EventObject<{ message: string, cancel: () => void }>) => {
                    this._showSyncProgress(e.detail.message, e.detail.cancel);
                },
                synccompleted: () => {
                    this._hideSyncProgress();
                },
                signedout: () => {
                    this._signOutRequested();
                },
                commandInvoked: () => {
                    this._exitSelectionMode();
                },
                articleclosed: () => {
                    this._contentList.element.focus();
                },
                uipresented: () => {
                    // Delay the focus to give the list a chance to render
                    setTimeout(() => {
                        // Ensure the first item in the list gets focus.
                        const documentBodyFocused = (document.body === document.activeElement);
                        this._contentList.currentItem = { index: 0, hasFocus: documentBodyFocused };
                    }, 500);
                }
            }));

            const titleBarSpacerHelper = TitleBarSpaceHelper.getInstance();
            this._handlersToCleanup.push(Utilities.addEventListeners(titleBarSpacerHelper, {
                spacerrequiredchanged: this._handleSpacerRequired.bind(this),
            }));

            this._handleSpacerRequired({ detail: titleBarSpacerHelper.spacerRequired });

            var firstTimeAnimation = Utilities.addEventListeners(this._contentList, {
                contentanimating: (eventObject) => {
                    if (eventObject.detail.type === "entrance") {
                        eventObject.preventDefault();
                        firstTimeAnimation.cancel();
                    }
                }
            });

            this._handlersToCleanup.push(Utilities.addEventListeners(this._contentList, {
                keyboardnavigating: (e: Utilities.EventObject<{ oldFocus: number; newFocus: number }>) => {
                    Sharing.instance.bookmarkToShare = null;
                    this._contentList.itemDataSource.itemFromIndex(e.detail.newFocus).then((item) => {
                        Sharing.instance.bookmarkToShare = item.data;
                    });
                }
            }));

            this._sorts.data = new WinJS.Binding.List(SignedInViewModel.sorts);
            this._sortsElement = <HTMLSelectElement>this._sorts.element;
            this._sortsElement.selectedIndex = 0;

            this._handlersToCleanup.push(Utilities.addEventListeners(window, {
                resize: this._handleSizeChange.bind(this),
            }));

            this._handleSizeChange();

            this.viewModel.readyForEvents();

            this._handlersToCleanup.push(Utilities.addEventListeners(this.element, {
                keydown: this._handleKeyboardInput.bind(this),
            }));
        }

        private _handleSizeChange() {
            var layout = {
                type: null,
                orientation: 'Vertical',
            }

            if (window.innerWidth > 550) {
                layout.type = WinJS.UI.GridLayout;
            } else {
                layout.type = WinJS.UI.ListLayout;
            }

            if ((this._contentList.layout.orientation === layout.orientation)
                && (this._contentList.layout instanceof layout.type)) {
                return;
            }

            this._contentList.layout = <any>layout;
        }

        private _handleKeyboardInput(e: KeyboardEvent): void {
            let handled = false;

            switch (e.keyCode) {
                case WinJS.Utilities.Key.F5:
                    Telemetry.instance.track("ManualSync", null);
                    handled = true;
                    this.startSync();
                    break;

                case WinJS.Utilities.Key.o:
                    if (!e.ctrlKey) {
                        break;
                    }

                    handled = true;
                    Telemetry.instance.track("ManualSortsFocus", null);
                    this._sortsElement.focus();
                    break;

                case WinJS.Utilities.Key.graveAccent:
                    if (!e.ctrlKey) {
                        break;
                    }

                    handled = true;
                    if (this._splitView.paneOpened) {
                        Telemetry.instance.track("KeyboardCloseBurger", null);
                        this._splitView.closePane();
                    } else {
                        Telemetry.instance.track("KeyboardOpenBurger", null);
                        this._splitView.openPane();
                    }
                    break;
            }

            if (!handled && this._contentList.element.contains(document.activeElement)) {
                let commands: ICommandOptions[] = [];
                if (this._inSelectionMode && this._toolBar && this._toolBar.data && this._toolBar.data.length) {
                    // If we're in selection mode, and our toolbar has some commands, we can assume we already
                    // have some computed commands, so we don't need to calculate them again (hack!). The data
                    // types are a little off, but if we force a cast, it matches for our needs
                    commands = <ICommandOptions[]>(<any>this._toolBar.data);
                } else if (this._contentList.currentItem.hasFocus) {
                    // Not in selection mode/no toolbar, but our current item has focus, we can operate on that
                    const bookmarksToOperateOn = [this.viewModel.getBookmarkAtIndex(this._contentList.currentItem.index)];
                    commands = this.viewModel.getCommandInformationForBookmarks(bookmarksToOperateOn);
                }

                // If there were any commands, try to execute it.
                if (commands.length) {
                    handled = executeMatchingCommand(commands, e);
                }
            }

            if (handled) {
                Telemetry.instance.track("ArticleListCommandInvokedWithKeyboard", null);
                e.preventDefault();
            }
        }

        private _handleSpacerRequired(required: Utilities.EventObject<TitleBarSpacerRequired>): void {
            switch (required.detail) {
                case TitleBarSpacerRequired.Yes:
                    WinJS.Utilities.removeClass(document.body, "noTitleSpacer");
                    break;

                case TitleBarSpacerRequired.No:
                    WinJS.Utilities.addClass(document.body, "noTitleSpacer");
                    break;
            }
        }

        public handleSortsChanged(e: UIEvent) {
            var rawSortOption = parseInt(this._sortsElement.value);
            this.viewModel.changeSortTo(<SortOption>rawSortOption);
        }

        public splitViewOpening() {
            WinJS.Utilities.addClass(this._splitToggle.element, "splitView-open");
            this.viewModel.listFolders().done((folders: IFolder[]) => {
                this._folderList.data = new WinJS.Binding.List(folders);
            });
        }

        public splitViewClosing() {
            WinJS.Utilities.removeClass(this._splitToggle.element, "splitView-open");
        }

        public signOut(): void {
            const confirmSignoutDialog = new Windows.UI.Popups.MessageDialog(
                "When you sign out, everything you've downloaded will be removed, and you'll need to sign in again to use the app again. Your data will still be in your Instapaper account at instapaper.com",
                "Are you sure?");

            confirmSignoutDialog.commands.clear();

            const signoutCommand = new Windows.UI.Popups.UICommand("Signout");
            signoutCommand.id = "signout";

            const staySignedInCommand = new Windows.UI.Popups.UICommand("Stay signed in");
            staySignedInCommand.id = "staySignedIn";

            confirmSignoutDialog.commands.append(signoutCommand);
            confirmSignoutDialog.commands.append(staySignedInCommand);


            confirmSignoutDialog.showAsync().done((command) => {
                if (command.id != "signout") {
                    return;
                }

                this.viewModel.signOut(true/*clearCredentials*/).done(null);
            });
        }

        public menuInvoked(e: PointerEvent): void {
            let elementPosition: { x: number, y: number } = { x: e.x, y: e.y };

            // When invoked via keyboard, theres no position information.
            // However, we can guess it by getting the position of the focused
            // element, and using that to generate the position information.
            if (!e.pointerType) {
                if (!document.activeElement) {
                    return;
                }

                const boundingRect = document.activeElement.getBoundingClientRect();
                elementPosition = {
                    x: boundingRect.left + (boundingRect.width / 2),
                    y: boundingRect.top + (boundingRect.height / 2)
                };
            }

            let data: IBookmark;
            // Grab the element under the touch / pointer event
            let currentElement = document.elementFromPoint(elementPosition.x, elementPosition.y);

            // Dumpster drive between element under the pointer, until we hit
            // where the handler is attached, looking for the data on each element
            while (currentElement != e.currentTarget) {
                data = (<any>currentElement).__articleContext;
                if (data) {
                    // This element contained the data, so theres no need to search
                    // any more elements.
                    break;
                }

                currentElement = currentElement.parentElement;
            }

            if (!data) {
                return;
            }

            // Now we've got some commands, show them to the user
            var commands = this.viewModel.getCommandInformationForBookmarks([data]);
            Sharing.instance.bookmarkToShare = data;
            this._menu.commands = <any[]>commands;
            this._menu.showAt(elementPosition);
            Telemetry.instance.track("ContextMenuShown", null);

            // Set the transform of the listview 'content' (E.g. inside the scroller)
            // to be zoomed out a little for a nice effect there is a menu open
            (<HTMLElement>this._contentList.element.querySelector(".win-surface")).style.transform = "scale(0.97)";
        }

        public menuClosing(): void {
            // When the menu closes, reset any transform on the content so it scales back
            // to it's normal size.
            (<HTMLElement>this._contentList.element.querySelector(".win-surface")).style.transform = "";
        }

        public holdVisualTriggered(e: MouseEvent): void {
            // MSHoldVisual is an event raised when a *touch* is held long enough
            // but before the context menu or pointer event. This gives us a chance to
            // flag state so that when the pointerup event raises the ListView's
            // itemInvoked event immediately before the contextMenu event, we dont
            // go and open the article.
            this._wasTouchHeld = true;
        }

        private _signOutRequested() {
            this._exitSelectionMode();

            this._folderList.data = null;
            this._splitView.closePane();
            this._clearEmptyStateListeners();
            this._contentList.itemDataSource = null;
        }

        public showSettings(): void {
            this.viewModel.showSettings();
            this._splitView.closePane();
        }

        public showFeedbackHub(): void {
            var launcher = Microsoft.Services.Store.Engagement.StoreServicesFeedbackLauncher.getDefault();
            launcher.launchAsync().done(() => { }, () => { });
        }

        public _renderFolderDetails(folderDetails: IFolderDetails): void {
            Utilities.Logging.instance.log("Bookmarks for: " + folderDetails.folder.folder_id);

            this._exitSelectionMode();

            this._folderNameElement.textContent = folderDetails.folder.title;

            this._headerCommandsContainer.classList.toggle("header-in-home-folder", (folderDetails.folder.folder_id === Codevoid.Storyvoid.InstapaperDB.CommonFolderIds.Unread));

            this._clearEmptyStateListeners();

            // Set the item template before you set the data source
            this._contentList.itemTemplate = this._renderItem.bind(this);
            this._contentList.itemDataSource = folderDetails.bookmarks.dataSource;

            this._emptyStateListeners = Utilities.addEventListeners(<any>folderDetails.bookmarks, {
                itemremoved: () => {
                    this._contentList.itemDataSource.getCount().done(this._updateEmptyStateBasedOnBookmarkCount.bind(this));
                },
                iteminserted: () => {
                    this._contentList.itemDataSource.getCount().done(this._updateEmptyStateBasedOnBookmarkCount.bind(this));
                }
            });

            this._contentList.itemDataSource.getCount().done((count) => {
                this._updateEmptyStateBasedOnBookmarkCount(count);
            });
        }

        private _clearEmptyStateListeners(): void {
            if (!this._emptyStateListeners) {
                return;
            }

            this._emptyStateListeners.cancel();
            this._emptyStateListeners = null;
        }

        private _updateEmptyStateBasedOnBookmarkCount(numberOfBookmarks: number): void {
            var nowHasBookmarks = numberOfBookmarks > 0;
            var previouslyHadBookmarks = this._contentHasItems;

            if (this._emptyStateContainer.firstElementChild) {
                Utilities.DOM.removeChild(this._emptyStateContainer, <HTMLElement>this._emptyStateContainer.firstElementChild);
            }

            if (nowHasBookmarks && !previouslyHadBookmarks) {
                this._contentHasItems = true;
                WinJS.Utilities.removeClass(this._contentList.element, "hide");
                WinJS.Utilities.addClass(this._emptyStateContainer, "hide");
            } else if (!nowHasBookmarks) {
                this._contentHasItems = false;

                WinJS.Utilities.addClass(this._contentList.element, "hide");
                WinJS.Utilities.removeClass(this._emptyStateContainer, "hide");

                Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "emptyState").done((template) => {
                    template.render({ folder_id: this.viewModel.currentFolderId }, this._emptyStateContainer);
                });
            }
        }

        private _showSyncProgress(initialMessage: string, cancelCallback: () => void): WinJS.Promise<void> {
            var headerContainer = document.createElement("div");
            var syncProgress = new SyncProgressControl(headerContainer, {
                initialMessage: initialMessage,
                template: this._progressTemplate,
                eventSource: this.viewModel.events,
                cancelCallback: cancelCallback
            });

            if (this._notificationBeingDisplayed()) {
                this._switchNotificationElement(headerContainer);
                return WinJS.Promise.as();
            }

            return this._addNotificationElement(headerContainer);
        }

        private _hideSyncProgress(): void {
            WinJS.Promise.timeout(2 * 1000).done(() => {
                Codevoid.Utilities.DOM.disposeOfControl(this._notificationContainer.firstElementChild);

                if (!this.viewModel.shouldShowWhatsNew()) {
                    this._removeNotificationElement(this._notificationContainer.firstElementChild);
                } else {
                    this._showWhatsNewBanner();
                }
            });
        }

        private _notificationBeingDisplayed(): boolean {
            return (this._notificationContainer.childElementCount > 0);
        }

        private _showWhatsNewBanner(): void {
            const whatsNewControl = new WhatsNewControl(document.createElement("div"), {
                template: this._whatsNewTemplate,
                initialMessage: this.viewModel.getWhatsNewMessage(),
                cancelCallback: () => {
                    this._removeNotificationElement(whatsNewControl.element);
                }
            });

            this._switchNotificationElement(whatsNewControl.element);
        }

        private _addNotificationElement(element: HTMLElement): WinJS.Promise<void> {
            const signal = new Utilities.Signal();

            this._notificationContainer.appendChild(element);
            let height = this._notificationContainer.clientHeight;

            var animHandler = Utilities.addEventListeners(this._contentContainer, {
                transitionend: (e: TransitionEvent) => {
                    // We'll see other bubbling events from other transitions
                    // make sure we're only handling the one WE started.
                    if (e.target != this._contentContainer) {
                        return;
                    }

                    animHandler.cancel();

                    WinJS.Utilities.addClass(this._contentContainer, "notification-visible");
                    WinJS.Utilities.removeClass(this._contentContainer, "notification-animation");
                    WinJS.Utilities.removeClass(this._notificationContainer, "notification-animation");
                    this._contentContainer.style.transform = "";
                    signal.complete();
                }
            });

            this._notificationContainer.style.transform = `translateY(-${height}px)`;

            WinJS.Promise.timeout().done(() => {
                WinJS.Utilities.addClass(this._contentContainer, "notification-animation");
                WinJS.Utilities.addClass(this._notificationContainer, "notification-animation");
                this._contentContainer.style.transform = `translateY(${height}px)`;
                this._notificationContainer.style.transform = "translateY(0px)";
            });

            return signal.promise;
        }

        private _switchNotificationElement(element: Element): void {
            const currentElement = this._notificationContainer.firstElementChild;
            Codevoid.Utilities.DOM.disposeOfControl(this._notificationContainer.firstElementChild);
            this._notificationContainer.removeChild(currentElement);

            this._notificationContainer.appendChild(element);
        }

        private _removeNotificationElement(element: Element): WinJS.Promise<void> {
            const signal = new Utilities.Signal();

            let height = this._notificationContainer.clientHeight;
            var animHandler = Utilities.addEventListeners(this._contentContainer, {
                transitionend: (e: TransitionEvent) => {
                    // We'll see other bubbling events from other transitions
                    // make sure we're only handling the one WE started.
                    if (e.target != this._contentContainer) {
                        return;
                    }

                    animHandler.cancel();

                    WinJS.Utilities.removeClass(this._contentContainer, "notification-animation");
                    WinJS.Utilities.removeClass(this._notificationContainer, "notification-animation");
                    WinJS.Utilities.removeClass(this._contentContainer, "notification-visible");
                    this._contentContainer.style.transform = "";
                    this._notificationContainer.style.transform = "";

                    this._notificationContainer.removeChild(element);

                    signal.complete();
                }
            });

            WinJS.Utilities.addClass(this._contentContainer, "notification-animation");
            WinJS.Utilities.addClass(this._notificationContainer, "notification-animation");
            this._notificationContainer.style.transform = `translateY(-${height}px)`;
            this._contentContainer.style.transform = `translateY(-${height}px)`;

            return signal.promise;
        }
        
        public startSync(): void {
            this._splitView.closePane();
            this.viewModel.startSync(SyncReason.Explicit);
        }

        public goToHomeFolder(): void {
            this.viewModel.switchCurrentFolderTo(this.viewModel.commonFolderDbIds.unread);
        }

        public folderClicked(e: any): void {
            var button: UI.SplitViewCommandWithData = e.target.winControl;
            this.viewModel.switchCurrentFolderTo(button.dataContext.id);

            this._splitView.closePane();
        }

        public itemsRendered(e: any): void {
            this._folderList.data.forEach((item: IFolder, index: number) => {
                if (item.id != this.viewModel.currentFolderDbId) {
                    return;
                }

                // Highlight the item
                var container = this._folderList.elementFromIndex(index);
                WinJS.Utilities.addClass(container, "folderlist-current");
            });
        }

        public splitViewOpened(): void {
            this._folderList.data.forEach((item: IFolder, index: number) => {
                if (item.id != this.viewModel.currentFolderDbId) {
                    return;
                }

                var container = this._folderList.elementFromIndex(index);

                // Find the current element, and focus it
                var focusTarget = <HTMLElement>container.querySelector("[role='button']");
                focusTarget.focus();
            });
        }

        public contentListSelectionChanged(e: UIEvent): void {
            if (this._contentList.selection.count() > 0) {
                this._contentList.selection.getItems().then((items: WinJS.UI.IItem<IBookmark>[]) => {
                    var bookmarks = items.map((item: WinJS.UI.IItem<IBookmark>) => item.data);
                    var commands = this.viewModel.getCommandsForSelection(bookmarks);
                    this._updateToolbarFor(commands);
                });
            } else {
                this._removeToolBar();
            }
        }

        public listItemInvoked(e: UIEvent): void {
            // If the touch had been held, then we want to drop
            // this invokation and let the context menu open
            if (this._wasTouchHeld) {
                this._wasTouchHeld = false;
                return;
            }

            (<any>e.detail).itemPromise.then((item: WinJS.UI.IItem<IBookmark>) => {
                this.viewModel.showArticle(item.data, false/*restoring*/);
            });
        }

        public toggleSelectionMode(): void {
            if (!this._inSelectionMode) {
                this._contentList.selectionMode = WinJS.UI.SelectionMode.multi;
                this._contentList.tapBehavior = WinJS.UI.TapBehavior.toggleSelect;
                this._selectModeToggle.icon = "cancel";

                const currentTooltip = this._selectModeToggle.tooltip;
                this._selectModeToggle.tooltip = (<any>this._selectModeToggle).alternativeToolTip;
                (<any>this._selectModeToggle).alternativeToolTip = currentTooltip;
                this._inSelectionMode = true;

                WinJS.Utilities.addClass(this._headerCommandsContainer, "header-inSelectionMode");
            } else {
                this._exitSelectionMode();
            }
        }

        private _renderItem(itemPromise: WinJS.Promise<WinJS.UI.IItem<IBookmark>>): { element: HTMLElement, renderComplete: WinJS.Promise<any> } {
            var element = document.createElement("div");
            return {
                element: element,
                renderComplete: itemPromise.then((item) => {
                    // Default to the article template, but if the article has images,
                    // then use the iamge template instead.
                    var renderer = this._articleTemplate;
                    if (item.data.hasImages) {
                        renderer = this._imageArticleTemplate;
                    }

                    return renderer.render(item.data, element);
                }),
            };
        }

        private _exitSelectionMode(): void {
            if (!this._inSelectionMode) {
                return;
            }

            this._contentList.selection.clear();
            this._contentList.selectionMode = WinJS.UI.SelectionMode.none;
            this._contentList.tapBehavior = WinJS.UI.TapBehavior.invokeOnly;
            this._removeToolBar();

            this._selectModeToggle.icon = "bullets";

            const currentTooltip = this._selectModeToggle.tooltip;
            this._selectModeToggle.tooltip = (<any>this._selectModeToggle).alternativeToolTip;
            (<any>this._selectModeToggle).alternativeToolTip = currentTooltip;

            WinJS.Utilities.removeClass(this._headerCommandsContainer, "header-inSelectionMode");

            this._inSelectionMode = false;
        }

        private _updateToolbarFor(commands: WinJS.UI.ICommand[]): void {
            var commandList = new WinJS.Binding.List(commands);
            // If we've already constructed the toolbar,
            // theres no need to construct it again
            if (this._toolBar) {
                this._toolBar.data = commandList
                return;
            }

            // Construct the toolbar element and add it to the tree
            var toolBarElement = document.createElement("div");
            toolBarElement.setAttribute("data-win-control", "WinJS.UI.ToolBar");
            this._toolBarContainer.appendChild(toolBarElement);

            // Construct the actual toolbar, and assign it's command
            this._toolBar = new WinJS.UI.ToolBar(toolBarElement);
            this._toolBar.data = commandList;
        }

        private _removeToolBar(): void {
            if (!this._toolBar) {
                return;
            }

            // Remove the toolbar by clearing it's state
            // and disposing of it's UI elements
            this._toolBar = null;
            WinJS.Utilities.disposeSubTree(this._toolBarContainer);
            this._toolBarContainer.textContent = "";
        }

        public clearDb(): void {
            this.viewModel.clearDb().done(() => {
                Utilities.Logging.instance.log("Cleared DB"); 
            });
        }
        
        static folderIdToIcon: any;
        static restrictProgressTo5PercentOrMore: any;
        static showTitleOrUrl: any;
        static showDescriptionOrExtractedDescription: any;
        static createCssUrlPath: any;
        static extractDomainFromUrl: any;
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewClosing);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewOpening);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewOpened);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.menuInvoked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.menuClosing);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.holdVisualTriggered);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showSettings);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showFeedbackHub);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.goToHomeFolder);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.folderClicked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.itemsRendered);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.contentListSelectionChanged);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.listItemInvoked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.toggleSelectionMode);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.handleSortsChanged);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);

    SignedInExperience.folderIdToIcon = WinJS.Binding.converter((folder: string) => {
        var result = "\uE8B7"; // hollow folder icon

        switch (folder) {
            case InstapaperDB.CommonFolderIds.Archive:
                result = "\uE7B8";
                break;

            case InstapaperDB.CommonFolderIds.Liked:
                result = "\uE006";
                break;

            case InstapaperDB.CommonFolderIds.Unread:
                result = "\uE80F";
                break;

            default:
                break;
        }

        return result;
    });

    SignedInExperience.restrictProgressTo5PercentOrMore = WinJS.Binding.converter((progress: number) => {
        if (progress > 0.049) {
            return progress;
        }

        return 0;
    });

    SignedInExperience.showTitleOrUrl = WinJS.Binding.converter((bookmark: IBookmark) => {
        return (bookmark.title || bookmark.url);
    });

    SignedInExperience.showDescriptionOrExtractedDescription = WinJS.Binding.converter((bookmark: IBookmark) => {
        if (bookmark.articleUnavailable) {
            return "Unable to download";
        }

        return (bookmark.description || bookmark.extractedDescription || "");
    });

    SignedInExperience.createCssUrlPath = WinJS.Binding.converter((imageUrl: string) => {
        return "url(" + imageUrl + ")";
    });

    SignedInExperience.extractDomainFromUrl = WinJS.Binding.converter((url: string) => {
        // RegEx from:
        // https://regex101.com/r/wN6cZ7/63
        var regEx = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/igm
        var matches = regEx.exec(url);

        return matches[1];
    });
}