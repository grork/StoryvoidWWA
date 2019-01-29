(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperApi Tests";

    var promiseTest = InstapaperTestUtilities.promiseTest;

    function failedPromiseHandler(req) {
        var message;
        if(req.error) {
            message = "Code: " + req.error + ", Message: " + req.message;
        } else if (req.responseText) {
            message = req.responseText;
        } else {
            message = req;
        }
        QUnit.assert.ok(false, "request failed: " + message);
        QUnit.start();
    }

    QUnit.module("instapaperApi");

    QUnit.module("instapaperApiAccounts");

    function canGetAccessToken() {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        QUnit.stop();
        accounts.getAccessToken("test@codevoid.net", "TestPassword").done(function (tokenInfo) {
            QUnit.assert.ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
            QUnit.assert.strictEqual(tokenInfo.oauth_token, token, "token didn't match");

            QUnit.assert.ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
            QUnit.assert.strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function canVerifyCredentials() {
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        QUnit.stop();
        accounts.verifyCredentials().done(function (verifiedCreds) {
            QUnit.assert.strictEqual(verifiedCreds.type, "user");
            QUnit.assert.strictEqual(verifiedCreds.user_id, 2154830);
            QUnit.assert.strictEqual(verifiedCreds.username, "test@codevoid.net");
            QUnit.start();
        }, failedPromiseHandler);
    }

    QUnit.test("canGetAccessToken", canGetAccessToken);

    promiseTest("can'tGetAccessTokenWhenUsingBadCredentials", function () {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret);
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        return accounts.getAccessToken("test@codevoid.net", "IncorrectPassword").then(function () {
            QUnit.assert.ok(false, "shouldn't succeed");
        }, function (err) {
            QUnit.assert.ok(true, "Should have errored");
            QUnit.assert.strictEqual(err.status, 401, "Expected auth failure");
        });
    });

    QUnit.test("canVerifyCredentials", canVerifyCredentials);

    promiseTest("verifyingBadCredentialsFails", function () {
        var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token + "3", secret + "a");
        var accounts = new Codevoid.Storyvoid.InstapaperApi.Accounts(clientInformation);

        return accounts.verifyCredentials().then(function () {
            QUnit.assert.ok(false, "Should have failed");
        }, function (err) {
            QUnit.assert.ok(true, "Shouldn't have succeeded");
            QUnit.assert.strictEqual(err.error, 403, "Should have failed with error 403");
        });
    });

    QUnit.module("instapaperApiBookmarksHaveConversion");

    function numberHaveReturnsString() {
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(12345);

        QUnit.assert.strictEqual(result, "12345", "Expected string back from function. Got something else");
    }

    function haveWithHashReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6" };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        QUnit.assert.strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
    }

    function haveWithProgressReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        QUnit.assert.strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
    }

    function haveWithProgressButNoProgressTimestampThrows() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

        QUnit.assert.raises(function () {
            Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);
        }, null, "no exception was thrown");
    }
    QUnit.test("numberHaveReturnsString", numberHaveReturnsString);
    QUnit.test("haveWithHashReturnsCorrectString", haveWithHashReturnsCorrectString);
    QUnit.test("haveWithProgressReturnsCorrectString", haveWithProgressReturnsCorrectString);
    QUnit.test("haveWithProgressButNoProgressTimestampThrows", haveWithProgressButNoProgressTimestampThrows);
    QUnit.test("haveWithZeroProgressAndValidTimestampReturnsString", function () {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 12344565 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        QUnit.assert.strictEqual(result, "1234:ABCDEF:0:12344565", "incorrect stringification of value");
    });

    QUnit.test("haveWithZeroProgressAndZeroTimestampHasNoProgressInformation", function () {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 0 };
        var result = Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have);

        QUnit.assert.strictEqual(result, "1234:ABCDEF", "incorrect stringification of value");
    });

    QUnit.module("instapaperApiBookmarks");

    QUnit.test("clearRemoteData", function () {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        InstapaperTestUtilities.destroyRemoteData(clientInformation).then(function () {
            return bookmarks.list();
        }).then(function (rb) {
            return Codevoid.Utilities.serialize(rb.bookmarks, function (item) {
                return bookmarks.deleteBookmark(item.bookmark_id);
            });
        }).then(function () {
            QUnit.assert.ok(true, "Deleted remote data");
            QUnit.start();
        }, failedPromiseHandler);
    });

    function addThrowsWhenNoUrl() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.assert.raises(function () {
            bookmarks.add({});
        }, function (ex) {
            return ex.message === "Requires URL";
        }, "Should throw if the URL isn't included");
    }

    function listIsEmpty() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list().done(function (data) {
            QUnit.assert.ok(data.meta, "Didn't get a meta object");
            QUnit.assert.ok(data.user, "Didn't get user object");
            QUnit.assert.ok(data.bookmarks, "Didn't get any bookmark data");
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            QUnit.start();
        }, failedPromiseHandler);
    }

    var justAddedId;
    var justAddedBookmark;

    function addAddsUrlReturnsCorrectObject() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
        QUnit.stop();
        bookmarks.add({ url: urlToAdd }).done(function (data) {
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            QUnit.assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(data.hash, "ZB6AejJM");
            QUnit.assert.strictEqual(data.starred, "0");
            QUnit.assert.strictEqual(data.progress, 0);

            justAddedId = data.bookmark_id;

            QUnit.start();
        }, failedPromiseHandler);
    }

    function addWithAdditionalParameters() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage2.html";
        var bookmarkToCleanup;

        QUnit.stop();
        bookmarks.add({ url: urlToAdd, title: "Custom Title", description: "Custom Description" }).then(function (data) {
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            QUnit.assert.strictEqual(data.title, "Custom Title", "title wasn't expected");
            QUnit.assert.strictEqual(data.description, "Custom Description");

            bookmarkToCleanup = data.bookmark_id;
        }).then(function cleanUp() {
            return bookmarks.deleteBookmark(bookmarkToCleanup);
        }).done(function () {
            QUnit.start();
        }, failedPromiseHandler);
    }

    function listShowsAddedBookmark() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list().done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            QUnit.assert.strictEqual(bookmarkData.type, "bookmark");
            QUnit.assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            QUnit.assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(bookmarkData.hash, "ZB6AejJM");
            QUnit.assert.strictEqual(bookmarkData.starred, "0");
            QUnit.assert.strictEqual(bookmarkData.progress, 0);
            QUnit.assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");

            justAddedBookmark = bookmarkData;
            QUnit.start();
        }, failedPromiseHandler);
    }

    function listShowsNoDataWithUptodateHaveData() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                hash: justAddedBookmark.hash,
            }]
        }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");

            QUnit.start();
        }, failedPromiseHandler);
    }

    var updatedProgressHash;
    function updateProgress() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 0.2, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() - 50 }).done(function (data) {
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.equal(data.progress, 0.2);
            updatedProgressHash = data.hash;

            QUnit.start();
        }, failedPromiseHandler);
    }

    function listWithHaveProgressInfoUpdatesProgress() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

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
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 1, "Expected updated item");

            if (data.bookmarks.length === 0) {
                QUnit.start();
                return;
            }

            var updatedBookmark = data.bookmarks[0];
            QUnit.assert.equal(updatedBookmark.progress, newProgress, "progress wasn't updated");
            QUnit.assert.notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");

            QUnit.start();
        }, failedPromiseHandler);
    }

    function updateProgressMoreThan1() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.assert.raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function updateProgressLessThan0() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.assert.raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function listInStarredFolderExpectingNoStarredItems() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function star() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.star(justAddedId).done(function (data) {
            QUnit.assert.equal(data.starred, 1, "Item should have been starred");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function listInStarredFolderExpectingSingleStarredItem() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            QUnit.assert.strictEqual(bookmarkData.type, "bookmark");
            QUnit.assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            QUnit.assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(bookmarkData.starred, "1");
            QUnit.assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function unstar() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.unstar(justAddedId).done(function (data) {
            QUnit.assert.equal(data.starred, 0, "Item shouldn't have been starred");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function listInArchiveFolderExpectingNoArchivedItems() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function archive() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.archive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact archived, so lets just validate it looks right
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(data.starred, "0");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function listInArchiveFolderExpectingSingleArchivedItem() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            QUnit.assert.strictEqual(bookmarkData.type, "bookmark");
            QUnit.assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            QUnit.assert.strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(bookmarkData.starred, "0");
            QUnit.assert.strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function unarchive() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.unarchive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact unarchived, so lets just validate it looks right
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.title, "TestPage1", "title wasn't expected");
            QUnit.assert.strictEqual(data.starred, "0");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function getText() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.getText(justAddedId).done(function (data) {
            QUnit.assert.ok(data, "Expected to get actual data back");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function getTextToDirectory() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();

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
            QUnit.assert.ok(storageFile, "Expected to get actual data back");
            openedFile = storageFile;

            return storageFile.getBasicPropertiesAsync();
        }).then(function (basicProperties) {
            QUnit.assert.notStrictEqual(basicProperties.size, 0, "Shouldn't have had file written to disk");

            return openedFile.deleteAsync();
        }).done(function() {
            QUnit.start();
        }, failedPromiseHandler);
    }

    function getTextToDirectoryForUnavailableBookmarkDoesntWriteFile() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var destinationDirectory = Windows.Storage.ApplicationData.current.temporaryFolder;
        var badBookmarkId;
        var targetFileName;

        QUnit.stop();

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
            QUnit.assert.ok(false, "didn't expect success for this bookmark");
        }, function () {
            return destinationDirectory.tryGetItemAsync(targetFileName);
        }).then(function (storageFile) {
            QUnit.assert.strictEqual(storageFile, null, "Didn't expect any storage file");

            // Clean up the shitty bookmark we added
            return bookmarks.deleteBookmark(badBookmarkId);
        }).done(function () {
            QUnit.start();
        }, failedPromiseHandler);
    }

    function getText_nonExistantBookmark() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.getText(justAddedId).done(function (data) {
            QUnit.assert.ok(false, "Expected failed handler to be called, not success");
            QUnit.start();
        }, function (e) {
            QUnit.assert.strictEqual(e.error, 1241, "Unexpected error code");
            QUnit.start();
        });
    }

    function getText_unavailableBookmark() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var badBookmarkId;

        QUnit.stop();

        // This URL isn't actually a valid URL, so should fail
        bookmarks.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then((bookmark) => {
            badBookmarkId = bookmark.bookmark_id;
            return bookmarks.getText(bookmark.bookmark_id);
        }).then((data) => {
            QUnit.assert.ok(false, "Expected failed handler to be called, not success");
        }, (e) => {
            QUnit.assert.strictEqual(e.error, 1550, "Unexpected error code");
        }).then(() => {
            return bookmarks.deleteBookmark(badBookmarkId);
        }).done(() => {
            QUnit.start();
        });
    }

    function deletedAddedUrl() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            QUnit.assert.ok(Array.isArray(data), "no data returned");
            QUnit.assert.strictEqual(data.length, 0, "Expected no elements in array");
            QUnit.start();
        }, failedPromiseHandler);
    }

    function deleteNonExistantUrl() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        QUnit.stop();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            QUnit.assert.ok(false, "expected failed eror handler to be called");
            QUnit.start();
        }, function (e) {
            QUnit.assert.strictEqual(e.error, 1241, "Unexpected error code");
            QUnit.start();
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

    function listDefaultShouldBeEmpty() {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        QUnit.stop();
        folders.list().done(function (folders) {
            QUnit.assert.ok(Array.isArray(folders), "Folders should have been an array");
            QUnit.assert.strictEqual(folders.length, 0, "Shouldn't have found any folders");

            QUnit.start();
        }, failedPromiseHandler);
    }

    function addNewFolder() {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        QUnit.stop();

        folders.add("folder").done(function (data) {
            QUnit.assert.strictEqual(data.title, "folder", "expected title to be that which was passed in");
            
            addedFolderId = data.folder_id;
            QUnit.start();
        }, failedPromiseHandler);
    }
    
    function addDuplicateFolderReturnsError() {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        QUnit.stop();

        var title = Codevoid.Storyvoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + "";

        folders.add(title).then(function () {
            return folders.add(title);
        }).done(function (data) {
            QUnit.assert.ok(false, "Shouldn't have been able to add the folder");
            QUnit.start();
        }, function (error) {
            QUnit.assert.strictEqual(error.error, 1251, "Incorrect error code");
            QUnit.start();
        });
    }

    function listWithAddedFolders() {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);

        QUnit.stop();
        folders.list().done(function (folders) {
            QUnit.assert.ok(Array.isArray(folders), "Folders should have been an array");
            QUnit.assert.strictEqual(folders.length, 2, "Shouldn't have found any folders");

            var foundFolderWithCorrectTitle = false;
            folders.forEach(function (folder) {
                if (folder.title === "folder") {
                    if (foundFolderWithCorrectTitle) {
                        QUnit.assert.ok(false, "Shouldn't have found more than 1 folder with title 'folder'");
                    }

                    foundFolderWithCorrectTitle = true;
                }
            });

            QUnit.assert.ok(foundFolderWithCorrectTitle, "folder title was incorrect");
            QUnit.start();
        }, failedPromiseHandler);
    }

    var bookmarkAddedToFolderId;
    function addToFolder() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage3.html";

        bookmarks.add({ url: urlToAdd, folder_id: addedFolderId }).done(function (data) {
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            QUnit.assert.strictEqual(data.title, "TestPage3", "title wasn't expected");
            QUnit.assert.strictEqual(data.starred, "0");
            QUnit.assert.strictEqual(data.progress, 0);

            bookmarkAddedToFolderId = data.bookmark_id;

            QUnit.start();
        }, failedPromiseHandler);

        QUnit.stop();
    }

    var bookmarkAddedToFolderId2;
    function moveBookmarkIntoFolder() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

        bookmarks.add({ url: urlToAdd }).then(function (data) {
            QUnit.assert.strictEqual(data.type, "bookmark");
            QUnit.assert.strictEqual(data.url, urlToAdd, "url wasn't the same");
            QUnit.assert.strictEqual(data.title, "TestPage4", "title wasn't expected");
            QUnit.assert.strictEqual(data.starred, "0");
            QUnit.assert.strictEqual(data.progress, 0);

            bookmarkAddedToFolderId2 = data.bookmark_id;

            return bookmarks.move({ bookmark_id: data.bookmark_id, destination: addedFolderId });
        }).done(function (bookmark) {
            QUnit.assert.strictEqual(bookmark.type, "bookmark");
            QUnit.assert.strictEqual(bookmark.url, urlToAdd, "url wasn't the same");
            QUnit.assert.strictEqual(bookmark.title, "TestPage4", "title wasn't expected");
            QUnit.assert.strictEqual(bookmark.starred, "0");
            QUnit.assert.strictEqual(bookmark.progress, 0);
            QUnit.assert.strictEqual(bookmark.bookmark_id, bookmarkAddedToFolderId2, "Incorrect bookmark returned from move");

            QUnit.start();
        }, failedPromiseHandler);

        QUnit.stop();
    }

    function listContentsOfAFolder() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.list({ folder_id: addedFolderId }).done(function (data) {
            QUnit.assert.ok(Array.isArray(data.bookmarks), "Expected an array of data")
            QUnit.assert.strictEqual(data.bookmarks.length, 2, "Didn't expect any pre-existing data");

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
            QUnit.assert.strictEqual(bookmarkData.type, "bookmark");
            QUnit.assert.strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage3.html", "url wasn't the same");
            QUnit.assert.strictEqual(bookmarkData.title, "TestPage3", "title wasn't expected");
            QUnit.assert.strictEqual(bookmarkData.bookmark_id, bookmarkAddedToFolderId, "Bookmark didn't match");

            QUnit.assert.strictEqual(bookmarkData2.type, "bookmark");
            QUnit.assert.strictEqual(bookmarkData2.url, "http://www.codevoid.net/articlevoidtest/TestPage4.html", "url wasn't the same");
            QUnit.assert.strictEqual(bookmarkData2.title, "TestPage4", "title wasn't expected");
            QUnit.assert.strictEqual(bookmarkData2.bookmark_id, bookmarkAddedToFolderId2, "Bookmark didn't match");

            QUnit.start();
        }, failedPromiseHandler);
    }

    function moveBookmarkOutOfArchive() {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        QUnit.stop();

        bookmarks.archive(bookmarkAddedToFolderId2).then(function() {
            return bookmarks.move({ bookmark_id: bookmarkAddedToFolderId2, destination: addedFolderId }).then(function () {
                return bookmarks.list({ folder_id: "archive" });
            });
        }).done(function (archivedBookmarks) {
            QUnit.assert.ok(archivedBookmarks.bookmarks, "Expected archived bookmarks");
            QUnit.assert.strictEqual(archivedBookmarks.bookmarks.length, 0, "Didn't expect to find any bookmarks");

            QUnit.start();
        }, failedPromiseHandler);
    }

    function deleteFolder() {
        var folders = new Codevoid.Storyvoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);

        // delete book mark 'cause it ends up in the archieve folder
        QUnit.stop();
        bookmarks.deleteBookmark(bookmarkAddedToFolderId).then(function () {
            return bookmarks.deleteBookmark(bookmarkAddedToFolderId2);
        }).then(function() {
            return folders.deleteFolder(addedFolderId);
        }).then(function (data) {
            QUnit.assert.ok(Array.isArray(data), "no data returned");
            QUnit.assert.strictEqual(data.length, 0, "Expected no elements in array");

            addedFolderId = null;
        }).done(function () {
            QUnit.start();
        }, failedPromiseHandler);
    }

    QUnit.test("listDefaultShouldBeEmpty", listDefaultShouldBeEmpty);
    QUnit.test("addnewFolder", addNewFolder);
    QUnit.test("addDuplicateFolderReturnsError", addDuplicateFolderReturnsError);
    QUnit.test("listWithAddedFolders", listWithAddedFolders);
    QUnit.test("addToFolder", addToFolder);
    QUnit.test("moveBookmarkIntoFolder", moveBookmarkIntoFolder);
    QUnit.test("listContentsOfAFolder", listContentsOfAFolder);
    QUnit.test("moveBookmarkToUnread", function () {
        var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

        QUnit.stop();
        
        bookmarks.archive(bookmarkAddedToFolderId2).then(function () {
            return bookmarks.add({ url: urlToAdd }).then(function () {
                return bookmarks.list();
            });
        }).done(function (unread) {
            QUnit.assert.ok(unread.bookmarks, "Expected archived bookmarks");
            QUnit.assert.strictEqual(unread.bookmarks.length, 1, "Didn't expect to find any bookmarks");
            QUnit.assert.strictEqual(unread.bookmarks[0].bookmark_id, bookmarkAddedToFolderId2, "Bookmark was incorrect");

            QUnit.start();
        }, failedPromiseHandler);
    });
    QUnit.test("moveBookmarkOutOfArchive", moveBookmarkOutOfArchive);
    QUnit.test("deleteFolder", deleteFolder);
})();