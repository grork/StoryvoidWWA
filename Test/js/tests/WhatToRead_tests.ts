/// <reference path="..\..\..\app\js\WhatToRead.ts" />

module CodevoidTests.WhatToReadTests {
    const promiseTest = InstapaperTestUtilities.promiseTest;

    interface IWhatToRead_ForTest {
        _refreshJumpListImpl(currentList: Codevoid.Storyvoid.IJumpListItem[]): WinJS.Promise<Windows.UI.StartScreen.JumpList>;
    }

    let bookmarkId = 100000;
    let timestamp = 100000;

    function getCompleteBookmark(base: any): Codevoid.Storyvoid.IBookmark {
        if (!base.title) {
            throw new Error("Needs a title");
        }

        if (!base.folder_dbid) {
            throw new Error("Needs a folder");
        }

        const bookmark_id = base.bookmark_id || (bookmarkId += 1);

        return {
            title: base.title,
            url: base.url || `https://test${bookmark_id.toString()}.com`,
            bookmark_id: bookmark_id,
            progress: base.progress || Math.random(),
            time: base.time || (timestamp += 10),
            progress_timestamp: base.progress_timestamp || 0,
            folder_id: "unread",
            folder_dbid: base.folder_dbid,
            contentAvailableLocally: base.contentAvailableLocally || false,
            hasImages: base.hasImages || false,
            firstImagePath: base.firstImagePath || null,
            firstImageOriginalUrl: base.firstImageOriginalUri || null,
            localFolderRelativePath: base.localFolderRelativePath || null,
            description: base.description || null,
            extractedDescription: base.description || null,
            articleUnavailable: base.articleUnavailable || false,
            starred: base.starred || 0,
        };
    }

    function getDb(): WinJS.Promise<Codevoid.Storyvoid.InstapaperDB> {
        const dbName = "WhatToReadTests";
        const db = new Codevoid.Storyvoid.InstapaperDB();

        // Make sure the DB is empty before adding sample data
        return db.initialize(dbName).then(() => db.deleteAllData()).then(() => db.initialize(dbName));
    }

    function addBookmarksToDb(bookmarksToAdd: Codevoid.Storyvoid.IBookmark[], db: Codevoid.Storyvoid.InstapaperDB): WinJS.Promise<void> {
        const adds = bookmarksToAdd.map((item) => db.addBookmark(item));
        return WinJS.Promise.join(adds).then(() => { });
    }

    function getSampleBookmarks(folder_dbid: number): Codevoid.Storyvoid.IBookmark[] {
        let bookmarks: Codevoid.Storyvoid.IBookmark[] = [];

        // 10 bookmarks, in fixed order with some gaps for explict
        // ones to be inserted by tests
        for (let i = 1; i <= 10; i++) {
            let id = i * 10;
            bookmarks.push(getCompleteBookmark({
                title: "b" + id.toString(),
                bookmark_id: id,
                time: id,
                folder_dbid: folder_dbid
            }));
        }

        // NB: Oldest is the lowest number
        bookmarks[3].progress_timestamp = 1; // Oldest
        bookmarks[5].progress_timestamp = timestamp * 2; // Newest
        bookmarks[7].progress_timestamp = 10; // Second newest

        return bookmarks;
    }

    function dbTest(name: string, testWorker: (testAssert: QUnitAssert, db: Codevoid.Storyvoid.InstapaperDB) => WinJS.Promise<any>): void {
        promiseTest(name, (testAssert) => {
            return getDb().then(testWorker.bind(this, testAssert));
        });
    }

    QUnit.module("WhatToRead");

    QUnit.test("constructingWithoutDBInstanceThrows", (assert) => {
        assert.raises(() => {
            const instance = new Codevoid.Storyvoid.WhatToRead(null);
        });
    });

    dbTest("emptyDbReturnsNoGroups", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);
        return toRead.getStuffToRead().then((result) => {
            assert.ok(!!result, "Didn't get a result set");
            assert.strictEqual(result.length, 0, "Wrong number of groups");
        });
    });

    dbTest("canSortStandardDataIntoTwoGroups", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread);
        return addBookmarksToDb(originalBookmarks, db).then(() => {
            return toRead.getStuffToRead();
        }).then((result) => {
            assert.ok(!!result, "Didn't get a result set");
            assert.strictEqual(result.length, 2, "Wrong number of groups");

            const firstGroup = result[0];
            const secondGroup = result[1];

            // Basic info
            assert.strictEqual(firstGroup.name, "Recently Read", "First group had the wrong title");
            assert.ok(Array.isArray(firstGroup.bookmarks), "First group bookmarks didn't have an array");
            assert.strictEqual(firstGroup.bookmarks.length, 3, "Wrong number of bookmarks in first group");

            assert.strictEqual(secondGroup.name, "Recently Added", "Second group had the wrong title");
            assert.ok(Array.isArray(secondGroup.bookmarks), "Second group bookmarks didn't have an array");
            assert.strictEqual(secondGroup.bookmarks.length, 5, "Wrong number of bookmarks in Second group");

            // Check that stuff from 'read' isn't also in 'added'
            const readIds: { [id: number]: boolean } = [];
            firstGroup.bookmarks.forEach((item) => {
                readIds[item.bookmark_id] = true;
            });

            const bookmarksInBothReadAndAdded = secondGroup.bookmarks.filter((item) => {
                return readIds[item.bookmark_id];
            });

            assert.strictEqual(bookmarksInBothReadAndAdded.length, 0, "There were bookmarks found in both read & added; should be no overlap");
        });
    });

    dbTest("noItemsWithProgressReturnsOnlyAddedGroup", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread);
        originalBookmarks.forEach((item) => {
            item.progress_timestamp = 0;
        });

        return addBookmarksToDb(originalBookmarks, db).then(() => {
            return toRead.getStuffToRead();
        }).then((result) => {
            assert.ok(!!result, "Didn't get a result set");
            assert.strictEqual(result.length, 1, "Wrong number of groups");

            const firstGroup = result[0];

            assert.strictEqual(firstGroup.name, "Recently Added", "Group had the wrong title");
            assert.ok(Array.isArray(firstGroup.bookmarks), "Group bookmarks didn't have an array");
            assert.strictEqual(firstGroup.bookmarks.length, 5, "Wrong number of bookmarks in group");

            // Check that items don't have progress
            assert.ok(firstGroup.bookmarks.every((item) => (item.progress_timestamp === 0)), "Despite no progress group, items have progress");
        });
    });

    dbTest("onlyReadGroupReturnedWhenAllItemsHaveProgressButTotalDBContentCountIsAtLimitOfGroupSize", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);

        // Limit to only 5 items in the DB
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread).slice(0, 5);
        originalBookmarks.forEach((item) => {
            item.progress = 0.5;
            item.progress_timestamp = 1;
        });

        return addBookmarksToDb(originalBookmarks, db).then(() => {
            return toRead.getStuffToRead();
        }).then((result) => {
            assert.ok(!!result, "Didn't get a result set");
            assert.strictEqual(result.length, 1, "Wrong number of groups");

            const firstGroup = result[0];

            // Basic info
            assert.strictEqual(firstGroup.name, "Recently Read", "Group had the wrong title");
            assert.ok(Array.isArray(firstGroup.bookmarks), "Group bookmarks didn't have an array");
            assert.strictEqual(firstGroup.bookmarks.length, 5, "Wrong number of bookmarks in the group");
        });
    });

    // Filtering of recently read if there is an item that has been unpinned
    dbTest("itemsThatAreUnpinnedDoNotShowInRecentlyRead", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread);
        const firstBookmarkWithProgress = originalBookmarks.filter(bookmark => !!bookmark.progress_timestamp)[0];
        firstBookmarkWithProgress.doNotAddToJumpList = true;

        return addBookmarksToDb(originalBookmarks, db).then(() => {
            return toRead.getStuffToRead();
        }).then((result) => {
            assert.ok(!!result, "Didn't get a result set");
            assert.strictEqual(result.length, 2, "Wrong number of groups");

            const firstGroup = result[0];
            const secondGroup = result[1];

            assert.strictEqual(firstGroup.bookmarks.length, 2, "Wrong number of bookmarks in the group");
            assert.ok(firstGroup.bookmarks.every(b => b.bookmark_id !== firstBookmarkWithProgress.bookmark_id), "Found the bookmark that was unpinned");

            assert.strictEqual(secondGroup.bookmarks.length, 5, "Wrong number of bookmarks in second group");
            assert.ok(secondGroup.bookmarks.every(b => b.bookmark_id !== firstBookmarkWithProgress.bookmark_id), "Found book mark that was unpinned in second group");
        });
    });

    // Validation that the list thing has been converted to the jumplist
    // -- just look at the mutated list; maybe don't actually have to persist it?
    dbTest("conversionToJumpListCorrectlyHandlesExcludedItems", (assert, db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);

        // Save some stuff to the DB
        // -- Assume that works
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread);
        let itemFromFirstGroup: Codevoid.Storyvoid.IBookmark;
        let itemFromSecondGroup: Codevoid.Storyvoid.IBookmark;

        return addBookmarksToDb(originalBookmarks, db).then(() => toRead.getStuffToRead()).then((toReadGroups: Codevoid.Storyvoid.IReadGroup[]) => {
            const jumpListItems: Codevoid.Storyvoid.IJumpListItem[] = [];

            // Add items to the list
            toReadGroups.forEach((g, index) => {
                g.bookmarks.forEach((b) => {
                    const item: Codevoid.Storyvoid.IJumpListItem = {
                        arguments: "storyvoid://openarticle/?bookmark_id=" + b.bookmark_id,
                        removedByUser: false,
                    };

                    jumpListItems.push(item);

                    // Capture first bookmarks from each group
                    // and mark them as being removed _in the jump list_.
                    // Also save them off so we can check they're not found the next time.
                    if (index === 0 && !itemFromFirstGroup) {
                        itemFromFirstGroup = b;
                        item.removedByUser = true;
                    }

                    if (index === 1 && !itemFromSecondGroup) {
                        itemFromSecondGroup = b;
                        item.removedByUser = true;
                    }
                });
            });

            return (<IWhatToRead_ForTest>(<any>toRead))._refreshJumpListImpl(jumpListItems).then(() => {
                return WinJS.Promise.join({
                    items: jumpListItems,
                    itemsToRead: toRead.getStuffToRead(),
                });
            });
        }).then((result: { items: Codevoid.Storyvoid.IJumpListItem[], itemsToRead: Codevoid.Storyvoid.IReadGroup[] }) => {
            // Total jump list items
            assert.strictEqual(result.items.length, 7, "Only expected 7 items");

            assert.strictEqual(result.itemsToRead.length, 2, "Expected two groups");
            assert.strictEqual(result.itemsToRead[0].bookmarks.length, 2, "Recently read count wrong");
            assert.strictEqual(result.itemsToRead[1].bookmarks.length, 5, "Recently added count wrong");

            const firstItemFound = result.itemsToRead[0].bookmarks.some(item => item.bookmark_id !== itemFromFirstGroup.bookmark_id);
            assert.ok(firstItemFound, "Bookmark that was removed found in recently read");

            const secondItemFound = result.itemsToRead[1].bookmarks.some(item => item.bookmark_id !== itemFromSecondGroup.bookmark_id);
            assert.ok(secondItemFound, "Bookmark that was removed found in recently added");
        });
    });
}