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

    export function getNewInstapaperDBAndInit(name?: string, version?: number): PromiseLike<InstapaperDB> {
        return new InstapaperDB().initialize(name, version).then((idb) => {
            pendingDbs.push(idb);

            return idb;
        });
    }

    export function expectNoPendingFolderEdits(idb: InstapaperDB): PromiseLike<void> {
        return idb.getPendingFolderEdits().then((pendingEdits) => {
            assert.ok(pendingEdits, "Expected valid pending edits structure");
            assert.strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    export function colludePendingBookmarkEdits(pendingEditPromise: PromiseLike<Codevoid.Storyvoid.IBookmarkPendingEdits>): PromiseLike<Codevoid.Storyvoid.IBookmarkPendingEdit[]> {
        return pendingEditPromise.then((edits) => {
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
        });
    }

    export function expectNoPendingBookmarkEdits(idb: InstapaperDB): PromiseLike<void> {
        return colludePendingBookmarkEdits(idb.getPendingBookmarkEdits()).then((pendingEdits) => {
            assert.ok(pendingEdits, "Expected valid pending edits structure");
            assert.strictEqual(pendingEdits.length, 0, "Didn't expect to find any pending edits");
        });
    }

    export function deleteDb(name?: string): PromiseLike<void> {
        cleanUpOpenDbs();

        return WinJS.Promise.timeout().then(() => db.deleteDb(name || InstapaperDB.DBName)).then(() => assert.ok(true));
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
    export function destroyRemoteAccountData(clientInformation: Codevoid.OAuth.ClientInformation) {
        const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        // Remove all the folders. If there are any bookmarks in these folders
        // when this happens, the back end will move them to "Archive".
        return folders.list().then((serverFolders) => {
            return <PromiseLike<any>>WinJS.Promise.join({
                bookmarks: Codevoid.Utilities.serialize(serverFolders, (folder) => {
                    // We can't delete the default folders, so skip them
                    if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                        return;
                    }

                    return bookmarks.list({ folder_id: folder.folder_id });
                }),
                folders: serverFolders,
            });
        }).then((data: { bookmarks: Codevoid.Storyvoid.InstapaperApi.IBookmarkListResult[]; folders: Codevoid.Storyvoid.IFolder[] }) => {
            var allBookmarks = [];
            data.bookmarks.forEach((folderOfBookmarks) => allBookmarks = allBookmarks.concat(folderOfBookmarks.bookmarks));

            return Codevoid.Utilities.serialize(allBookmarks, (bookmark) => bookmarks.unarchive(bookmark.bookmark_id)).then(() => data.folders);
        }).then((serverFolders) => {
            return Codevoid.Utilities.serialize(serverFolders, (folder) => {
                if (defaultFolderIds.indexOf(folder.folder_id) !== -1) {
                    return;
                }

                return folders.deleteFolder(folder.folder_id);
            });
            // Find all the now-in-archive folders, and...
        }).then(() => bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Archive })).then((archivedBookmarks) => {
            // ... unarchive them. This will put them in "unread"
            return Codevoid.Utilities.serialize(archivedBookmarks.bookmarks, (bookmark) => bookmarks.unarchive(bookmark.bookmark_id));

            // Find anything that has a "like" on it...
        }).then(() => bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Liked })).then((likes) => {
            return Codevoid.Utilities.serialize(likes.bookmarks, (liked) => bookmarks.unstar(liked.bookmark_id));
        }).then(() => bookmarks.list({ folder_id: Codevoid.Storyvoid.InstapaperDBCommonFolderIds.Unread })).then((remoteBookmarks) => {
            // Delete *some* of the remote URLs, but not all of them.
            const toRemove = remoteBookmarks.bookmarks.slice(4);
            const toReset = remoteBookmarks.bookmarks.slice(0, 4);

            const removals = Codevoid.Utilities.serialize(toRemove, (item) => bookmarks.deleteBookmark(item.bookmark_id));

            var progressReset = Codevoid.Utilities.serialize(toReset, (rb) => {
                return bookmarks.updateReadProgress({
                    bookmark_id: rb.bookmark_id,
                    progress: 0.0,
                    progress_timestamp: Date.now(),
                });
            });

            return <PromiseLike<any>>WinJS.Promise.join([removals, progressReset]);
        });
    }
}