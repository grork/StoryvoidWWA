namespace Codevoid.Storyvoid.UI {
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
            this.init();
        }

        private async init(): Promise<void> {
            WinJS.Utilities.addClass(this.element, "dbFiddler-container");
            const template = await DOM.loadTemplate("/HtmlTemplates.html", "dbFiddler");
            await template.render(null, this.element);

            DOM.setControlAttribute(this.element, "Codevoid.Storyvoid.UI.DbFiddler");
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            this.fiddleCommands.data = this.viewModel.getCommands();
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
                            operation: InstapaperDBBookmarkChangeTypes.ADD,
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
                    handler: async () => {
                        const bookmarks = await this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread);
                        var firstBookmark = bookmarks[0];
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDBBookmarkChangeTypes.DELETE,
                            bookmark: firstBookmark,
                            bookmark_id: firstBookmark.bookmark_id,
                        });
                    }
                },
                {
                    label: "Mutate Title",
                    handler: async () => {
                        const bookmarks = await this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread);
                        var firstBookmark = bookmarks[0];
                        firstBookmark.title = "OH YEAH I CHANGED, YES I DID";

                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDBBookmarkChangeTypes.UPDATE,
                            bookmark_id: firstBookmark.bookmark_id,
                            bookmark: firstBookmark,
                        });
                    }
                },
                {
                    label: "Mutate Progress",
                    handler: async () => {
                        const bookmarks = await this._db.listCurrentBookmarks(this._db.commonFolderDbIds.unread);
                        var firstBookmark = bookmarks[0];
                        firstBookmark.title = "OH YEAH I CHANGED, YES I DID";
                        firstBookmark.progress = Math.random();

                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDBBookmarkChangeTypes.UPDATE,
                            bookmark_id: firstBookmark.bookmark_id,
                            bookmark: firstBookmark,
                        });
                    }
                },
                {
                    label: "Change Home Folder title",
                    handler: () => {
                        this._db.dispatchEvent("folderschanged", {
                            operation: InstapaperDBFolderChangeTypes.UPDATE,
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
                    handler: async () => {
                        var commonFolderIds = Object.keys(this._db.commonFolderDbIds).map((key: string) => this._db.commonFolderDbIds[key]);

                        const folders = await this._db.listCurrentFolders();
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
                            operation: InstapaperDBFolderChangeTypes.DELETE,
                            folder_dbid: nonDefaultFolders[0].id,
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