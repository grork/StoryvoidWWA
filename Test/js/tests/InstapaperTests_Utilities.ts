namespace InstapaperTestUtilities {
    import InstapaperDB = Codevoid.Storyvoid.InstapaperDB;
    let pendingDbs: InstapaperDB[] = [];

    function cleanUpOpenDbs(): void {
        pendingDbs.forEach((idb) => idb.dispose());

        pendingDbs = [];
    }

    export function cleanupExperienceHost(): void {
        Codevoid.UICore.Experiences.initializeHost(null);
    }

    export function getPlayground(): HTMLElement {
        var playground = document.getElementById("dom-fixture");

        return playground.appendChild(document.createElement("div"));
    }

    export function clearPlayground(): void {
        const playground = document.getElementById("dom-fixture");
        playground.innerHTML = "";
    }

    export async function getNewInstapaperDBAndInit(name?: string, version?: number): Promise<InstapaperDB> {
        const idb = await (new InstapaperDB()).initialize(name, version);
        pendingDbs.push(idb);

        return idb;
    }

    export async function expectNoPendingFolderEdits(idb: InstapaperDB): Promise<void> {
        const pendingEdits = await idb.getPendingFolderEdits();
        assert.ok(pendingEdits, "Expected valid pending edits structure");
        assert.strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
    }

    export async function colludePendingBookmarkEdits(pendingEditPromise: PromiseLike<Codevoid.Storyvoid.IBookmarkPendingEdits>): Promise<Codevoid.Storyvoid.IBookmarkPendingEdit[]> {
        const edits = await pendingEditPromise;
        if (Array.isArray(edits)) {
            return edits;
        }

        let colluded: Codevoid.Storyvoid.IBookmarkPendingEdit[] = [];
        if (edits.adds && edits.adds.length) {
            colluded = colluded.concat(edits.adds);
        }

        if (edits.deletes && edits.deletes.length) {
            colluded = colluded.concat(edits.deletes);
        }

        if (edits.moves && edits.moves.length) {
            colluded = colluded.concat(edits.moves);
        }

        if (edits.likes && edits.likes.length) {
            colluded = colluded.concat(edits.likes);
        }

        if (edits.unlikes && edits.unlikes.length) {
            colluded = colluded.concat(edits.unlikes);
        }

        colluded.sort((a, b) => {
            if (a.id === b.id) {
                return 0;
            } else if (a.id < b.id) {
                return -1;
            } else {
                return 1;
            }
        });

        return colluded;
    }

    export async function expectNoPendingBookmarkEdits(idb: InstapaperDB): Promise<void> {
        const pendingEdits = await colludePendingBookmarkEdits(idb.getPendingBookmarkEdits());
        assert.ok(pendingEdits, "Expected valid pending edits structure");
        assert.strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
    }

    export async function deleteDb(name?: string): Promise<void> {
        cleanUpOpenDbs();

        await db.deleteDb(name || InstapaperDB.DBName);
    }

    export const defaultFolderIds = [Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive, Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Orphaned];

    /// <summary>
    /// Adds "cost" -- there is a limit of 120 per day -- so rather than
    /// Always nuking them remotely and re-adding them, lets try and keep
    /// what we have remotely and work with those. This involves blowing away
    /// all the folders, an moving the ones left in archive to unread. Also
    /// we need to make sure that we clean up the liked items so everything is
    /// clean & happy.
    /// Finally, we also need to reset the progress.
    /// </summary>
    export async function destroyRemoteAccountData(clientInformation: Codevoid.OAuth.ClientInformation): Promise<void> {
        const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        // Remove all the folders. If there are any bookmarks in these folders
        // when this happens, the back end will move them to "Archive".
        const serverFolders = await folders.list();
        const serverBookmarks: Codevoid.Storyvoid.InstapaperApi.IBookmarkListResult[] = await Codevoid.Utilities.serialize(serverFolders, (folder) => {
            // We can't delete the default folders, so skip them
            if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                return;
            }

            return bookmarks.list({ folder_id: folder.folder_id });
        });


        var allBookmarks = [];
        serverBookmarks.forEach((folderOfBookmarks) => allBookmarks = allBookmarks.concat(folderOfBookmarks.bookmarks));

        await Codevoid.Utilities.serialize(allBookmarks, (bookmark) => bookmarks.unarchive(bookmark.bookmark_id));
        await Codevoid.Utilities.serialize(serverFolders, (folder) => {
            if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                return;
            }

            return folders.deleteFolder(folder.folder_id);
        });

        // Find all the now-in-archive folders, and...
        const archivedBookmarks = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive });
        // ... unarchive them. This will put them in "unread"
        await Codevoid.Utilities.serialize(archivedBookmarks.bookmarks, (bookmark) => bookmarks.unarchive(bookmark.bookmark_id));

        // Find anything that has a "like" on it...
        const likes = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked });
        await Codevoid.Utilities.serialize(likes.bookmarks, (liked) => bookmarks.unstar(liked.bookmark_id));

        const remoteBookmarks = await bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread });

        // Delete *some* of the remote URLs, but not all of them.
        const toRemove = remoteBookmarks.bookmarks.slice(4);
        const toReset = remoteBookmarks.bookmarks.slice(0, 4);

        const removals = Codevoid.Utilities.serialize(toRemove, (item) => bookmarks.deleteBookmark(item.bookmark_id));
        const progressReset = Codevoid.Utilities.serialize(toReset, (rb) => {
            return bookmarks.updateReadProgress({
                bookmark_id: rb.bookmark_id,
                progress: 0.0,
                progress_timestamp: Date.now(),
            });
        });

        await Promise.all([removals, progressReset]);
    }
}