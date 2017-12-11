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

            this._ready = new Codevoid.Utilities.Signal();

            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "folderList").then((template) => {
                return template.render({}, element);
            }).then(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.FolderListExperience");
                DOM.marryPartsToControl(element, this);
                
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));

                // Let callers now we're ready to be shown
                this._ready.complete();
            });
        }

        public get ready(): WinJS.Promise<any> {
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

        public refresh(): WinJS.Promise<any> {
            // Only update the item template if we haven't already set one
            if (this._contentList.itemTemplate != this._itemTemplate.element) {
                this._contentList.itemTemplate = this._itemTemplate.element;
            }

            return this.viewModel.listFolders().then((folders: Codevoid.Storyvoid.IFolder[]) => {
                this._contentList.itemDataSource = new WinJS.Binding.List(folders).dataSource;
            });
        }

        public dismiss(): void {
            this._flyout.hide();
        }

        public listInvoked(e: UIEvent): void {
            if (!this._moveSignal) {
                return;
            }

            (<any>e.detail).itemPromise.then((item: WinJS.UI.IItem<IFolder>) => {
                this._moveSignal.complete(item.data);
                this._flyout.hide();
            });
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

        public show(targetPosition: HTMLElement): WinJS.Promise<IFolder> {
            if (this._moveSignal) {
                this._moveSignal.complete(null);
            }

            this._moveSignal = new Codevoid.Utilities.Signal();
            var completion = this._moveSignal.promise.then((result: any) => {
                this._moveSignal = null;

                return result;
            });

            // Bounce the UI thread to allow layout to complete
            // so that things are positioned appropriately
            WinJS.Promise.timeout().done(() => {
                var alignment = "top";
                
                if (targetPosition.hasAttribute("aria-haspopup")) {
                    alignment = "bottom";
                } else if (targetPosition.firstElementChild.classList.contains("win-menucommand-liner")) {
                    alignment = "right";
                }

                this._flyout.show(targetPosition, alignment);

                // Kick off loading the folder list
                this.refresh();
            });

            return completion;
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

        public move(bookmarks: IBookmark[], targetPosition: HTMLElement): WinJS.Promise<boolean> {
            var element = document.createElement("div");
            document.body.appendChild(element);

            // The move experiance is a light dismiss popup
            // so instead of creating a vast swath of complexity for
            // the possibly reuse of the folder list itself, just shove these
            // things into a new element and hope for the best
            var experience = new MoveToFolderExperience(element, { viewModel: this });
            return experience.ready.then(() => {
                return experience.show(targetPosition);
            }).then((targetFolder: IFolder) => {
                // if someone clicks cancel, then there willbe no selected folder
                if (!targetFolder) {
                    return false;
                }

                return Codevoid.Utilities.serialize(bookmarks, (item: IBookmark) => {
                    return this._instapaperDB.moveBookmark(item.bookmark_id, targetFolder.id);
                }).then(() => {
                    return true;
                });
            }).then((result: WinJS.Promise<boolean>) => {
                Utilities.DOM.removeChild(document.body, element);

                return result;
            });
        }

        public listFolders(): WinJS.Promise<Codevoid.Storyvoid.IFolder[]> {
            return this._instapaperDB.listCurrentFolders().then((folders: IFolder[]) => {
                return folders.filter((item) => {
                    if (item.localOnly
                        || (item.id === this._instapaperDB.commonFolderDbIds.archive)
                        || (item.id === this._instapaperDB.commonFolderDbIds.liked)) {
                        return false;
                    }

                    return true;
                }).sort((firstFolder: IFolder, secondFolder: IFolder): number => {
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
            });
        }
    }
}