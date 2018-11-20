module Codevoid.Storyvoid {
    const unreadFolderId = InstapaperDB.CommonFolderIds.Unread;

    // Sorts things so that newest items (e.g. higher time value implies
    // most recent) are at lower indexes
    function sortByNewlyAdded(first: IBookmark, second: IBookmark) {
        if (first.time > second.time) {
            return -1;
        }

        if (first.time < second.time) {
            return 1;
        }

        // They must be equal
        return 0;
    }

    // Sorts Items so that items with recently updated progress, but
    // which aren't completed to the front. Most recent progress goes
    // near the front. Items with no progress time stamp go at the end.
    function sortByRecentlyRead(first: IBookmark, second: IBookmark) {
        // If one is complete, but the other is not, sort the one that is
        // complete lower than the other.
        const firstComplete = (first.progress > 0.99);
        const secondComplete = (second.progress > 0.99);

        if (firstComplete && !secondComplete) {
            return 1; // Sort second higher
        }

        if (!firstComplete && secondComplete) {
            return -1; // Sort the first higher
        }

        // Since neither or both are complete, we have to fallback
        // to the progress updated time. This also handles the case
        // that one or both don't have _any_ progress, and those need
        // to go to the end.
        if (first.progress_timestamp > second.progress_timestamp) {
            return -1;
        }

        if (first.progress_timestamp < second.progress_timestamp) {
            return 1;
        }

        // They must be equal
        return 0;
    }

    function hasProgress(item: IBookmark): boolean {
        return (item.progress_timestamp > 0);
    }

    export interface IReadGroup {
        readonly name: string;
        readonly bookmarks: IBookmark[];
    }

    export class WhatToRead {
        private _jumpListSaveInProgress: WinJS.Promise<void>;

        constructor(private db: InstapaperDB) {
            if (!db) {
                throw new Error("Must supply DB object");
            }
        }

        public getStuffToRead(): WinJS.Promise<IReadGroup[]> {
            return this.db.listCurrentBookmarks().then((bookmarks: IBookmark[]): IReadGroup[] => {
                let byRecentlyRead: Codevoid.Storyvoid.IBookmark[] = [].concat(bookmarks);
                let byAdded: Codevoid.Storyvoid.IBookmark[] = [].concat(bookmarks);

                byRecentlyRead.sort(sortByRecentlyRead);
                byAdded.sort(sortByNewlyAdded);

                // Clamp recently read to 5
                byRecentlyRead = byRecentlyRead.filter(hasProgress).slice(0, 5);

                // Build list of id's that are in the top-5
                const readIds: { [id: number]: boolean } = {};
                byRecentlyRead.forEach((item: Codevoid.Storyvoid.IBookmark) => {
                    readIds[item.bookmark_id] = true;
                });

                // Clamp recently added to 5 that _aren't_ also in the recently read list.
                byAdded = byAdded.filter((added) => {
                    return !readIds[added.bookmark_id];
                }).slice(0, 5);

                const result = [];

                if (byRecentlyRead.length) {
                    result.push({
                        name: "Recently Read",
                        bookmarks: byRecentlyRead
                    });
                }

                if (byAdded.length) {
                    result.push({
                        name: "Recently Added",
                        bookmarks: byAdded
                    });
                }

                return result;
            });
        }

        public refreshJumplists(): void {
            if (this._jumpListSaveInProgress) {
                return;
            }

            this._jumpListSaveInProgress = WinJS.Promise.join({
                currentList: Windows.UI.StartScreen.JumpList.loadCurrentAsync(),
                groups: this.getStuffToRead()
            }).then((result: { currentList: Windows.UI.StartScreen.JumpList; groups: IReadGroup[] }) => {
                result.currentList.systemGroupKind = Windows.UI.StartScreen.JumpListSystemGroupKind.none;
                result.currentList.items.clear();

                const jumpListItem = Windows.UI.StartScreen.JumpListItem;
                result.groups.forEach((group) => {
                    group.bookmarks.forEach((bookmark) => {
                        const uri = `storyvoid://openarticle/?bookmark_id=${bookmark.bookmark_id}&original_uri=${bookmark.url}`;
                        const jumpItem = jumpListItem.createWithArguments(uri, bookmark.title);
                        jumpItem.groupName = group.name;
                        result.currentList.items.append(jumpItem);
                    });
                });

                return result.currentList.saveAsync();
            }).then(null, () => {
                Telemetry.instance.track("ErrorSavingJumpList", null);
            }).then(() => {
                this._jumpListSaveInProgress = null;
            });
        }

        public static clearJumpList(): WinJS.Promise<void> {
            return Windows.UI.StartScreen.JumpList.loadCurrentAsync().then((list) => {
                list.items.clear();
                list.systemGroupKind = Windows.UI.StartScreen.JumpListSystemGroupKind.none;
                return list.saveAsync();
            }).then(null, () => { });
        }
    }
}