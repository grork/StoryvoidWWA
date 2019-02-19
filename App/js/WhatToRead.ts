/// <reference path="deeplinking.ts" />
module Codevoid.Storyvoid {
    import StartScreen = Windows.UI.StartScreen;

    const unreadFolderId = InstapaperDBCommonFolderIds.Unread;

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

    function hasProgressAndNotUnpinned(item: IBookmark): boolean {
        return (item.progress_timestamp > 0) && !item.doNotAddToJumpList;
    }

    export interface IReadGroup {
        readonly name: string;
        readonly bookmarks: IBookmark[];
    }

    export interface IJumpListItem {
        removedByUser: boolean;
        arguments: string;
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
                byRecentlyRead = byRecentlyRead.filter(hasProgressAndNotUnpinned).slice(0, 5);

                // Build list of id's that are in the top-5
                const readIds: { [id: number]: boolean } = {};
                byRecentlyRead.forEach((item: Codevoid.Storyvoid.IBookmark) => {
                    readIds[item.bookmark_id] = true;
                });

                // Clamp recently added to 5 that _aren't_ also in the recently read list.
                byAdded = byAdded.filter((added) => {
                    return !readIds[added.bookmark_id] && !added.doNotAddToJumpList;
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

            let currentList: StartScreen.JumpList;
            this._jumpListSaveInProgress = StartScreen.JumpList.loadCurrentAsync().then((list) => {
                currentList = list;
                return this._refreshJumpListImpl(list.items);
            }).then(() => {
                currentList.systemGroupKind = Windows.UI.StartScreen.JumpListSystemGroupKind.none;
                // Ignore errors, but trace them. This can be a flaked API, apparently
                // https://blog.jayway.com/2018/05/31/uwp-jump-lists-done-right/
                return currentList.saveAsync().then(null, () => Telemetry.instance.track("ErrorSavingJumpList", null));
            }).then(() => {
                this._jumpListSaveInProgress = null;
            });
        }

        private _refreshJumpListImpl(items: IJumpListItem[]): WinJS.Promise<void> {
            const removedDbIds: number[] = [];

            // Process the current jump list items, and build
            // a list of any explicitly removed items from the DB
            items.forEach((current) => {
                if (!current.removedByUser) {
                    return;
                }

                const linkInformation = Deeplinking.extractBookmarkInformationFromUri(new Windows.Foundation.Uri(current.arguments));
                if (!linkInformation.bookmark_id) {
                    return;
                }

                removedDbIds.push(linkInformation.bookmark_id);
            });

            let updateRemovedPins: WinJS.Promise<void> = WinJS.Promise.as();
            if (removedDbIds.length > 0) {
                // Get bookmarks by the removed IDs
                const bookmarks = removedDbIds.map((id) => {
                    return this.db.getBookmarkByBookmarkId(id);
                });

                updateRemovedPins = WinJS.Promise.join(bookmarks).then((bookmarks: IBookmark[]) => {
                    // Filter out any bookmarks that we didn't find (e.g. are null)
                    bookmarks = bookmarks.filter(b => !!b);
                    if (bookmarks.length < 1) {
                        return WinJS.Promise.as([]);
                    }

                    // now update all the bookmarks to have the explicitlyUnpinned property
                    const updates = bookmarks.map(bookmark => {
                        bookmark.doNotAddToJumpList = true;
                        return this.db.updateBookmark(bookmark, true /*dontRaiseChangeNotification*/);
                    });

                    return WinJS.Promise.join(updates);
                });
            }

            return updateRemovedPins.then(() => {
                // Since we've updated the DB with any explicitly
                // removed items, we can just load from the DB
                return this.getStuffToRead();
            }).then((groups: IReadGroup[]) => {
                // Convert the what to read list into the JumpList and save it.
                items.length = 0;

                const jumpListItem = Windows.UI.StartScreen.JumpListItem;
                groups.forEach((group) => {
                    group.bookmarks.forEach((bookmark) => {
                        const uri = Codevoid.Storyvoid.Deeplinking.getUriForBookmark(bookmark);
                        const jumpItem = jumpListItem.createWithArguments(uri, bookmark.title);
                        jumpItem.groupName = group.name;
                        jumpItem.logo = new Windows.Foundation.Uri("ms-appx:///images/Article44x44.png");
                        items.push(jumpItem);
                    });
                });
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