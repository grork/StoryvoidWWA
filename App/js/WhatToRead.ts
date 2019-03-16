/// <reference path="deeplinking.ts" />
namespace Codevoid.Storyvoid {
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
        private _jumpListSaveInProgress: boolean;

        constructor(private db: InstapaperDB) {
            if (!db) {
                throw new Error("Must supply DB object");
            }
        }

        public async getStuffToRead(): Promise<IReadGroup[]> {
            const bookmarks = await this.db.listCurrentBookmarks();
            let byRecentlyRead: Codevoid.Storyvoid.IBookmark[] = [].concat(bookmarks);
            let byAdded: Codevoid.Storyvoid.IBookmark[] = [].concat(bookmarks);

            byRecentlyRead.sort(sortByRecentlyRead);
            byAdded.sort(sortByNewlyAdded);

            // Clamp recently read to 5
            byRecentlyRead = byRecentlyRead.filter(hasProgressAndNotUnpinned).slice(0, 5);

            // Build list of id's that are in the top-5
            const readIds: { [id: number]: boolean } = {};
            for (let item of byRecentlyRead) {
                readIds[item.bookmark_id] = true;
            }

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
        }

        public async refreshJumplists(): Promise<void> {
            if (this._jumpListSaveInProgress) {
                return;
            }

            this._jumpListSaveInProgress = true;
            const currentList = await StartScreen.JumpList.loadCurrentAsync();
            await this._refreshJumpListImpl(currentList.items);
            currentList.systemGroupKind = Windows.UI.StartScreen.JumpListSystemGroupKind.none;

            // Ignore errors, but trace them. This can be a flaked API, apparently
            // https://blog.jayway.com/2018/05/31/uwp-jump-lists-done-right/
            try {
                await currentList.saveAsync();
            } catch (e) {
                Telemetry.instance.track("ErrorSavingJumpList", null);
            }

            this._jumpListSaveInProgress = false;
        }

        private async _refreshJumpListImpl(items: IJumpListItem[]): Promise<void> {
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

            if (removedDbIds.length > 0) {
                // Get bookmarks by the removed IDs
                let bookmarks = await Promise.all(removedDbIds.map((id) => this.db.getBookmarkByBookmarkId(id)));
                // Filter out any bookmarks that we didn't find (e.g. are null)
                bookmarks = bookmarks.filter(b => !!b);
                if (bookmarks.length > 0) {
                    // now update all the bookmarks to have the explicitlyUnpinned property
                    const updates = bookmarks.map(bookmark => {
                        bookmark.doNotAddToJumpList = true;
                        return this.db.updateBookmark(bookmark, true /*dontRaiseChangeNotification*/);
                    });

                    await Promise.all(updates);
                }
            }

            const groups = await this.getStuffToRead();
            items.length = 0; // Reset to no-items
            // Convert the what to read list into the JumpList and save it.


            const jumpListItem = Windows.UI.StartScreen.JumpListItem;
            for (let group of groups) {
                for(let bookmark of group.bookmarks) {
                    const uri = Codevoid.Storyvoid.Deeplinking.getUriForBookmark(bookmark);
                    const jumpItem = jumpListItem.createWithArguments(uri, bookmark.title);
                    jumpItem.groupName = group.name;
                    jumpItem.logo = new Windows.Foundation.Uri("ms-appx:///images/Article44x44.png");
                    items.push(jumpItem);
                }
            }
        }

        public static async clearJumpList(): Promise<void> {
            try {
                const list = await Windows.UI.StartScreen.JumpList.loadCurrentAsync();
                list.items.clear();
                list.systemGroupKind = Windows.UI.StartScreen.JumpListSystemGroupKind.none;
                await list.saveAsync();
            } catch (e) { /* Drop any errors, since this is a flakey API */ }
        }
    }
}