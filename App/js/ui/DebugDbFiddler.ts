module Codevoid.ArticleVoid.UI {
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
                DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.DbFiddler");
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
        public experience = { wwa: "Codevoid.ArticleVoid.UI.DbFiddlerExperience" };
        constructor(private _db: InstapaperDB) {
        }

        public getCommands(): WinJS.Binding.List<IFiddleCommand> {
            var commands = [
                {
                    label: "Add",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.ADD,
                        });
                    }
                },
                {
                    label: "Remove",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.DELETE,
                        });
                    }
                },
                {
                    label: "Mutate Title",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.UPDATE,
                        });
                    }
                },
                {
                    label: "Mutate Progress",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.UPDATE,
                        });
                    }
                },
                {
                    label: "Move",
                    handler: () => {
                        this._db.dispatchEvent("bookmarkschanged", {
                            operation: InstapaperDB.BookmarkChangeTypes.MOVE,
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