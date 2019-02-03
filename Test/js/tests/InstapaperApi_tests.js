(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperApi Tests";

    var promiseTest = InstapaperTestUtilities.promiseTest;

    function getFailedPromiseHandler(failureAssert, complete) {
        return function failedPromiseHandler(req) {
            var message;
            if (req.error) {
                message = "Code: " + req.error + ", Message: " + req.message;
            } else if (req.responseText) {
                message = req.responseText;
            } else {
                message = req;
            }

            failureAssert.ok(false, "request failed: " + message);
            complete();
        }
    }

    QUnit.module("instapaperApi");

    QUnit.module("instapaperApiAccounts");

    function canGetAccessToken(assert) {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        const complete = assert.async();
        accounts.getAccessToken("test@codevoid.net", "TestPassword").done(function (tokenInfo) {
            assert.ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
            assert.strictEqual(tokenInfo.oauth_token, token, "token didn't match");

            assert.ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
            assert.strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function canVerifyCredentials(assert) {
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        const complete = assert.async();
        accounts.verifyCredentials().done(function (verifiedCreds) {
            assert.strictEqual(verifiedCreds.type, "user");
            assert.strictEqual(verifiedCreds.user_id, 2154830);
            assert.strictEqual(verifiedCreds.username, "test@codevoid.net");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    QUnit.test("canGetAccessToken", canGetAccessToken);

    promiseTest("can'tGetAccessTokenWhenUsingBadCredentials", function (assert) {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        return accounts.getAccessToken("test@codevoid.net", "IncorrectPassword").then(function () {
            assert.ok(false, "shouldn't succeed");
        }, function (err) {
            assert.ok(true, "Should have errored");
            assert.strictEqual(err.status, 401, "Expected auth failure");
        });
    });

    QUnit.test("canVerifyCredentials", canVerifyCredentials);

    promiseTest("verifyingBadCredentialsFails", function (assert) {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token + "3", secret + "a");
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        return accounts.verifyCredentials().then(function () {
            assert.ok(false, "Should have failed");
        }, function (err) {
            assert.ok(true, "Shouldn't have succeeded");
            assert.strictEqual(err.error, 403, "Should have failed with error 403");
        });
    });

    QUnit.module("instapaperApiBookmarksHaveConversion");

    function numberHaveReturnsString(assert) {
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(12345);

        assert.strictEqual(result, "12345", "Expected string back from function. Got something else");
    }

    function haveWithHashReturnsCorrectString(assert) {
        var have = { id: 12345, hash: "OjMuzFp6" };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        assert.strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
    }

    function haveWithProgressReturnsCorrectString(assert) {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        assert.strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
    }

    function haveWithProgressButNoProgressTimestampThrows(assert) {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

        assert.raises(function () {
            Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);
        }, null, "no exception was thrown");
    }
    QUnit.test("numberHaveReturnsString", numberHaveReturnsString);
    QUnit.test("haveWithHashReturnsCorrectString", haveWithHashReturnsCorrectString);
    QUnit.test("haveWithProgressReturnsCorrectString", haveWithProgressReturnsCorrectString);
    QUnit.test("haveWithProgressButNoProgressTimestampThrows", haveWithProgressButNoProgressTimestampThrows);
    QUnit.test("haveWithZeroProgressAndValidTimestampReturnsString", function (assert) {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 12344565 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        assert.strictEqual(result, "1234:ABCDEF:0:12344565", "incorrect stringification of value");
    });

    QUnit.test("haveWithZeroProgressAndZeroTimestampHasNoProgressInformation", function (assert) {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 0 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        assert.strictEqual(result, "1234:ABCDEF", "incorrect stringification of value");
    });

    QUnit.module("instapaperApiBookmarks");

    QUnit.test("clearRemoteData", function (assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        InstapaperTestUtilities.destroyRemoteData(assert, clientInformation).then(function () {
            return bookmarks.list();
        }).then(function (rb) {
            return Codevoid.Utilities.serialize(rb.bookmarks, function (item) {
                return bookmarks.deleteBookmark(item.bookmark_id);
            });
        }).then(function () {
            assert.ok(true, "Deleted remote data");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    });

    function addThrowsWhenNoUrl(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        assert.raises(function () {
            bookmarks.add({});
        }, function (ex) {
            return ex.message === "Requires URL";
        }, "Should throw if the URL isn't included");
    }

    function listIsEmpty(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list().done(function (data) {
            assert.ok(data.meta, "Didn't get a meta object");
            assert.ok(data.user, "Didn't get user object");
            assert.ok(data.bookmarks, "Didn't get any bookmark data");
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    var justAddedId;
    var justAddedBookmark;

    function addAddsUrlReturnsCorrectObject(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
        const complete = assert.async();
        bookmarks.add({ url: urlToAdd }).done(function (data) {
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            assert.strictEqual(data.hash, "ZB6AejJM");
            assert.strictEqual(data.starred, "0");
            assert.strictEqual(data.progress, 0);

            justAddedId = data.bookmark_id;

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function addWithAdditionalParameters(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage2.html";
        var bookmarkToCleanup;

        const complete = assert.async();
        bookmarks.add({ url: urlToAdd, title: "Custom Title", description: "Custom Description" }).then(function (data) {
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            assert.strictEqual(data.title, "Custom Title", "title wasn't expected");
            assert.strictEqual(data.description, "Custom Description");

            bookmarkToCleanup = data.bookmark_id;
        }).then(function cleanUp() {
            return bookmarks.deleteBookmark(bookmarkToCleanup);
        }).done(function () {
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listShowsAddedBookmark(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list().done(function (data) {
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
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listShowsNoDataWithUptodateHaveData(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                hash: justAddedBookmark.hash,
            }]
        }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    var updatedProgressHash;
    function updateProgress(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 0.2, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() - 50 }).done(function (data) {
            assert.strictEqual(data.type, "bookmark");
            assert.equal(data.progress, 0.2);
            updatedProgressHash = data.hash;

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listWithHaveProgressInfoUpdatesProgress(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        var newProgress = (Math.round(Math.random() * 100) / 100);

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                progress: newProgress,
                hash: "X", // Set hash to something random that causes the service to give us back the new hash.
                           // If we don't do this and hand up the "current" hash that we currently have, it updates
                           // the current state, but doesn't tell us that it recomputed the hash.
                progressLastChanged: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + 50
            }]
        }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 1, "Expected updated item");

            if (data.bookmarks.length === 0) {
                complete();
                return;
            }

            var updatedBookmark = data.bookmarks[0];
            assert.equal(updatedBookmark.progress, newProgress, "progress wasn't updated");
            assert.notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function updateProgressMoreThan1(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        assert.raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function updateProgressLessThan0(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        assert.raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function listInStarredFolderExpectingNoStarredItems(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function star(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.star(justAddedId).done(function (data) {
            assert.equal(data.starred, 1, "Item should have been starred");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listInStarredFolderExpectingSingleStarredItem(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            assert.strictEqual(bookmarkData.type, "bookmark");
            assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            assert.strictEqual(bookmarkData.starred, "1");
            assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function unstar(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.unstar(justAddedId).done(function (data) {
            assert.equal(data.starred, 0, "Item shouldn't have been starred");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listInArchiveFolderExpectingNoArchivedItems(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function archive(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.archive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact archived, so lets just validate it looks right
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            assert.strictEqual(data.starred, "0");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listInArchiveFolderExpectingSingleArchivedItem(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            assert.strictEqual(bookmarkData.type, "bookmark");
            assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            assert.strictEqual(bookmarkData.starred, "0");
            assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function unarchive(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.unarchive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact unarchived, so lets just validate it looks right
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            assert.strictEqual(data.starred, "0");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function getText(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.getText(justAddedId).done(function (data) {
            assert.ok(data, "Expected to get actual data back");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function getTextToDirectory(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();

        var destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
        var targetFileName = justAddedId + ".html";
        var openedFile;

        destinationDirectory.tryGetItemAsync(targetFileName).then(function (fileToDelete) {
            if (!fileToDelete) {
                return;
            }

            return fileToDelete.deleteAsync();
        }).then(function() {
            return bookmarks.getTextAndSaveToFileInDirectory(justAddedId, destinationDirectory);
        }).then(function (storageFile) {
            assert.ok(storageFile, "Expected to get actual data back");
            openedFile = storageFile;

            return storageFile.getBasicPropertiesAsync();
        }).then(function (basicProperties) {
            assert.notStrictEqual(basicProperties.size, 0, "Shouldn't have had file written to disk");

            return openedFile.deleteAsync();
        }).done(function() {
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function getTextToDirectoryForUnavailableBookmarkDoesntWriteFile(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
        var badBookmarkId;
        var targetFileName;

        const complete = assert.async();

        bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then(function(bookmark) {
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

            // Clean up the shitty bookmark we added
            return bookmarks.deleteBookmark(badBookmarkId);
        }).done(function () {
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function getText_nonExistantBookmark(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.getText(justAddedId).done(function (data) {
            assert.ok(false, "Expected failed handler to be called, not success");
            complete();
        }, function (e) {
            assert.strictEqual(e.error, 1241, "Unexpected error code");
            complete();
        });
    }

    function getText_unavailableBookmark(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var badBookmarkId;

        const complete = assert.async();

        // This URL isn't actually a valid URL, so should fail
        bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then((bookmark) => {
            badBookmarkId = bookmark.bookmark_id;
            return bookmarks.getText(bookmark.bookmark_id);
        }).then((data) => {
            assert.ok(false, "Expected failed handler to be called, not success");
        }, (e) => {
            assert.strictEqual(e.error, 1550, "Unexpected error code");
        }).then(() => {
            return bookmarks.deleteBookmark(badBookmarkId);
        }).done(() => {
            complete();
        });
    }

    function deletedAddedUrl(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            assert.ok(Array.isArray(data), "no data returned");
            assert.strictEqual(data.length, 0, "Expected no elements in array");
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function deleteNonExistantUrl(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        const complete = assert.async();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            assert.ok(false, "expected failed eror handler to be called");
            complete();
        }, function (e) {
            assert.strictEqual(e.error, 1241, "Unexpected error code");
            complete();
        });
    }

    QUnit.test("listIsEmpty", listIsEmpty);
    QUnit.test("addThrowsWhenNoUrl", addThrowsWhenNoUrl);
    QUnit.test("addAddsUrlReturnsCorrectObject", addAddsUrlReturnsCorrectObject);
    QUnit.test("listShowsAddedBookmark", listShowsAddedBookmark);
    QUnit.test("listShowsNoDataWithUptodateHaveData", listShowsNoDataWithUptodateHaveData);
    QUnit.test("updateProgress", updateProgress);
    QUnit.test("listWithHaveProgressInfoUpdatesProgress", listWithHaveProgressInfoUpdatesProgress);
    QUnit.test("updateProgressMoreThan1", updateProgressMoreThan1);
    QUnit.test("updateProgressLessThan0", updateProgressLessThan0);
    QUnit.test("listInStarredFolderExpectingNoStarredItems", listInStarredFolderExpectingNoStarredItems);
    QUnit.test("star", star);
    QUnit.test("listInStarredFolderExpectingSingleStarredItem", listInStarredFolderExpectingSingleStarredItem);
    QUnit.test("unstar", unstar);
    QUnit.test("listInStarredFolderExpectingNoStarredItemsAfterUnStarring", listInStarredFolderExpectingNoStarredItems);
    QUnit.test("listInArchiveFolderExpectingNoArchivedItems", listInArchiveFolderExpectingNoArchivedItems);
    QUnit.test("archive", archive);
    QUnit.test("listInArchiveFolderExpectingSingleArchivedItem", listInArchiveFolderExpectingSingleArchivedItem);
    QUnit.test("unarchive", unarchive);
    QUnit.test("listInArchiveFolderExpectingNoArchivedItems2", listInArchiveFolderExpectingNoArchivedItems);
    QUnit.test("getText", getText);
    QUnit.test("getTextToDirectory", getTextToDirectory);
    QUnit.test("getTextToDirectoryForUnavailableBookmarkDoesntWriteFile", getTextToDirectoryForUnavailableBookmarkDoesntWriteFile);
    QUnit.test("deleteAddedUrl", deletedAddedUrl);
    QUnit.test("deleteNonExistantUrl", deleteNonExistantUrl);
    QUnit.test("getText_nonExistantBookmark", getText_nonExistantBookmark);
    QUnit.test("getText_unavailableBookmark", getText_unavailableBookmark);
    QUnit.test("addWithAdditionalParameters", addWithAdditionalParameters);

    QUnit.module("instapaperApiFolderTests");
    // FOLDERS TESTS
    /*
     Delete Folder
     Re-order Folders?
     Add to a folder #
     move (Between folders) #
    */
    var addedFolderId;

    function listDefaultShouldBeEmpty(assert) {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        const complete = assert.async();
        folders.list().done(function (folders) {
            assert.ok(Array.isArray(folders), "Folders should have been an array");
            assert.strictEqual(folders.length, 0, "Shouldn't have found any folders");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function addNewFolder(assert) {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        const complete = assert.async();

        folders.add("folder").done(function (data) {
            assert.strictEqual(data.title, "folder", "expected title to be that which was passed in");
            
            addedFolderId = data.folder_id;
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }
    
    function addDuplicateFolderReturnsError(assert) {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        const complete = assert.async();

        var title = Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + "";

        folders.add(title).then(function () {
            return folders.add(title);
        }).done(function (data) {
            assert.ok(false, "Shouldn't have been able to add the folder");
            complete();
        }, function (error) {
            assert.strictEqual(error.error, 1251, "Incorrect error code");
            complete();
        });
    }

    function listWithAddedFolders(assert) {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        const complete = assert.async();
        folders.list().done(function (folders) {
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
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    var bookmarkAddedToFolderId;
    function addToFolder(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage3.html";
        const complete = assert.async();

        bookmarks.add({ url: urlToAdd, folder_id: addedFolderId }).done(function (data) {
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            assert.strictEqual(data.title, "TestPage3", "title wasn't expected");
            assert.strictEqual(data.starred, "0");
            assert.strictEqual(data.progress, 0);

            bookmarkAddedToFolderId = data.bookmark_id;

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    var bookmarkAddedToFolderId2;
    function moveBookmarkIntoFolder(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";
        const complete = assert.async();

        bookmarks.add({ url: urlToAdd }).then(function (data) {
            assert.strictEqual(data.type, "bookmark");
            assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            assert.strictEqual(data.title, "TestPage4", "title wasn't expected");
            assert.strictEqual(data.starred, "0");
            assert.strictEqual(data.progress, 0);

            bookmarkAddedToFolderId2 = data.bookmark_id;

            return bookmarks.move({ bookmark_id: data.bookmark_id, destination: addedFolderId });
        }).done(function (bookmark) {
            assert.strictEqual(bookmark.type, "bookmark");
            assert.strictEqual(bookmark.url, urlToAdd, "url wasn't the same");
            assert.strictEqual(bookmark.title, "TestPage4", "title wasn't expected");
            assert.strictEqual(bookmark.starred, "0");
            assert.strictEqual(bookmark.progress, 0);
            assert.strictEqual(bookmark.bookmark_id, bookmarkAddedToFolderId2, "Incorrect bookmark returned from move");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function listContentsOfAFolder(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.list({ folder_id: addedFolderId }).done(function (data) {
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

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function moveBookmarkOutOfArchive(assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        const complete = assert.async();

        bookmarks.archive(bookmarkAddedToFolderId2).then(function() {
            return bookmarks.move({ bookmark_id: bookmarkAddedToFolderId2, destination: addedFolderId }).then(function () {
                return bookmarks.list({ folder_id: "archive" });
            });
        }).done(function (archivedBookmarks) {
            assert.ok(archivedBookmarks.bookmarks, "Expected archived bookmarks");
            assert.strictEqual(archivedBookmarks.bookmarks.length, 0, "Didn't expect to find any bookmarks");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    function deleteFolder(assert) {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        // delete book mark 'cause it ends up in the archieve folder
        const complete = assert.async();
        bookmarks.deleteBookmark(bookmarkAddedToFolderId).then(function () {
            return bookmarks.deleteBookmark(bookmarkAddedToFolderId2);
        }).then(function() {
            return folders.deleteFolder(addedFolderId);
        }).then(function (data) {
            assert.ok(Array.isArray(data), "no data returned");
            assert.strictEqual(data.length, 0, "Expected no elements in array");

            addedFolderId = null;
        }).done(function () {
            complete();
        }, getFailedPromiseHandler(assert, complete));
    }

    QUnit.test("listDefaultShouldBeEmpty", listDefaultShouldBeEmpty);
    QUnit.test("addnewFolder", addNewFolder);
    QUnit.test("addDuplicateFolderReturnsError", addDuplicateFolderReturnsError);
    QUnit.test("listWithAddedFolders", listWithAddedFolders);
    QUnit.test("addToFolder", addToFolder);
    QUnit.test("moveBookmarkIntoFolder", moveBookmarkIntoFolder);
    QUnit.test("listContentsOfAFolder", listContentsOfAFolder);
    QUnit.test("moveBookmarkToUnread", function (assert) {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

        const complete = assert.async();
        
        bookmarks.archive(bookmarkAddedToFolderId2).then(function () {
            return bookmarks.add({ url: urlToAdd }).then(function () {
                return bookmarks.list();
            });
        }).done(function (unread) {
            assert.ok(unread.bookmarks, "Expected archived bookmarks");
            assert.strictEqual(unread.bookmarks.length, 1, "Didn't expect to find any bookmarks");
            assert.strictEqual(unread.bookmarks[0].bookmark_id, bookmarkAddedToFolderId2, "Bookmark was incorrect");

            complete();
        }, getFailedPromiseHandler(assert, complete));
    });
    QUnit.test("moveBookmarkOutOfArchive", moveBookmarkOutOfArchive);
    QUnit.test("deleteFolder", deleteFolder);
})();