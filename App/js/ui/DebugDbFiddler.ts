module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    interface IFiddleCommand {
        label: string;
        handler: () => void;
    }

    export class DbFiddlerExperience extends Codevoid.UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private fiddleCommands: WinJS.UI.Repeater;
        private viewModel: DbFiddlerViewModel;

        constructor(element: HTMLElement, options: any) {
            super(element, options);
            WinJS.Utilities.addClass(element, "dbFiddler-container");
            DOM.loadTemplate("/HtmlTemplates.html", "dbFiddler").then((template) => {
                return template.render(null, element);
            }).done(() => {
                DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.DbFiddler");
                this._handlersToCleanup.push(DOM.marryEventsToHandlers(element, this));
                DOM.marryPartsToControl(element, this);

                this.fiddleCommands.data = this.viewModel.getCommands();
            });
        }

        public fiddleCommandInvoked(e: UIEvent): void {
            var originalElement = e.srcElement;
            var data: IFiddleCommand = (<any>originalElement).payload;

            data.handler();
        }
    }

    export class DbFiddlerViewModel implements Codevoid.UICore.ViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.DbFiddlerExperience" };
        constructor(private _db: InstapaperDB) {
        }

        public getCommands(): WinJS.Binding.List<IFiddleCommand> {
            var commands = [
                {
                    label: "Add",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.ADD,
                            bookmark_id: 235423452,
                            bookmark: {
                                bookmark_id: 235423452,
                                folder_dbid: this._db.commonFolderDbIds.unread,
                                title: "FAKE ADDED",
                                time: 1,
                                description: "Nothing"
                            }
                        });
                    }
                },
                {
                    label: "Remove",
                    handler: () => {
                        this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread).then((bookmarks: IBookmark[]) => {
                            var firstBookmark = bookmarks[0];
                            this._db.dispatchEvent("bookmarkschanged", {
                                operation: InstapaperDB.BookmarkChangeTypes.DELETE,
                                bookmark: firstBookmark,
                                bookmark_id: firstBookmark.bookmark_id,
                            });
                        });
                    }
                },
                {
                    label: "Mutate Title",
                    handler: () => {
                        this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread).then((bookmarks: IBookmark[]) => {
                            var firstBookmark = bookmarks[0];
                            firstBookmark.title = "OH YEAH I CHANGED, YES I DID";

                            this._db.dispatchEvent("bookmarkschanged", {
                                operation: InstapaperDB.BookmarkChangeTypes.UPDATE,
                                bookmark_id: firstBookmark.bookmark_id,
                                bookmark: firstBookmark,
                            });
                        });
                    }
                },
                {
                    label: "Mutate Progress",
                    handler: () => {
                        this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread).then((bookmarks: IBookmark[]) => {
                            var firstBookmark = bookmarks[0];
                            firstBookmark.title = "OH YEAH I CHANGED, YES I DID";
                            firstBookmark.progress = Math.random();

                            this._db.dispatchEvent("bookmarkschanged", {
                                operation: InstapaperDB.BookmarkChangeTypes.UPDATE,
                                bookmark_id: firstBookmark.bookmark_id,
                                bookmark: firstBookmark,
                            });
                        });
                    }
                },
                {
                    label: "Change Home Folder title",
                    handler: () => {
                        this._db.dispatchEvent("folderschanged", {
                            operation: InstapaperDB.FolderChangeTypes.UPDATE,
                            folder_dbid: this._db.commonFolderDbIds.unread,
                            folder: {
                                id: this._db.commonFolderDbIds.unread,
                                title: "New Title",
                            }
                        });
                    }
                },
                {
                    label: "Remove folder",
                    handler: () => {
                        var commonFolderIds = Object.keys(this._db.commonFolderDbIds).map((key: string) => {
                            return this._db.commonFolderDbIds[key];
                        });

                        this._db.listCurrentFolders().then((folders: IFolder[]) => {
                            var nonDefaultFolders = folders.filter((folder: IFolder) => {
                                if (folder.localOnly) {
                                    return false;
                                }

                                if (commonFolderIds.indexOf(folder.id) > -1) {
                                    return false;
                                }

                                return true;
                            });

                            this._db.dispatchEvent("folderschanged", {
                                operation: InstapaperDB.FolderChangeTypes.DELETE,
                                folder_dbid: nonDefaultFolders[0].id,
                            });
                        });
                    }
                }
            ];

            commands.forEach((command: IFiddleCommand) => {
                command.handler = WinJS.Utilities.markSupportedForProcessing(command.handler);
            });

            return new WinJS.Binding.List(commands);
        }
    }

    WinJS.Utilities.markSupportedForProcessing(DbFiddlerExperience);
    WinJS.Utilities.markSupportedForProcessing(DbFiddlerExperience.prototype.fiddleCommandInvoked);
}