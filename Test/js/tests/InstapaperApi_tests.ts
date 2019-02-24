(function () {
    "use strict";

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperApi Tests";

    var justAddedId;
    var justAddedBookmark;
    var updatedProgressHash;
    var addedFolderId;
    var bookmarkAddedToFolderId;
    var bookmarkAddedToFolderId2;

    function failedPromiseHandler(req) {
        var message;
        if (req.error) {
            message = "Code: " + req.error + ", Message: " + req.message;
        } else if (req.responseText) {
            message = req.responseText;
        } else {
            message = req;
        }

        assert.ok(false, "request failed: " + message);
    }

    function listInStarredFolderExpectingNoStarredItems() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return bookmarks.list({ folder_id: "starred" }).then(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
        }, failedPromiseHandler);
    }

    function listInArchiveFolderExpectingNoArchivedItems() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        return bookmarks.list({ folder_id: "archive" }).then(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
        }, failedPromiseHandler);
    }

    describe("instapaperApi", function () {

        describe("instapaperApiAccounts", function () {

            it("canGetAccessToken", function canGetAccessToken() {
                var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
                var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                return accounts.getAccessToken("PLACEHOLDER", "PLACEHOLDER").then(function (tokenInfo) {
                    assert.ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
                    assert.strictEqual(tokenInfo.oauth_token, token, "token didn't match");

                    assert.ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
                    assert.strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");
                }, failedPromiseHandler);
            });

            it("can'tGetAccessTokenWhenUsingBadCredentials", function () {
                var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
                var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                return accounts.getAccessToken("PLACEHOLDER", "IncorrectPassword").then(function () {
                    assert.ok(false, "shouldn't succeed");
                }, function (err) {
                    assert.ok(true, "Should have errored");
                    assert.strictEqual(err.status, 401, "Expected auth failure");
                });
            });

            it("canVerifyCredentials", function canVerifyCredentials() {
                var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                return accounts.verifyCredentials().then(function (verifiedCreds) {
                    assert.strictEqual(verifiedCreds.type, "user");
                    assert.strictEqual(verifiedCreds.user_id, PLACEHOLDER);
                    assert.strictEqual(verifiedCreds.username, "PLACEHOLDER");
                }, failedPromiseHandler);
            });

            it("verifyingBadCredentialsFails", function () {
                var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token + "3", secret + "a");
                var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

                return accounts.verifyCredentials().then(function () {
                    assert.ok(false, "Should have failed");
                }, function (err) {
                    assert.ok(true, "Shouldn't have succeeded");
                    assert.strictEqual(err.error, 403, "Should have failed with error 403");
                });
            });
        });

        describe("instapaperApiBookmarksHaveConversion", function () {

            it("numberHaveReturnsString", function numberHaveReturnsString() {
                var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(12345);

                assert.strictEqual(result, "12345", "Expected string back from function. Got something else");
            });

            it("haveWithHashReturnsCorrectString", function haveWithHashReturnsCorrectString() {
                var have = { id: 12345, hash: "OjMuzFp6" };
                var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
            });

            it("haveWithProgressReturnsCorrectString", function haveWithProgressReturnsCorrectString() {
                var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
                var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
            });

            it("haveWithProgressButNoProgressTimestampThrows", function haveWithProgressButNoProgressTimestampThrows() {
                var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

                assert.throws(function () {
                    Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);
                });
            });

            it("haveWithZeroProgressAndValidTimestampReturnsString", function () {
                var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 12344565 };
                var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "1234:ABCDEF:0:12344565", "incorrect stringification of value");
            });

            it("haveWithZeroProgressAndZeroTimestampHasNoProgressInformation", function () {
                var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 0 };
                var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

                assert.strictEqual(result, "1234:ABCDEF", "incorrect stringification of value");
            });
        });

        describe("instapaperApiBookmarks", function () {

            it("clearRemoteData", function () {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return InstapaperTestUtilities.destroyRemoteAccountData(clientInformation).then(function () {
                    return bookmarks.list();
                }).then(function (rb) {
                    return Codevoid.Utilities.serialize(rb.bookmarks, function (item) {
                        return bookmarks.deleteBookmark(item.bookmark_id);
                    });
                }).then(function () {
                    assert.ok(true, "Deleted remote data");
                }, failedPromiseHandler);
            });

            it("listIsEmpty", function listIsEmpty() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                
                return bookmarks.list().then(function (data) {
                    assert.ok(data.meta, "Didn't get a meta object");
                    assert.ok(data.user, "Didn't get user object");
                    assert.ok(data.bookmarks, "Didn't get any bookmark data");
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
                }, failedPromiseHandler);
            });

            it("addThrowsWhenNoUrl", function addThrowsWhenNoUrl() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(function () {
                    bookmarks.add(<any>{});
                }, function (ex) {
                    return ex.message === "Requires URL";
                }, "Should throw if the URL isn't included");
            });

            it("addAddsUrlReturnsCorrectObject", function addAddsUrlReturnsCorrectObject() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
                
                return bookmarks.add({ url: urlToAdd }).then(function (data) {
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                    assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(data.hash, "ZB6AejJM");
                    assert.strictEqual(data.starred, "0");
                    assert.strictEqual(data.progress, 0);

                    justAddedId = data.bookmark_id;
                }, failedPromiseHandler);
            });

            it("listShowsAddedBookmark", function listShowsAddedBookmark() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.list().then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                    // Validate the only bookmark
                    var bookmarkData = data.bookmarks[0];
                    assert.strictEqual(bookmarkData.type, "bookmark");
                    assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                    assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(bookmarkData.hash, "ZB6AejJM");
                    assert.strictEqual(bookmarkData.starred, "0");
                    assert.strictEqual(bookmarkData.progress, 0);
                    assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");

                    justAddedBookmark = bookmarkData;
                }, failedPromiseHandler);
            });

            it("listShowsNoDataWithUptodateHaveData", function listShowsNoDataWithUptodateHaveData() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.list({
                    have: [{
                        id: justAddedBookmark.bookmark_id,
                        hash: justAddedBookmark.hash,
                    }]
                }).then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
                }, failedPromiseHandler);
            });

            it("updateProgress", function updateProgress() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 0.2, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() - 50 }).then(function (data) {
                    assert.strictEqual(data.type, "bookmark");
                    assert.equal(data.progress, 0.2);
                    updatedProgressHash = data.hash;
                }, failedPromiseHandler);
            });

            it("listWithHaveProgressInfoUpdatesProgress", function listWithHaveProgressInfoUpdatesProgress() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var newProgress = (Math.round(Math.random() * 100) / 100);

                return bookmarks.list({
                    have: [{
                        id: justAddedBookmark.bookmark_id,
                        progress: newProgress,
                        hash: "X", // Set hash to something random that causes the service to give us back the new hash.
                        // If we don't do this and hand up the "current" hash that we currently have, it updates
                        // the current state, but doesn't tell us that it recomputed the hash.
                        progressLastChanged: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + 50
                    }]
                }).then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 1, "Expected updated item");

                    if (data.bookmarks.length === 0) {
                        return;
                    }

                    var updatedBookmark = data.bookmarks[0];
                    assert.equal(updatedBookmark.progress, newProgress, "progress wasn't updated");
                    assert.notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");
                }, failedPromiseHandler);
            });

            it("updateProgressMoreThan1", function updateProgressMoreThan1() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(function () {
                    bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
                }, function (ex) {
                    return ex.message === "Must have valid progress between 0.0 and 1.0";
                }, "Should have failed with error on progress value");
            });

            it("updateProgressLessThan0", function updateProgressLessThan0() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                assert.throws(function () {
                    bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
                }, function (ex) {
                    return ex.message === "Must have valid progress between 0.0 and 1.0";
                }, "Should have failed with error on progress value");
            });

            it("listInStarredFolderExpectingNoStarredItems", listInStarredFolderExpectingNoStarredItems);

            it("star", function star() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.star(justAddedId).then(function (data) {
                    assert.equal(data.starred, 1, "Item should have been starred");
                }, failedPromiseHandler);
            });

            it("listInStarredFolderExpectingSingleStarredItem", function listInStarredFolderExpectingSingleStarredItem() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.list({ folder_id: "starred" }).then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                    // Validate the only bookmark
                    var bookmarkData = data.bookmarks[0];
                    assert.strictEqual(bookmarkData.type, "bookmark");
                    assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                    assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(bookmarkData.starred, "1");
                    assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
                }, failedPromiseHandler);
            });

            it("unstar", function unstar() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.unstar(justAddedId).then(function (data) {
                    assert.equal(data.starred, 0, "Item shouldn't have been starred");
                }, failedPromiseHandler);
            });

            it("listInStarredFolderExpectingNoStarredItemsAfterUnStarring", listInStarredFolderExpectingNoStarredItems);

            it("listInArchiveFolderExpectingNoArchivedItems", listInArchiveFolderExpectingNoArchivedItems);

            it("archive", function archive() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.archive(justAddedId).then(function (data) {
                    // There is no information in the bookmark itself to indicate
                    // that the item is in fact archived, so lets just validate it looks right
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(data.starred, "0");
                }, failedPromiseHandler);
            });

            it("listInArchiveFolderExpectingSingleArchivedItem", function listInArchiveFolderExpectingSingleArchivedItem() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.list({ folder_id: "archive" }).then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

                    // Validate the only bookmark
                    var bookmarkData = data.bookmarks[0];
                    assert.strictEqual(bookmarkData.type, "bookmark");
                    assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
                    assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(bookmarkData.starred, "0");
                    assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
                }, failedPromiseHandler);
            });

            it("unarchive", function unarchive() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.unarchive(justAddedId).then(function (data) {
                    // There is no information in the bookmark itself to indicate
                    // that the item is in fact unarchived, so lets just validate it looks right
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
                    assert.strictEqual(data.starred, "0");
                }, failedPromiseHandler);
            });

            it("listInArchiveFolderExpectingNoArchivedItems2", listInArchiveFolderExpectingNoArchivedItems);

            it("getText", function getText() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.getText(justAddedId).then(function (data) {
                    assert.ok(data, "Expected to get actual data back");
                }, failedPromiseHandler);
            });

            it("getTextToDirectory", function getTextToDirectory() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                var destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
                var targetFileName = justAddedId + ".html";
                var openedFile;

                return destinationDirectory.tryGetItemAsync(targetFileName).then(function (fileToDelete) {
                    if (!fileToDelete) {
                        return;
                    }

                    return fileToDelete.deleteAsync();
                }).then(function () {
                    return bookmarks.getTextAndSaveToFileInDirectory(justAddedId, destinationDirectory);
                }).then(function (storageFile) {
                    assert.ok(storageFile, "Expected to get actual data back");
                    openedFile = storageFile;

                    return storageFile.getBasicPropertiesAsync();
                }).then(function (basicProperties) {
                    assert.notStrictEqual(basicProperties.size, 0, "Shouldn't have had file written to disk");

                    return openedFile.deleteAsync();
                }).then(null, failedPromiseHandler);
            });

            it("getTextToDirectoryForUnavailableBookmarkDoesntWriteFile", function getTextToDirectoryForUnavailableBookmarkDoesntWriteFile() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
                var badBookmarkId;
                var targetFileName;

                return bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then(function (bookmark) {
                    targetFileName = bookmark.bookmark_id + ".html";
                    badBookmarkId = bookmark.bookmark_id;

                    return destinationDirectory.tryGetItemAsync(targetFileName);
                }).then(function (fileToDelete) {
                    if (!fileToDelete) {
                        return;
                    }

                    return fileToDelete.deleteAsync();
                }).then(function () {
                    return bookmarks.getTextAndSaveToFileInDirectory(badBookmarkId, destinationDirectory);
                }).then(function () {
                    assert.ok(false, "didn't expect success for this bookmark");
                }, function () {
                    return destinationDirectory.tryGetItemAsync(targetFileName);
                }).then(function (storageFile) {
                    assert.strictEqual(storageFile, null, "Didn't expect any storage file");

                    // Clean up the bad bookmark we added
                    return bookmarks.deleteBookmark(badBookmarkId);
                }).then(null, failedPromiseHandler);
            });

            it("deleteAddedUrl", function deletedAddedUrl() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.deleteBookmark(justAddedId).then(function (data) {
                    assert.ok(Array.isArray(data), "no data returned");
                    assert.strictEqual(data.length, 0, "Expected no elements in array");
                }, failedPromiseHandler);
            });

            it("deleteNonExistantUrl", function deleteNonExistantUrl() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.deleteBookmark(justAddedId).then(function (data) {
                    assert.ok(false, "expected failed eror handler to be called");
                }, function (e) {
                    assert.strictEqual(e.error, 1241, "Unexpected error code");
                });
            });

            it("getText_nonExistantBookmark", function getText_nonExistantBookmark() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.getText(justAddedId).then(function (data) {
                    assert.ok(false, "Expected failed handler to be called, not success");
                }, function (e) {
                    assert.strictEqual(e.error, 1241, "Unexpected error code");
                });
            });

            it("getText_unavailableBookmark", function getText_unavailableBookmark() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var badBookmarkId;

                // This URL isn't actually a valid URL, so should fail
                return bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then((bookmark) => {
                    badBookmarkId = bookmark.bookmark_id;
                    return bookmarks.getText(bookmark.bookmark_id);
                }).then((data) => {
                    assert.ok(false, "Expected failed handler to be called, not success");
                }, (e) => {
                    assert.strictEqual(e.error, 1550, "Unexpected error code");
                }).then(() => {
                    return bookmarks.deleteBookmark(badBookmarkId);
                });
            });

            it("addWithAdditionalParameters", function addWithAdditionalParameters() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage2.html";
                var bookmarkToCleanup;

                return bookmarks.add({ url: urlToAdd, title: "Custom Title", description: "Custom Description" }).then(function (data) {
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                    assert.strictEqual(data.title, "Custom Title", "title wasn't expected");
                    assert.strictEqual(data.description, "Custom Description");

                    bookmarkToCleanup = data.bookmark_id;
                }).then(function cleanUp() {
                    return bookmarks.deleteBookmark(bookmarkToCleanup);
                }).then(null, failedPromiseHandler);
            });

        });

        describe("instapaperApiFolderTests", function () {
            // FOLDERS TESTS
            /*
             Delete Folder
             Re-order Folders?
             Add to a folder #
             move (Between folders) #
            */

            it("listDefaultShouldBeEmpty", function listDefaultShouldBeEmpty() {
                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                
                return folders.list().then(function (folders) {
                    assert.ok(Array.isArray(folders), "Folders should have been an array");
                    assert.strictEqual(folders.length, 0, "Shouldn't have found any folders");
                }, failedPromiseHandler);
            });

            it("addnewFolder", function addNewFolder() {
                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                
                return folders.add("folder").then(function (data) {
                    assert.strictEqual(data.title, "folder", "expected title to be that which was passed in");

                    addedFolderId = data.folder_id;
                }, failedPromiseHandler);
            });

            it("addDuplicateFolderReturnsError", function addDuplicateFolderReturnsError() {
                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                var title = Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + "";
                
                return folders.add(title).then(function () {
                    return folders.add(title);
                }).then(function (data) {
                    assert.ok(false, "Shouldn't have been able to add the folder");
                }, function (error) {
                    assert.strictEqual(error.error, 1251, "Incorrect error code");
                });
            });

            it("listWithAddedFolders", function listWithAddedFolders() {
                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                
                return folders.list().then(function (folders) {
                    assert.ok(Array.isArray(folders), "Folders should have been an array");
                    assert.strictEqual(folders.length, 2, "Shouldn't have found any folders");

                    var foundFolderWithCorrectTitle = false;
                    folders.forEach(function (folder) {
                        if (folder.title === "folder") {
                            if (foundFolderWithCorrectTitle) {
                                assert.ok(false, "Shouldn't have found more than 1 folder with title 'folder'");
                            }

                            foundFolderWithCorrectTitle = true;
                        }
                    });

                    assert.ok(foundFolderWithCorrectTitle, "folder title was incorrect");
                }, failedPromiseHandler);
            });

            it("addToFolder", function addToFolder() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage3.html";
                
                return bookmarks.add({ url: urlToAdd, folder_id: addedFolderId }).then(function (data) {
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                    assert.strictEqual(data.title, "TestPage3", "title wasn't expected");
                    assert.strictEqual(data.starred, "0");
                    assert.strictEqual(data.progress, 0);

                    bookmarkAddedToFolderId = data.bookmark_id;
                }, failedPromiseHandler);
            });

            it("moveBookmarkIntoFolder", function moveBookmarkIntoFolder() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";
                
                return bookmarks.add({ url: urlToAdd }).then(function (data) {
                    assert.strictEqual(data.type, "bookmark");
                    assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
                    assert.strictEqual(data.title, "TestPage4", "title wasn't expected");
                    assert.strictEqual(data.starred, "0");
                    assert.strictEqual(data.progress, 0);

                    bookmarkAddedToFolderId2 = data.bookmark_id;

                    return bookmarks.move({ bookmark_id: data.bookmark_id, destination: addedFolderId });
                }).then(function (bookmark) {
                    assert.strictEqual(bookmark.type, "bookmark");
                    assert.strictEqual(bookmark.url, urlToAdd, "url wasn't the same");
                    assert.strictEqual(bookmark.title, "TestPage4", "title wasn't expected");
                    assert.strictEqual(bookmark.starred, "0");
                    assert.strictEqual(bookmark.progress, 0);
                    assert.strictEqual(bookmark.bookmark_id, bookmarkAddedToFolderId2, "Incorrect bookmark returned from move");
                }, failedPromiseHandler);
            });

            it("listContentsOfAFolder", function listContentsOfAFolder() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                
                return bookmarks.list({ folder_id: addedFolderId }).then(function (data) {
                    assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
                    assert.strictEqual(data.bookmarks.length, 2, "Didn't expect any pre-existing data");

                    var bookmarkData;
                    var bookmarkData2;

                    data.bookmarks.forEach(function (bookmark) {
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
                }, failedPromiseHandler);
            });

            it("moveBookmarkToUnread", function () {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
                var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";
                
                return bookmarks.archive(bookmarkAddedToFolderId2).then(function () {
                    return bookmarks.add({ url: urlToAdd }).then(function () {
                        return bookmarks.list();
                    });
                }).then(function (unread) {
                    assert.ok(unread.bookmarks, "Expected archived bookmarks");
                    assert.strictEqual(unread.bookmarks.length, 1, "Didn't expect to find any bookmarks");
                    assert.strictEqual(unread.bookmarks[0].bookmark_id, bookmarkAddedToFolderId2, "Bookmark was incorrect");
                }, failedPromiseHandler);
            });

            it("moveBookmarkOutOfArchive", function moveBookmarkOutOfArchive() {
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                return bookmarks.archive(bookmarkAddedToFolderId2).then(function () {
                    return bookmarks.move({ bookmark_id: bookmarkAddedToFolderId2, destination: addedFolderId }).then(function () {
                        return bookmarks.list({ folder_id: "archive" });
                    });
                }).then(function (archivedBookmarks) {
                    assert.ok(archivedBookmarks.bookmarks, "Expected archived bookmarks");
                    assert.strictEqual(archivedBookmarks.bookmarks.length, 0, "Didn't expect to find any bookmarks");
                }, failedPromiseHandler);
            });

            it("deleteFolder", function deleteFolder() {
                var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
                var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

                // delete book mark 'cause it ends up in the archieve folder
                return bookmarks.deleteBookmark(bookmarkAddedToFolderId).then(function () {
                    return bookmarks.deleteBookmark(bookmarkAddedToFolderId2);
                }).then(function () {
                    return folders.deleteFolder(addedFolderId);
                }).then(function (data) {
                    assert.ok(Array.isArray(data), "no data returned");
                    assert.strictEqual(data.length, 0, "Expected no elements in array");

                    addedFolderId = null;
                }).then(null, failedPromiseHandler);
            });
        });
    });
})();