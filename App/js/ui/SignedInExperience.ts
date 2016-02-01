module Codevoid.ArticleVoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    export class SignedInExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private _folderNameElement: HTMLElement;
        private _articleTemplate: WinJS.Binding.Template;
        private _imageArticleTemplate: WinJS.Binding.Template;
        private _progressTemplate: WinJS.Binding.Template;
        private _contentList: WinJS.UI.ListView<any>;
        private _splitToggle: WinJS.UI.SplitViewPaneToggle;
        private _splitView: WinJS.UI.SplitView;
        private _selectModeToggle: WinJS.UI.Command;
        private _folderList: WinJS.UI.Repeater;
        private _sorts: WinJS.UI.Repeater;
        private _sortsElement: HTMLSelectElement;
        private _toolBarContainer: HTMLDivElement;
        private _toolBar: WinJS.UI.ToolBar;
        private _inSelectionMode: boolean = false;
        private viewModel: SignedInViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.SignedInExperience");

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
                    this._contentList.itemDataSource = null;
                },
                folderchanged: (e: { detail: IFolderDetails }) => {
                    this._renderFolderDetails(e.detail);
                },
                foldertitleupdated: (e: { detail: IFolder }) => {
                    this._folderNameElement.textContent = e.detail.title;
                },
                sortchanged: (e: { detail: SortOption }) => {
                    this._sortsElement.value = e.detail.toString();
                },
                syncstarting: (e: { detail: { message: string } }) => {
                    this._createProgressHeader(e.detail.message);
                },
            }));

            var firstTimeAnimation = Utilities.addEventListeners(this._contentList, {
                contentanimating: (eventObject) => {
                    if (eventObject.detail.type === "entrance") {
                        eventObject.preventDefault();
                        firstTimeAnimation.cancel();
                    }
                }
            });

            this._sorts.data = new WinJS.Binding.List(SignedInViewModel.sorts);
            this._sortsElement = <HTMLSelectElement>this._sorts.element;
            this._sortsElement.selectedIndex = 0;

            this.viewModel.readyForEvents();
        }

        public handleSortsChanged(e: UIEvent) {
            var rawSortOption = parseInt(this._sortsElement.value);
            this.viewModel.changeSortTo(<SortOption>rawSortOption);
        }

        public splitViewOpening() {
            this.viewModel.listFolders().done((folders: IFolder[]) => {
                this._folderList.data = new WinJS.Binding.List(folders);
            });
        }

        public signOut(): void {
            this._exitSelectionMode();

            this._folderList.data = null;
            this._splitView.closePane();
            this._contentList.itemDataSource = null;
            this.viewModel.signOut();
        }

        public showLogger(): void {
            Utilities.Logging.instance.showViewer();
        }

        public _renderFolderDetails(folderDetails: IFolderDetails): void {
            Utilities.Logging.instance.log("Bookmarks for: " + folderDetails.folder.folder_id);

            this._exitSelectionMode();

            this._folderNameElement.textContent = folderDetails.folder.title;

            // Set the item template before you set the data source
            this._contentList.itemTemplate = this._renderItem.bind(this);
            this._contentList.itemDataSource = folderDetails.bookmarks.dataSource;
        }

        private _createProgressHeader(initialMessage: string): void {
            var headerContainer = document.createElement("div");
            var syncProgress = new Codevoid.ArticleVoid.UI.SyncProgressControl(headerContainer, {
                initialMessage: initialMessage,
                template: this._progressTemplate,
                eventSource: this.viewModel.events,
                owningListView: this._contentList,
            });

            this._contentList.header = headerContainer;
        }
        
        public startSync(): void {
            this._splitView.closePane();
            this.viewModel.startSync();
        }

        public folderClicked(e: any): void {
            var button: UI.SplitViewCommandWithData = e.target.winControl;
            this.viewModel.switchCurrentFolderTo(button.dataContext.id);

            this._splitView.closePane();
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

        public toggleSelectionMode(): void {
            if (!this._inSelectionMode) {
                this._contentList.selectionMode = WinJS.UI.SelectionMode.multi;
                this._contentList.tapBehavior = WinJS.UI.TapBehavior.toggleSelect;
                this._selectModeToggle.icon = "cancel";
                this._inSelectionMode = true;
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

        public dumpDb(): void {
            this.viewModel.dumpDb().done((dumpData: string) => {
                Utilities.Logging.instance.log("Dumped");

                Utilities.Logging.instance.log(dumpData, true);
            }, () => {
                Utilities.Logging.instance.log("Not dumped");
            });
        }

        public showDbFiddler(): void {
            this.viewModel.showDbFiddler();
        }
        
        static folderIdToIcon: any;
        static restrictProgressTo5PercentOrMore: any;
        static showTitleOrUrl: any;
        static showDescriptionOrExtractedDescription: any;
        static createCssUrlPath: any;
        static extractDomainFromUrl: any;
    }

    WinJS.Utilities.markSupportedForProcessing(SignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.splitViewOpening);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.signOut);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showLogger);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.startSync);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.folderClicked);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.contentListSelectionChanged);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.toggleSelectionMode);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.handleSortsChanged);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.clearDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.dumpDb);
    WinJS.Utilities.markSupportedForProcessing(SignedInExperience.prototype.showDbFiddler);

    SignedInExperience.folderIdToIcon = WinJS.Binding.converter((folder: string) => {
        var result = "\uE8B7"; // hollow folder icon

        switch (folder) {
            case InstapaperDB.CommonFolderIds.Archive:
                result = "\uE8F1";
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
        if (bookmark.failedToDownload) {
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