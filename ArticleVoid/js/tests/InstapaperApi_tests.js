﻿(function () {
    "use strict";

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, token, secret);
    function failedPromiseHandler(req) {
        ok(false, "request failed: " + req.responseText);
        start();
    }

    module("instapaperApi");

    function canGetAccessToken() {
        var clientInformation = new Codevoid.OAuth.ClientInfomation(clientID, clientSecret);
        var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(clientInformation);

        stop();
        accounts.getAccessToken("PLACEHOLDER", "PLACEHOLDER").done(function (tokenInfo) {
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
            strictEqual(verifiedCreds.subscription_is_active, "1", "Subscription not marked as active");
            strictEqual(verifiedCreds.type, "user");
            strictEqual(verifiedCreds.user_id, PLACEHOLDER);
            strictEqual(verifiedCreds.username, "PLACEHOLDER");
            start();
        }, failedPromiseHandler);
    }


    test("canGetAccessToken", canGetAccessToken);
    test("canVerifyCredentials", canVerifyCredentials);

    module("instapaperApiBookmarksHaveConversion");

    function numberHaveReturnsString() {
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks._convertHaveObjectToString(12345);

        strictEqual(result, "12345", "Expected string back from function. Got something else");
    }

    function haveWithHashReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6" };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks._convertHaveObjectToString(have);

        strictEqual(result, "12345:OjMuzFp6", "Incorrect stringification of have value");
    }

    function haveWithProgressReturnsCorrectString() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5, progressLastChanged: 1288584076 };
        var result = Codevoid.ArticleVoid.InstapaperApi.Bookmarks._convertHaveObjectToString(have);

        strictEqual(result, "12345:OjMuzFp6:0.5:1288584076", "Incorrect stringification of have value");
    }

    function haveWithProgressButNoProgressTimestampThrows() {
        var have = { id: 12345, hash: "OjMuzFp6", progress: 0.5 };

        raises(function () {
            Codevoid.ArticleVoid.InstapaperApi.Bookmarks._convertHaveObjectToString(have);
        }, null, "no exception was thrown");
    }
    test("numberHaveReturnsString", numberHaveReturnsString);
    test("haveWithHashReturnsCorrectString", haveWithHashReturnsCorrectString);
    test("haveWithProgressReturnsCorrectString", haveWithProgressReturnsCorrectString);
    test("haveWithProgressButNoProgressTimestampThrows", haveWithProgressButNoProgressTimestampThrows);

    module("instapaperApiBookmarks");

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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 0, "Didn't expect any pre-existing data");
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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data[0];
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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 0, "Didn't expect any pre-existing data");

            start();
        }, failedPromiseHandler);
    }

    var updatedProgressHash;
    function updateProgress() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 0.98, progress_timestamp: Date.now() }).done(function (data) {
            strictEqual(data.type, "bookmark");
            equal(data.progress, 0.98);
            updatedProgressHash = data.hash;

            start();
        }, failedPromiseHandler);
    }

    function listWithHaveProgressInfoUpdatesProgress() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({
            have: [{
                id: justAddedBookmark.bookmark_id,
                hash: updatedProgressHash,
                progress: 0.5,
                progressLastChanged: Date.now()
            }]
        }).done(function (data) {
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 1, "Expected updated item");

            var updatedBookmark = data[0];
            equal(updatedBookmark.progress, 0.5, "progress wasn't updated");
            notStrictEqual(updatedBookmark.hash, updatedProgressHash, "Hash should have changed");

            start();
        }, failedPromiseHandler);
    }

    function updateProgressMoreThan1() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: 1.1, progress_timestamp: Date.now() });
        }, function (ex) {
            return ex.message === "Must have valid progres between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function updateProgressLessThan0() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        raises(function () {
            bookmarks.updateReadProgress({ bookmark_id: justAddedId, progress: -0.1, progress_timestamp: Date.now() });
        }, function (ex) {
            return ex.message === "Must have valid progres between 0.0 and 1.0";
        }, "Should have failed with error on progress value");
    }

    function listInStarredFolderExpectingNoStarredItems() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: "starred" }).done(function (data) {
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 0, "Didn't expect any pre-existing data");
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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data[0];
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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 0, "Didn't expect any pre-existing data");
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
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data[0];
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

    function listWithAddedFolders() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);

        stop();
        folders.list().done(function (folders) {
            ok(Array.isArray(folders), "Folders should have been an array");
            strictEqual(folders.length, 1, "Shouldn't have found any folders");

            strictEqual(folders[0].title, "folder", "folder title was incorrect");
            start();
        }, failedPromiseHandler);
    }

    var bookmarkAddedToFolderId;
    function addToFolder() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
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

    function listContentsOfAFolder() {
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);
        stop();

        bookmarks.list({ folder_id: addedFolderId }).done(function (data) {
            ok(Array.isArray(data), "Expected an array of data")
            strictEqual(data.length, 1, "Didn't expect any pre-existing data");

            // Validate the only bookmark
            var bookmarkData = data[0];
            strictEqual(bookmarkData.type, "bookmark");
            strictEqual(bookmarkData.url, "http://www.codevoid.net/articlevoidtest/TestPage3.html", "url wasn't the same");
            strictEqual(bookmarkData.title, "TestPage3", "title wasn't expected");
            strictEqual(bookmarkData.bookmark_id, bookmarkAddedToFolderId, "Bookmark didn't match");

            start();
        }, failedPromiseHandler);
    }

    function deleteFolder() {
        var folders = new Codevoid.ArticleVoid.InstapaperApi.Folders(clientInformation);
        var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(clientInformation);

        // delete book mark 'cause it ends up in the archieve folder
        stop();
        bookmarks.deleteBookmark(bookmarkAddedToFolderId).then(function () {
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
    test("listWithAddedFolders", listWithAddedFolders);
    test("addToFolder", addToFolder);
    test("listContentsOfAFolder", listContentsOfAFolder);
    test("deleteFolder", deleteFolder);
})();