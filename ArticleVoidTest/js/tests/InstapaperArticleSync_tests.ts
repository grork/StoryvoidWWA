module CodevoidTests.InstapaperArticleSyncTests {
    import st = Windows.Storage;
    import av = Codevoid.ArticleVoid;

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperArticleSync Tests";

    // Sample, known articles
    var normalArticleUrl = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
    var normalArticleId: number;
    var articleWithImageUrl = "http://www.codevoid.net/articlevoidtest/TestPage9.html";
    var articleWithImageId: number;

    var articlesFolder: st.StorageFolder;

    function deleteAllLocalFiles(): WinJS.Promise<any> {
        return st.ApplicationData.current.localFolder.createFolderAsync("ArticleTemp", st.CreationCollisionOption.openIfExists).then((folder: st.StorageFolder) => {
            articlesFolder = folder;
            return folder.getFilesAsync();
        }).then((files: Windows.Foundation.Collections.IVectorView<st.StorageFile>) => {
            var deletes = files.map((file: st.StorageFile) => {
                return file.deleteAsync();
            });

            return WinJS.Promise.join(deletes);
           });
    }

    QUnit.module("InstapaperArticleSyncTests");

    // Remove remote data for known state
    promiseTest("setupLocalAndRemoteState", () => {
        var dbInstance = new av.InstapaperDB();

        var api = new av.InstapaperApi.Bookmarks(clientInformation);
        return WinJS.Promise.join([
            api.add({ url: normalArticleUrl }).then((article: av.IBookmark) => {
                normalArticleId = article.bookmark_id;
            }),
            api.add({ url: articleWithImageUrl }).then((article: av.IBookmark) => {
                articleWithImageId = article.bookmark_id;
            }),
            deleteAllLocalFiles().then(() => { // Clear any downloaded files
                return InstapaperTestUtilities.deleteDb(); // Clear the DB itself
            }),
        ]).then(() => {
            return dbInstance.initialize();
        }).then(() => {
            var sync = new av.InstapaperSync(clientInformation);
            return sync.sync({
                dbInstance: dbInstance,
                folders: false,
                bookmarks: true,
                singleFolder: true,
                folder: dbInstance.commonFolderDbIds.unread
            });
        }).then(() => {
            dbInstance.dispose();
        });
    });

    promiseTest("checkDefaultStateOfArticleBeforeSyncing", () => {
        var instapaperDB = new av.InstapaperDB();

        return instapaperDB.initialize().then(() => {
            return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
        }).then((bookmark: av.IBookmark) => {
            strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");
        });
    });

    promiseTest("syncingSimpleItemLocallySetsContentAvailabilityCorrectly", () => {
        var instapaperDB = new av.InstapaperDB();
        var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

        return instapaperDB.initialize().then(() => {
            return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
        }).then((bookmark: av.IBookmark) => {
            strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            return articleSync.syncSingleArticle(normalArticleId, instapaperDB);
        }).then((syncedBookmark: av.IBookmark) => {
            strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
        });
    });
}