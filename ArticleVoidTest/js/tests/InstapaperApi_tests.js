(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);
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
        ok(false, "request failed: " + message);
        start();
    }

    module("instapaperApi");

    module("instapaperApiAccounts");

    function canGetAccessToken() {
        var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret);
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        stop();
        accounts.getAccessToken("test@codevoid.net", "TestPassword").done(function (tokenInfo) {
            ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
            strictEqual(tokenInfo.oauth_token, token, "token didn't match");

            ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
            strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");
            start();
        }, failedPromiseHandler);
    }

    function canVerifyCredentials() {
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        stop();
        accounts.verifyCredentials().done(function (verifiedCreds) {
            strictEqual(verifiedCreds.type, "user");
            strictEqual(verifiedCreds.user_id, 2154830);
            strictEqual(verifiedCreds.username, "test@codevoid.net");
            start();
        }, failedPromiseHandler);
    }

    test("canGetAccessToken", canGetAccessToken);

    promiseTest("can'tGetAccessTokenWhenUsingBadCredentials", function () {
        var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret);
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        return accounts.getAccessToken("test@codevoid.net", "IncorrectPassword").then(function () {
            ok(false, "shouldn't succeed");
        }, function (err) {
            ok(true, "Should have errored");
            strictEqual(err.status, 401, "Expected auth failure");
        });
    });

    test("canVerifyCredentials", canVerifyCredentials);

    promiseTest("verifyingBadCredentialsFails", function () {
        var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token + "3", secret + "a");
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        return accounts.verifyCredentials().then(function () {
            ok(false, "Should have failed");
        }, function (err) {
            ok(true, "Shouldn't have succeeded");
            strictEqual(err.error, 403, "Should have failed with error 403");
        });
    });

    test("nonSubscriptionAccountTokenAndHasNoActiveSub", function () {
        var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret);
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        stop();
        accounts.getAccessToken("test2@codevoid.net", "TestPassword").then(function (tokenInfo) {
            var accounts2 = new Codevoid.ArticleVoid.InstapaperApi.Accounts(
                new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, tokenInfo.oauth_token, tokenInfo.oauth_token_secret));
            return accounts2.verifyCredentials();
        }).done(function (userInfo) {
            strictEqual(userInfo.subscription_is_active, "0", "Subscription shouldn't be active");
            start();
        }, failedPromiseHandler);
    });

    promiseTest("canGetTokenAndSubscriberStatusForSubscriber", function () {
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);
        return accounts.getAccessTokenVerifyIsSubscriber("test@codevoid.net", "TestPassword").then(function (tokenInfo) {
            ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
            strictEqual(tokenInfo.oauth_token, token, "token didn't match");

            ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");
            strictEqual(tokenInfo.oauth_token_secret, secret, "Secret didn't match");

            ok(tokenInfo.hasOwnProperty("isSubscriber"), "Didn't have subscriber status");
        });
    });

    promiseTest("canGetTokenAndSubscriberStatusForNonSubscriber", function () {
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);
        return accounts.getAccessTokenVerifyIsSubscriber("test2@codevoid.net", "TestPassword").then(function (tokenInfo) {
            ok(tokenInfo.hasOwnProperty("oauth_token"), "no auth token property found");
            ok(tokenInfo.hasOwnProperty("oauth_token_secret"), "no auth token secret property found");

            ok(tokenInfo.hasOwnProperty("isSubscriber"), "Didn't have subscriber status");
        });
    });

    promiseTest("gettingAccessTokenVerifyIsSubscriberWithIncorrectCredentialsErrors", function () {
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);
        return accounts.getAccessTokenVerifyIsSubscriber("test2@codevoid.net", "IncorrectPassword").then(function (tokenInfo) {
            ok(false, "Should have failed");
        }, function (err) {
            ok(true, "Shouldn't have succeeded");
            strictEqual(err.status, 401, "Should have failed auth");
        });
    });

    module("instapaperApiBookmarksHaveConversion");

    function numberHaveReturnsString() {
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(12345);

        strictEqual(result, "12345", "Expected string back from function. Got something else");
    }

    function haveWithHashReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6" };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(have);

        strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
    }

    function haveWithProgressReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(have);

        strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
    }

    function haveWithProgressButNoProgressTimestampThrows() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

        raises(function () {
            Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(have);
        }, null, "no exception was thrown");
    }
    test("numberHaveReturnsString", numberHaveReturnsString);
    test("haveWithHashReturnsCorrectString", haveWithHashReturnsCorrectString);
    test("haveWithProgressReturnsCorrectString", haveWithProgressReturnsCorrectString);
    test("haveWithProgressButNoProgressTimestampThrows", haveWithProgressButNoProgressTimestampThrows);
    test("haveWithZeroProgressAndValidTimestampReturnsString", function () {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 12344565 };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(have);

        strictEqual(result, "1234:ABCDEF:0:12344565", "incorrect stringification of value");
    });

    test("haveWithZeroProgressAndZeroTimestampHasNoProgressInformation", function () {
        var have = { id: 1234, hash: "ABCDEF", progress: 0, progressLastChanged: 0 };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks.haveToString(have);

        strictEqual(result, "1234:ABCDEF", "incorrect stringification of value");
    });

    module("instapaperApiBookmarks");

    test("clearRemoteData", function () {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        InstapaperTestUtilities.destroyRemoteData(clientInformation).then(function () {
            return bookmarks.list();
        }).then(function (rb) {
            return Codevoid.Utilities.serialize(rb.bookmarks, function (item) {
                return bookmarks.deleteBookmark(item.bookmark_id);
            });
        }).then(function () {
            ok(true, "Deleted remote data");
            start();
        }, failedPromiseHandler);
    });

    function addThrowsWhenNoUrl() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        raises(function () {
            bookmarks.add({});
        }, function (ex) {
            return ex.message === "Requires URL";
        }, "Should throw if the URL isn't included");
    }

    var justAddedId;

    function listIsEmpty() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list().done(function (data) {
            ok(data.meta, "Didn't get a meta object");
            ok(data.user, "Didn't get user object");
            ok(data.bookmarks, "Didn't get any bookmark data");
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            start();
        }, failedPromiseHandler);
    }

    var justAddedBookmark;

    function addAddsUrlReturnsCorrectObject() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
        stop();
        bookmarks.add({ url: urlToAdd }).done(function (data) {
            strictEqual(data.type, "bookmark");
            strictEqual(data.url, urlToAdd, "url wasn't the same");
            strictEqual(data.title, "TestPage1", "title wasn't expected");
            strictEqual(data.hash, "ZB6AejJM");
            strictEqual(data.starred, "0");
            strictEqual(data.progress, 0);

            justAddedId = data.bookmark_id;

            start();
        }, failedPromiseHandler);
    }

    function addWithAdditionalParameters() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage2.html";
        var bookmarkToCleanup;

        stop();
        bookmarks.add({ url: urlToAdd, title: "Custom Title", description: "Custom Description" }).then(function (data) {
            strictEqual(data.type, "bookmark");
            strictEqual(data.url, urlToAdd, "url wasn't the same");
            strictEqual(data.title, "Custom Title", "title wasn't expected");
            strictEqual(data.description, "Custom Description");

            bookmarkToCleanup = data.bookmark_id;
        }).then(function cleanUp() {
            return bookmarks.deleteBookmark(bookmarkToCleanup);
        }).done(function () {
            start();
        }, failedPromiseHandler);
    }

    function listShowsAddedBookmark() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list().done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            strictEqual(bookmarkData.type, "bookmark");
            strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            strictEqual(bookmarkData.hash, "ZB6AejJM");
            strictEqual(bookmarkData.starred, "0");
            strictEqual(bookmarkData.progress, 0);
            strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");

            justAddedBookmark = bookmarkData;
            start();
        }, failedPromiseHandler);
    }

    function listShowsNoDataWithUptodateHaveData() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                hash: justAddedBookmark.hash,
            }]
        }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");

            start();
        }, failedPromiseHandler);
    }

    var updatedProgressHash;
    function updateProgress() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 0.2, progress_timestamp: Codevoid.ArticleVoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() - 50 }).done(function (data) {
            strictEqual(data.type, "bookmark");
            equal(data.progress, 0.2);
            updatedProgressHash = data.hash;

            start();
        }, failedPromiseHandler);
    }

    function listWithHaveProgressInfoUpdatesProgress() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        var newProgress = (Math.round(Math.random() * 100) / 100);

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                progress: newProgress,
                hash: "X", // Set hash to something random that causes the service to give us back the new hash.
                           // If we don't do this and hand up the "current" hash that we currently have, it updates
                           // the current state, but doesn't tell us that it recomputed the hash.
                progressLastChanged: Codevoid.ArticleVoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + 50
            }]
        }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 1, "Expected updated item");

            if (data.bookmarks.length === 0) {
                start();
                return;
            }

            var updatedBookmark = data.bookmarks[0];
            equal(updatedBookmark.progress, newProgress, "progress wasn't updated");
            notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");

            start();
        }, failedPromiseHandler);
    }

    function updateProgressMoreThan1() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Codevoid.ArticleVoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function updateProgressLessThan0() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Codevoid.ArticleVoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() });
        }, function (ex) {
            return ex.message === "Must have valid progress between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function listInStarredFolderExpectingNoStarredItems() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            start();
        }, failedPromiseHandler);
    }

    function star() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.star(justAddedId).done(function (data) {
            equal(data.starred, 1, "Item should have been starred");
            start();
        }, failedPromiseHandler);
    }

    function listInStarredFolderExpectingSingleStarredItem() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            strictEqual(bookmarkData.type, "bookmark");
            strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            strictEqual(bookmarkData.starred, "1");
            strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            start();
        }, failedPromiseHandler);
    }

    function unstar() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.unstar(justAddedId).done(function (data) {
            equal(data.starred, 0, "Item shouldn't have been starred");
            start();
        }, failedPromiseHandler);
    }

    function listInArchiveFolderExpectingNoArchivedItems() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 0, "Didn't expect any pre-existing data");
            start();
        }, failedPromiseHandler);
    }

    function archive() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.archive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact archived, so lets just validate it looks right
            strictEqual(data.type, "bookmark");
            strictEqual(data.title, "TestPage1", "title wasn't expected");
            strictEqual(data.starred, "0");
            start();
        }, failedPromiseHandler);
    }

    function listInArchiveFolderExpectingSingleArchivedItem() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: "archive" }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data.bookmarks[0];
            strictEqual(bookmarkData.type, "bookmark");
            strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage1.html", "url wasn't the same");
            strictEqual(bookmarkData.title, "TestPage1", "title wasn't expected");
            strictEqual(bookmarkData.starred, "0");
            strictEqual(bookmarkData.bookmark_id, justAddedId, "Bookmark didn't match");
            start();
        }, failedPromiseHandler);
    }

    function unarchive() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.unarchive(justAddedId).done(function (data) {
            // There is no information in the bookmark itself to indicate
            // that the item is in fact unarchived, so lets just validate it looks right
            strictEqual(data.type, "bookmark");
            strictEqual(data.title, "TestPage1", "title wasn't expected");
            strictEqual(data.starred, "0");
            start();
        }, failedPromiseHandler);
    }

    function getText() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.getText(justAddedId).done(function (data) {
            ok(data, "Expected to get actual data back");
            start();
        }, failedPromiseHandler);
    }

    function getText_nonExistantBookmark() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.getText(justAddedId).done(function (data) {
            ok(false, "Expected failed handler to be called, not success");
            start();
        }, function (e) {
            strictEqual(e.error, 1241, "Unexpected error code");
            start();
        });
    }

    function deletedAddedUrl() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            ok(Array.isArray(data), "no data returned");
            strictEqual(data.length, 0, "Expected no elements in array");
            start();
        }, failedPromiseHandler);
    }

    function deleteNonExistantUrl() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        stop();
        bookmarks.deleteBookmark(justAddedId).done(function (data) {
            ok(false, "expected failed eror handler to be called");
            start();
        }, function (e) {
            strictEqual(e.error, 1241, "Unexpected error code");
            start();
        });
    }

    test("listIsEmpty", listIsEmpty);
    test("addThrowsWhenNoUrl", addThrowsWhenNoUrl);
    test("addAddsUrlReturnsCorrectObject", addAddsUrlReturnsCorrectObject);
    test("listShowsAddedBookmark", listShowsAddedBookmark);
    test("listShowsNoDataWithUptodateHaveData", listShowsNoDataWithUptodateHaveData);
    test("updateProgress", updateProgress);
    test("listWithHaveProgressInfoUpdatesProgress", listWithHaveProgressInfoUpdatesProgress);
    test("updateProgressMoreThan1", updateProgressMoreThan1);
    test("updateProgressLessThan0", updateProgressLessThan0);
    test("listInStarredFolderExpectingNoStarredItems", listInStarredFolderExpectingNoStarredItems);
    test("star", star);
    test("listInStarredFolderExpectingSingleStarredItem", listInStarredFolderExpectingSingleStarredItem);
    test("unstar", unstar);
    test("listInStarredFolderExpectingNoStarredItemsAfterUnStarring", listInStarredFolderExpectingNoStarredItems);
    test("listInArchiveFolderExpectingNoArchivedItems", listInArchiveFolderExpectingNoArchivedItems);
    test("archive", archive);
    test("listInArchiveFolderExpectingSingleArchivedItem", listInArchiveFolderExpectingSingleArchivedItem);
    test("unarchive", unarchive);
    test("listInArchiveFolderExpectingNoArchivedItems2", listInArchiveFolderExpectingNoArchivedItems);
    test("getText", getText);
    test("deleteAddedUrl", deletedAddedUrl);
    test("deleteNonExistantUrl", deleteNonExistantUrl);
    test("getText_nonExistantBookmark", getText_nonExistantBookmark);
    test("addWithAdditionalParameters", addWithAdditionalParameters);

    module("instapaperApiFolderTests");
    // FOLDERS TESTS
    /*
     Delete Folder
     Re-order Folders?
     Add to a folder #
     move (Between folders) #
    */
    var addedFolderId;

    function listDefaultShouldBeEmpty() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        stop();
        folders.list().done(function (folders) {
            ok(Array.isArray(folders), "Folders should have been an array");
            strictEqual(folders.length, 0, "Shouldn't have found any folders");

            start();
        }, failedPromiseHandler);
    }

    function addNewFolder() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        stop();

        folders.add("folder").done(function (data) {
            strictEqual(data.title, "folder", "expected title to be that which was passed in");
            
            addedFolderId = data.folder_id;
            start();
        }, failedPromiseHandler);
    }
    
    function addDuplicateFolderReturnsError() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        stop();

        var title = Codevoid.ArticleVoid.InstapaperApi.getCurrentTimeAsUnixTimestamp() + "";

        folders.add(title).then(function () {
            return folders.add(title);
        }).done(function (data) {
            ok(false, "Shouldn't have been able to add the folder");
            start();
        }, function (error) {
            strictEqual(error.error, 1251, "Incorrect error code");
            start();
        });
    }

    function listWithAddedFolders() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        stop();
        folders.list().done(function (folders) {
            ok(Array.isArray(folders), "Folders should have been an array");
            strictEqual(folders.length, 2, "Shouldn't have found any folders");

            var foundFolderWithCorrectTitle = false;
            folders.forEach(function (folder) {
                if (folder.title === "folder") {
                    if (foundFolderWithCorrectTitle) {
                        ok(false, "Shouldn't have found more than 1 folder with title 'folder'");
                    }

                    foundFolderWithCorrectTitle = true;
                }
            });

            ok(foundFolderWithCorrectTitle, "folder title was incorrect");
            start();
        }, failedPromiseHandler);
    }

    var bookmarkAddedToFolderId;
    function addToFolder() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage3.html";

        bookmarks.add({ url: urlToAdd, folder_id: addedFolderId }).done(function (data) {
            strictEqual(data.type, "bookmark");
            strictEqual(data.url, urlToAdd, "url wasn't the same");
            strictEqual(data.title, "TestPage3", "title wasn't expected");
            strictEqual(data.starred, "0");
            strictEqual(data.progress, 0);

            bookmarkAddedToFolderId = data.bookmark_id;

            start();
        }, failedPromiseHandler);

        stop();
    }

    var bookmarkAddedToFolderId2;
    function moveBookmarkIntoFolder() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

        bookmarks.add({ url: urlToAdd }).then(function (data) {
            strictEqual(data.type, "bookmark");
            strictEqual(data.url, urlToAdd, "url wasn't the same");
            strictEqual(data.title, "TestPage4", "title wasn't expected");
            strictEqual(data.starred, "0");
            strictEqual(data.progress, 0);

            bookmarkAddedToFolderId2 = data.bookmark_id;

            return bookmarks.move({ bookmark_id: data.bookmark_id, destination: addedFolderId });
        }).done(function (bookmark) {
            strictEqual(bookmark.type, "bookmark");
            strictEqual(bookmark.url, urlToAdd, "url wasn't the same");
            strictEqual(bookmark.title, "TestPage4", "title wasn't expected");
            strictEqual(bookmark.starred, "0");
            strictEqual(bookmark.progress, 0);
            strictEqual(bookmark.bookmark_id, bookmarkAddedToFolderId2, "Incorrect bookmark returned from move");

            start();
        }, failedPromiseHandler);

        stop();
    }

    function listContentsOfAFolder() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: addedFolderId }).done(function (data) {
            ok(Array.isArray(data.bookmarks), "Expected an array of data")
            strictEqual(data.bookmarks.length, 2, "Didn't expect any pre-existing data");

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
            strictEqual(bookmarkData.type, "bookmark");
            strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage3.html", "url wasn't the same");
            strictEqual(bookmarkData.title, "TestPage3", "title wasn't expected");
            strictEqual(bookmarkData.bookmark_id, bookmarkAddedToFolderId, "Bookmark didn't match");

            strictEqual(bookmarkData2.type, "bookmark");
            strictEqual(bookmarkData2.url, "http://www.codevoid.net/articlevoidtest/TestPage4.html", "url wasn't the same");
            strictEqual(bookmarkData2.title, "TestPage4", "title wasn't expected");
            strictEqual(bookmarkData2.bookmark_id, bookmarkAddedToFolderId2, "Bookmark didn't match");

            start();
        }, failedPromiseHandler);
    }

    function moveBookmarkOutOfArchive() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.archive(bookmarkAddedToFolderId2).then(function() {
            return bookmarks.move({ bookmark_id: bookmarkAddedToFolderId2, destination: addedFolderId }).then(function () {
                return bookmarks.list({ folder_id: "archive" });
            });
        }).done(function (archivedBookmarks) {
            ok(archivedBookmarks.bookmarks, "Expected archived bookmarks");
            strictEqual(archivedBookmarks.bookmarks.length, 0, "Didn't expect to find any bookmarks");

            start();
        }, failedPromiseHandler);
    }

    function deleteFolder() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        // delete book mark 'cause it ends up in the archieve folder
        stop();
        bookmarks.deleteBookmark(bookmarkAddedToFolderId).then(function () {
            return bookmarks.deleteBookmark(bookmarkAddedToFolderId2);
        }).then(function() {
            return folders.deleteFolder(addedFolderId);
        }).then(function (data) {
            ok(Array.isArray(data), "no data returned");
            strictEqual(data.length, 0, "Expected no elements in array");

            addedFolderId = null;
        }).done(function () {
            start();
        }, failedPromiseHandler);
    }

    test("listDefaultShouldBeEmpty", listDefaultShouldBeEmpty);
    test("addnewFolder", addNewFolder);
    test("addDuplicateFolderReturnsError", addDuplicateFolderReturnsError);
    test("listWithAddedFolders", listWithAddedFolders);
    test("addToFolder", addToFolder);
    test("moveBookmarkIntoFolder", moveBookmarkIntoFolder);
    test("listContentsOfAFolder", listContentsOfAFolder);
    test("moveBookmarkToUnread", function () {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        var urlToAdd = "http://www.codevoid.net/articlevoidtest/TestPage4.html";

        stop();
        
        bookmarks.archive(bookmarkAddedToFolderId2).then(function () {
            return bookmarks.add({ url: urlToAdd }).then(function () {
                return bookmarks.list();
            });
        }).done(function (unread) {
            ok(unread.bookmarks, "Expected archived bookmarks");
            strictEqual(unread.bookmarks.length, 1, "Didn't expect to find any bookmarks");
            strictEqual(unread.bookmarks[0].bookmark_id, bookmarkAddedToFolderId2, "Bookmark was incorrect");

            start();
        }, failedPromiseHandler);
    });
    test("moveBookmarkOutOfArchive", moveBookmarkOutOfArchive);
    test("deleteFolder", deleteFolder);
})();