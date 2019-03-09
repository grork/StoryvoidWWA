namespace CodevoidTests {
    const clientID = "PLACEHOLDER";
    const clientSecret = "PLACEHOLDER";

    const token = "PLACEHOLDER";
    const secret = "PLACEHOLDER";

    const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperApi Tests";

    let justAddedId: number;
    let justAddedBookmark: Codevoid.Storyvoid.IBookmark;
    let updatedProgressHash: string;
    let addedFolderId: string;
    let bookmarkAddedToFolderId: number;
    let bookmarkAddedToFolderId2: number;

    async function listInStarredFolderExpectingNoStarredItems(): Promise<void> {
        const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const data = await bookmarks.list({ folder_id: "starred" });
        assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
        assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
    }

    async function listInArchiveFolderExpectingNoArchivedItems(): Promise<any> {
        const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const data = await bookmarks.list({ folder_id: "archive" });
        assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
        assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
    }

    describe("instapaperApi", () => {
        describe("instapaperApiAccounts", () => {
            it("canGetAccessToken", async () => {
                const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
                const accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                const tokenInfo = await accounts.getAccessToken("PLACEHOLDER", "PLACEHOLDER");
                assert.ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
                assert.strictEqual(tokenInfo.oauth_token, token, "token didn't match");

                assert.ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
                assert.strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");
            });

            it("can'tGetAccessTokenWhenUsingBadCredentials", async () => {
                const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
                const accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                try {
                    await accounts.getAccessToken("PLACEHOLDER", "IncorrectPassword");
                    assert.ok(false, "shouldn't succeed");
                } catch (err) {
                    assert.ok(true, "Should have errored");
                    assert.strictEqual(err.status, 401, "Expected auth failure");
                }
            });

            it("canVerifyCredentials", async () => {
                const accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);
                const verifiedCreds = await accounts.verifyCredentials();
                assert.strictEqual(verifiedCreds.type, "user");
                assert.strictEqual(verifiedCreds.user_id, PLACEHOLDER);
                assert.strictEqual(verifiedCreds.username, "PLACEHOLDER");
            });

            it("verifyingBadCredentialsFails", async () => {
                const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token + "3", secret + "a");
                const accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                try {
                    await accounts.verifyCredentials();
                    assert.ok(false, "Should have failed");
                } catch (err) {
                    assert.ok(true, "Shouldn't have succeeded");
                    assert.strictEqual(err.error, 403, "Should have failed with error 403");
                }
            });
        });

        describe("instapaperApiBookmarksHaveConversion", () => {

            it("numberHaveReturnsString", () => {
                const result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(12345);

                assert.strictEqual(result, "12345", "Expected string back from function. Got something else");
            });

            it("haveWithHashReturnsCorrectString", () => {
                const have = { id: 12345, hash: "OjMuzFp6" };
                const result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
            });

            it("haveWithProgressReturnsCorrectString", () => {
                const have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
                const result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
            });

            it("haveWithProgressButNoProgressTimestampThrows", () => {
                const have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

                assert.throws(() => Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have));
            });

            it("haveWithZeroProgressAndValidTimestampReturnsString", () => {
                const have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 12344565 };
                const result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "1234:ABCDEF:0:12344565", "incorrect stringification of value");
            });

            it("haveWithZeroProgressAndZeroTimestampHasNoProgressInformation", () => {
                const have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 0 };
                const result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "1234:ABCDEF", "incorrect stringification of value");
            });
        });

        describe("instapaperApiBookmarks", () => {
            it("clearRemoteData", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                await InstapaperTestUtilities.destroyRemoteAccountData(clientInformation);
                const rb = await bookmarks.list();
                await Codevoid.Utilities.serialize(rb.bookmarks, (item) => bookmarks.deleteBookmark(item.bookmark_id));
            });

            it("listIsEmpty", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list();
                assert.ok(data.meta, "Didn't get a meta object");
                assert.ok(data.user, "Didn't get user object");
                assert.ok(data.bookmarks, "Didn't get any bookmark data");
                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            });

            it("addThrowsWhenNoUrl", () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(
                    () => bookmarks.add(<any>{}),
                    (ex) => {
                        return ex.message === "Requires URL";
                    },
                    "Should throw if the URL isn't included"
                );
            });

            it("addAddsUrlReturnsCorrectObject", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage1.html";

                const data = await bookmarks.add({ url: urlToAdd });
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(data.hash, "ZB6AejJM");
                assert.strictEqual(data.starred, "0");
                assert.strictEqual(data.progress, 0);

                justAddedId = data.bookmark_id;
            });

            it("listShowsAddedBookmark", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list();
                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                // Validate the only bookmark
                const bookmarkData = data.bookmarks[0];
                assert.strictEqual(bookmarkData.type, "bookmark");
                assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(bookmarkData.hash, "ZB6AejJM");
                assert.strictEqual(bookmarkData.starred, "0");
                assert.strictEqual(bookmarkData.progress, 0);
                assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");

                justAddedBookmark = bookmarkData;
            });

            it("listShowsNoDataWithUptodateHaveData", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list({
                    have: [{
                        id: justAddedBookmark.bookmark_id,
                        hash: justAddedBookmark.hash,
                    }]
                });

                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            });

            it("updateProgress", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.updateReadProgress({
                    bookmark_id: justAddedId,
                    progress: 0.2,
                    progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() - 50
                });

                assert.strictEqual(data.type, "bookmark");
                assert.equal(data.progress, 0.2);
                updatedProgressHash = data.hash;
            });

            it("listWithHaveProgressInfoUpdatesProgress", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const newProgress = (Math.round(Math.random() * 100) / 100);

                const data = await bookmarks.list({
                    have: [{
                        id: justAddedBookmark.bookmark_id,
                        progress: newProgress,
                        hash: "X", // Set hash to something random that causes the service to give us back the new hash.
                        // If we don't do this and hand up the "current" hash that we currently have, it updates
                        // the current state, but doesn't tell us that it recomputed the hash.
                        progressLastChanged: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + 50
                    }]
                });

                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 1, "Expected updated item");

                if (data.bookmarks.length === 0) {
                    return;
                }

                const updatedBookmark = data.bookmarks[0];
                assert.equal(updatedBookmark.progress, newProgress, "progress wasn't updated");
                assert.notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");
            });

            it("updateProgressMoreThan1", () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(
                    () => bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() }),
                    (ex) => {
                        return ex.message === "Must have valid progress between 0.0 and 1.0";
                    },
                    "Should have failed with error on progress value");
            });

            it("updateProgressLessThan0", () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(
                    () => bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() }),
                    (ex) => {
                        return ex.message === "Must have valid progress between 0.0 and 1.0";
                    },
                    "Should have failed with error on progress value");
            });

            it("listInStarredFolderExpectingNoStarredItems", listInStarredFolderExpectingNoStarredItems);

            it("star", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.star(justAddedId);
                assert.equal(data.starred, 1, "Item should have been starred")
            });

            it("listInStarredFolderExpectingSingleStarredItem", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list({ folder_id: "starred" });
                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                // Validate the only bookmark
                const bookmarkData = data.bookmarks[0];
                assert.strictEqual(bookmarkData.type, "bookmark");
                assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(bookmarkData.starred, "1");
                assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            });

            it("unstar", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.unstar(justAddedId);
                assert.equal(data.starred, 0, "Item shouldn't have been starred");
            });

            it("listInStarredFolderExpectingNoStarredItemsAfterUnStarring", listInStarredFolderExpectingNoStarredItems);

            it("listInArchiveFolderExpectingNoArchivedItems", listInArchiveFolderExpectingNoArchivedItems);

            it("archive", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.archive(justAddedId);
                // There is no information in the bookmark itself to indicate
                // that the item is in fact archived, so lets just validate it looks right
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(data.starred, "0");
            });

            it("listInArchiveFolderExpectingSingleArchivedItem", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list({ folder_id: "archive" });
                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data");
                assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                // Validate the only bookmark
                const bookmarkData = data.bookmarks[0];
                assert.strictEqual(bookmarkData.type, "bookmark");
                assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(bookmarkData.starred, "0");
                assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            });

            it("unarchive", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.unarchive(justAddedId);
                // There is no information in the bookmark itself to indicate
                // that the item is in fact unarchived, so lets just validate it looks right
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                assert.strictEqual(data.starred, "0");
            });

            it("listInArchiveFolderExpectingNoArchivedItems2", listInArchiveFolderExpectingNoArchivedItems);

            it("getText", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.getText(justAddedId);
                assert.ok(data, "Expected to get actual data back");
            });

            it("getTextToDirectory", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
                const targetFileName = justAddedId + ".html";

                const fileToDelete = await destinationDirectory.tryGetItemAsync(targetFileName);
                if (fileToDelete) {
                    await fileToDelete.deleteAsync();
                }
                
                const openedFile = await bookmarks.getTextAndSaveToFileInDirectory(justAddedId, destinationDirectory);
                assert.ok(openedFile, "Expected to get actual data back");

                const basicProperties = await openedFile.getBasicPropertiesAsync();
                assert.notStrictEqual(basicProperties.size, 0, "Shouldn't have had file written to disk");

                await openedFile.deleteAsync();
            });

            it("getTextToDirectoryForUnavailableBookmarkDoesntWriteFile", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
                let badBookmarkId: number;
                let targetFileName: string;

                const bookmark = await bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" });
                targetFileName = bookmark.bookmark_id + ".html";
                badBookmarkId = bookmark.bookmark_id;

                const fileToDelete = await destinationDirectory.tryGetItemAsync(targetFileName);
                if (fileToDelete) {
                    await fileToDelete.deleteAsync();
                }

                try {
                    await bookmarks.getTextAndSaveToFileInDirectory(badBookmarkId, destinationDirectory);
                    assert.ok(false, "didn't expect success for this bookmark");
                } catch (e) {
                    const storageFile = await destinationDirectory.tryGetItemAsync(targetFileName);
                    assert.strictEqual(storageFile, null, "Didn't expect any storage file");
                }

                // Clean up the bad bookmark we added
                await bookmarks.deleteBookmark(badBookmarkId);
            });

            it("deleteAddedUrl", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.deleteBookmark(justAddedId);
                assert.ok(Array.isArray(data), "no data returned");
                assert.strictEqual(data.length, 0, "Expected no elements in array");
            });

            it("deleteNonExistantUrl", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                try {
                    await bookmarks.deleteBookmark(justAddedId);
                    assert.ok(false, "expected failed eror handler to be called");
                } catch (e) {
                    assert.strictEqual(e.error, 1241, "Unexpected error code")
                }
            });

            it("getText_nonExistantBookmark", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                try {
                    await bookmarks.getText(justAddedId);
                    assert.ok(false, "Expected failed handler to be called, not success");
                } catch (e) {
                    assert.strictEqual(e.error, 1241, "Unexpected error code");
                }
            });

            it("getText_unavailableBookmark", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                let badBookmarkId: number;

                // This URL isn't actually a valid URL, so should fail
                const bookmark = await bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" });
                badBookmarkId = bookmark.bookmark_id;

                try {
                    await bookmarks.getText(bookmark.bookmark_id);
                    assert.ok(false, "Expected failed handler to be called, not success");
                } catch (e) {
                    assert.strictEqual(e.error, 1550, "Unexpected error code");
                }

                await bookmarks.deleteBookmark(badBookmarkId);
            });

            it("addWithAdditionalParameters", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage2.html";
                let bookmarkToCleanup: number;

                const data = await bookmarks.add({ url: urlToAdd, title: "Custom Title", description: "Custom Description" });
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                assert.strictEqual(data.title, "Custom Title", "title wasn't expected");
                assert.strictEqual(data.description, "Custom Description");

                bookmarkToCleanup = data.bookmark_id;

                await bookmarks.deleteBookmark(bookmarkToCleanup);
            });
        });

        describe("instapaperApiFolderTests", () => {
            // FOLDERS TESTS
            /*
             Delete Folder
             Re-order Folders?
             Add to a folder #
             move (Between folders) #
            */

            it("listDefaultShouldBeEmpty", async () => {
                const foldersApi = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                const folders = await foldersApi.list();
                assert.ok(Array.isArray(folders), "Folders should have been an array");
                assert.strictEqual(folders.length, 0, "Shouldn't have found any folders");
            });

            it("addnewFolder", async () => {
                const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

                const data = await folders.add("folder");
                assert.strictEqual(data.title, "folder", "expected title to be that which was passed in");

                addedFolderId = data.folder_id;
            });

            it("addDuplicateFolderReturnsError", async () => {
                const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                const title = Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + "";

                await folders.add(title);
                
                try {
                    await folders.add(title);
                    assert.ok(false, "Shouldn't have been able to add the folder");
                } catch (error) {
                    assert.strictEqual(error.error, 1251, "Incorrect error code")
                }
            });

            it("listWithAddedFolders", async () => {
                const foldersApi = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

                const folders = await foldersApi.list();
                assert.ok(Array.isArray(folders), "Folders should have been an array");
                assert.strictEqual(folders.length, 2, "Shouldn't have found any folders");

                let foundFolderWithCorrectTitle = false;
                folders.forEach((folder) => {
                    if (folder.title === "folder") {
                        if (foundFolderWithCorrectTitle) {
                            assert.ok(false, "Shouldn't have found more than 1 folder with title 'folder'");
                        }

                        foundFolderWithCorrectTitle = true;
                    }
                });

                assert.ok(foundFolderWithCorrectTitle, "folder title was incorrect");
            });

            it("addToFolder", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage3.html";

                const data = await bookmarks.add({ url: urlToAdd, folder_id: addedFolderId });
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                assert.strictEqual(data.title, "TestPage3", "title wasn't expected");
                assert.strictEqual(data.starred, "0");
                assert.strictEqual(data.progress, 0);

                bookmarkAddedToFolderId = data.bookmark_id;
            });

            it("moveBookmarkIntoFolder", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

                const data = await bookmarks.add({ url: urlToAdd });
                assert.strictEqual(data.type, "bookmark");
                assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                assert.strictEqual(data.title, "TestPage4", "title wasn't expected");
                assert.strictEqual(data.starred, "0");
                assert.strictEqual(data.progress, 0);

                bookmarkAddedToFolderId2 = data.bookmark_id;

                const bookmark = await bookmarks.move({ bookmark_id: data.bookmark_id, destination: addedFolderId });
                assert.strictEqual(bookmark.type, "bookmark");
                assert.strictEqual(bookmark.url, urlToAdd, "url wasn't the same");
                assert.strictEqual(bookmark.title, "TestPage4", "title wasn't expected");
                assert.strictEqual(bookmark.starred, "0");
                assert.strictEqual(bookmark.progress, 0);
                assert.strictEqual(bookmark.bookmark_id, bookmarkAddedToFolderId2, "Incorrect bookmark returned from move");
            });

            it("listContentsOfAFolder", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                const data = await bookmarks.list({ folder_id: addedFolderId });
                assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                assert.strictEqual(data.bookmarks.length, 2, "Didn't expect any pre-existing data");

                let bookmarkData;
                let bookmarkData2;

                data.bookmarks.forEach((bookmark) => {
                    if (bookmark.bookmark_id === bookmarkAddedToFolderId) {
                        bookmarkData = bookmark;
                    } else if (bookmark.bookmark_id === bookmarkAddedToFolderId2) {
                        bookmarkData2 = bookmark;
                    }
                });

                // Validate the only bookmark
                assert.strictEqual(bookmarkData.type, "bookmark");
                assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage3.html", "url wasn't the same");
                assert.strictEqual(bookmarkData.title, "TestPage3", "title wasn't expected");
                assert.strictEqual(bookmarkData.bookmark_id, bookmarkAddedToFolderId, "Bookmark didn't match");

                assert.strictEqual(bookmarkData2.type, "bookmark");
                assert.strictEqual(bookmarkData2.url, "http://www.codevoid.net/articlevoidtest/TestPage4.html", "url wasn't the same");
                assert.strictEqual(bookmarkData2.title, "TestPage4", "title wasn't expected");
                assert.strictEqual(bookmarkData2.bookmark_id, bookmarkAddedToFolderId2, "Bookmark didn't match");
            });

            it("moveBookmarkToUnread", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                const urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

                await bookmarks.archive(bookmarkAddedToFolderId2);
                await bookmarks.add({ url: urlToAdd });

                const unread = await bookmarks.list();
                assert.ok(unread.bookmarks, "Expected archived bookmarks");
                assert.strictEqual(unread.bookmarks.length, 1, "Didn't expect to find any bookmarks");
                assert.strictEqual(unread.bookmarks[0].bookmark_id, bookmarkAddedToFolderId2, "Bookmark was incorrect");
            });

            it("moveBookmarkOutOfArchive", async () => {
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                await bookmarks.archive(bookmarkAddedToFolderId2);
                await bookmarks.move({ bookmark_id: bookmarkAddedToFolderId2, destination: addedFolderId });

                const archivedBookmarks = await bookmarks.list({ folder_id: "archive" });
                assert.ok(archivedBookmarks.bookmarks, "Expected archived bookmarks");
                assert.strictEqual(archivedBookmarks.bookmarks.length, 0, "Didn't expect to find any bookmarks");
            });

            it("deleteFolder", async () => {
                const folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                const bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                // delete book mark 'cause it ends up in the archieve folder
                await bookmarks.deleteBookmark(bookmarkAddedToFolderId);
                await bookmarks.deleteBookmark(bookmarkAddedToFolderId2);

                const data = await folders.deleteFolder(addedFolderId);
                assert.ok(Array.isArray(data), "no data returned");
                assert.strictEqual(data.length, 0, "Expected no elements in array");

                addedFolderId = null;
            });
        });
    });
}