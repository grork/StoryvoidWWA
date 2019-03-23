module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;
    export class MoveToFolderExperience extends Codevoid.UICore.Control {
        private _itemTemplate: WinJS.Binding.Template;
        private _flyout: WinJS.UI.Flyout;
        private _cancelButton: HTMLButtonElement;
        private _contentList: WinJS.UI.ListView<IFolder>;
        private _moveSignal: Codevoid.Utilities.Signal;
        private _ready: Codevoid.Utilities.Signal;
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        public viewModel: MoveToFolderViewModel;

        constructor(element: HTMLElement, options?: any) {
            super(element, options);
            this.init();
        }

        private async init(): Promise<void> {
            this._ready = new Codevoid.Utilities.Signal();

            const template = await Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "folderList");
            await template.render({}, this.element);

            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.FolderListExperience");
            DOM.marryPartsToControl(this.element, this);

            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));

            // Let callers now we're ready to be shown
            this._ready.complete();
        }

        public get ready(): PromiseLike<any> {
            return this._ready.promise;
        }

        public dispose(): void {
            if (this._handlersToCleanup) {
                this._handlersToCleanup.forEach((item) => {
                    item.cancel();
                });
                this._handlersToCleanup = null;
            }
        }

        public async refresh(): Promise<void> {
            // Only update the item template if we haven't already set one
            if (this._contentList.itemTemplate != this._itemTemplate.element) {
                this._contentList.itemTemplate = this._itemTemplate.element;
            }

            const folders = await this.viewModel.listFolders();
            this._contentList.itemDataSource = new WinJS.Binding.List(folders).dataSource;
        }

        public dismiss(): void {
            this._flyout.hide();
        }

        public async listInvoked(e: UIEvent): Promise<void> {
            if (!this._moveSignal) {
                return;
            }

            const item: WinJS.UI.IItem<IFolder> = await (<any>e.detail).itemPromise;
            this._moveSignal.complete(item.data);
            this._flyout.hide();
        }

        public afterShow(): void {
            // Focus is jumping to the listview, which is ugly, so
            // for now jump it to the cancel button
            this._cancelButton.focus();
        }

        public afterHide(): void {
            if (!this._moveSignal) {
                return;
            }

            this._moveSignal.complete(null);
        }

        public async show(targetPosition: HTMLElement): Promise<IFolder> {
            if (this._moveSignal) {
                this._moveSignal.complete(null);
            }

            this._moveSignal = new Codevoid.Utilities.Signal();

            // Bounce the UI thread to allow layout to complete
            // so that things are positioned appropriately
            await Codevoid.Utilities.timeout();
            let alignment = "bottom";
                
            if (targetPosition.firstElementChild.classList.contains("win-menucommand-liner")) {
                alignment = "right";
            }

            this._flyout.show(targetPosition, alignment);

            // Kick off loading the folder list
            this.refresh();

            const folder = await this._moveSignal.promise;
            this._moveSignal = null;
            return folder;
        }
    }

    WinJS.Utilities.markSupportedForProcessing(MoveToFolderExperience);
    WinJS.Utilities.markSupportedForProcessing(MoveToFolderExperience.prototype.dismiss);
    WinJS.Utilities.markSupportedForProcessing(MoveToFolderExperience.prototype.listInvoked);
    WinJS.Utilities.markSupportedForProcessing(MoveToFolderExperience.prototype.afterShow);
    WinJS.Utilities.markSupportedForProcessing(MoveToFolderExperience.prototype.afterHide);

    export class MoveToFolderViewModel {
        private _eventSource = new Codevoid.Utilities.EventSource();

        constructor(private _instapaperDB: InstapaperDB) {
        }

        public async move(bookmarks: IBookmark[], targetPosition: HTMLElement): Promise<boolean> {
            var element = document.createElement("div");
            document.body.appendChild(element);

            // The move experiance is a light dismiss popup
            // so instead of creating a vast swath of complexity for
            // the possibly reuse of the folder list itself, just shove these
            // things into a new element and hope for the best
            const experience = new MoveToFolderExperience(element, { viewModel: this });
            await experience.ready;
            const targetFolder = await experience.show(targetPosition);

            // if someone clicks cancel, then there willbe no selected folder
            if (!targetFolder) {
                return false;
            }

            // Move the bookmarks one by one
            await Codevoid.Utilities.serialize(bookmarks, (item: IBookmark) => this._instapaperDB.moveBookmark(item.bookmark_id, targetFolder.id));

            Utilities.DOM.removeChild(document.body, element);
            return true;
        }

        public async listFolders(): Promise<IFolder[]> {
            const folders = await this._instapaperDB.listCurrentFolders();

            const appropriateFolders = folders.filter((item) => {
                if (item.localOnly
                    || (item.id === this._instapaperDB.commonFolderDbIds.archive)
                    || (item.id === this._instapaperDB.commonFolderDbIds.liked)) {
                    return false;
                }

                return true;
            });

            appropriateFolders.sort((firstFolder: IFolder, secondFolder: IFolder): number => {
                if ((firstFolder.position === undefined) && (secondFolder.position === undefined)) {
                    // Assume we're sorting pre-canned folders. Sort by "id"
                    if (firstFolder.id < secondFolder.id) {
                        return -1;
                    } else if (firstFolder.id > secondFolder.id) {
                        return 1;
                    } else {
                        return;
                    }
                }

                if ((firstFolder.position === undefined) && (secondFolder.position !== undefined)) {
                    // Assume it's a pre-canned folder against a user folder. Pre-canned
                    // always go first
                    return -1;
                }

                if ((firstFolder.position !== undefined) && (secondFolder.position === undefined)) {
                    // Assume it's a user folder against a pre-canned folder. User folders
                    // always come after.
                    return 1;
                }

                // Since we've got user folders, sort soley by the users ordering preference
                if (firstFolder.position < secondFolder.position) {
                    return -1;
                } else if (firstFolder.position > secondFolder.position) {
                    return 1;
                } else {
                    return 1;
                }
            });

            return appropriateFolders;
        }
    }
}