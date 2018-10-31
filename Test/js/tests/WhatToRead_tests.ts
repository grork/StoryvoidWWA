/// <reference path="..\..\..\app\js\WhatToRead.ts" />

module CodevoidTests.WhatToReadTests {
    const promiseTest = InstapaperTestUtilities.promiseTest;

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
        return WinJS.Promise.join(adds).then(() => {});
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
        bookmarks[3].progress_timestamp = -1; // Oldest
        bookmarks[5].progress_timestamp = timestamp * 2; // Newest
        bookmarks[7].progress_timestamp = 10; // Second newest

        return bookmarks;
    }

    function dbTest(name: string, testWorker: (db: Codevoid.Storyvoid.InstapaperDB) => WinJS.Promise<any>): void {
        promiseTest(name, () => {
            return getDb().then(testWorker);
        });
    }

    QUnit.module("WhatToRead");

    test("constructingWithoutDBInstanceThrows", () => {
        raises(() => {
            const instance = new Codevoid.Storyvoid.WhatToRead(null);
        });
    });

    dbTest("canSortStandardDataIntoTwoGroups", (db) => {
        const toRead = new Codevoid.Storyvoid.WhatToRead(db);
        const originalBookmarks = getSampleBookmarks(db.commonFolderDbIds.unread);
        return addBookmarksToDb(originalBookmarks, db).then(() => {
            return toRead.getStuffToRead();
        }).then((result) => {
            ok(!!result, "Didn't get a result set");
            strictEqual(result.length, 2, "Wrong number of groups");

            const firstGroup = result[0];
            const secondGroup = result[1];

            // Basic info
            strictEqual(firstGroup.name, "Recently Read", "First group had the wrong title");
            ok(Array.isArray(firstGroup.bookmarks), "First group bookmarks didn't have an array");
            strictEqual(firstGroup.bookmarks.length, 5, "Wrong number of bookmarks in first group");

            strictEqual(secondGroup.name, "Recently Added", "Second group had the wrong title");
            ok(Array.isArray(secondGroup.bookmarks), "Second group bookmarks didn't have an array");
            strictEqual(secondGroup.bookmarks.length, 5, "Wrong number of bookmarks in Second group");

            // Check that stuff from 'read' isn't also in 'added'
            const readIds: { [id: number]: boolean } = [];
            firstGroup.bookmarks.forEach((item) => {
                readIds[item.bookmark_id] = true;
            });

            const bookmarksInBothReadAndAdded = secondGroup.bookmarks.filter((item) => {
                return readIds[item.bookmark_id];
            });

            strictEqual(bookmarksInBothReadAndAdded.length, 0, "There were bookmarks found in both read & added; should be no overlap");
        });
    });

}