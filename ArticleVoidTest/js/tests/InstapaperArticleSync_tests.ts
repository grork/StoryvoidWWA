module CodevoidTests.InstapaperArticleSyncTests {
    import st = Windows.Storage;
    import c = Windows.Foundation.Collections;
    import av = Codevoid.ArticleVoid;

    var promiseTest = InstapaperTestUtilities.promiseTest;
    var startOnSuccessOfPromise = InstapaperTestUtilities.startOnSuccessOfPromise;
    var startOnFailureOfPromise = InstapaperTestUtilities.startOnFailureOfPromise;

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var token = "ildNcJmVDn4O5F5Z2V5X8TSNc1pC1aqY98pCOYObAmoc4lGQSD";
    var secret = "gcl8m34CfruNsYEKuRCdvClxqMOC5rxiTpXfrThV6sCgwMktsf";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperArticleSync Tests";

    // Sample, known articles
    var normalArticleUrl = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
    var normalArticleId: number;
    var articleWithImageUrl = "http://www.codevoid.net/articlevoidtest/TestPage11.html";
    var articleWithImageId: number;

    var articlesFolder: st.StorageFolder;
    var stateConfigured = false;

    function deleteAllLocalFiles(): WinJS.Promise<any> {
        return st.ApplicationData.current.localFolder.createFolderAsync("ArticleTemp", st.CreationCollisionOption.openIfExists).then((folder: st.StorageFolder) => {
            articlesFolder = folder;
            return folder.getItemsAsync();
        }).then((files: Windows.Foundation.Collections.IVectorView<st.StorageFile>) => {
            var deletes = files.map((file: st.IStorageItem) => {
                return file.deleteAsync();
            });

            return WinJS.Promise.join(deletes);
        });
    }

    interface IBookmarkHash { [id: number]: string };

    QUnit.module("InstapaperArticleSyncTests");

    function setupLocalAndRemoteState(): WinJS.Promise<any> {
        if (stateConfigured) {
            return WinJS.Promise.timeout();
        }

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
            stateConfigured = true;

            return WinJS.Promise.timeout();
        });
    }

    // Remove remote data for known state
    promiseTest("setupLocalAndRemoteState", setupLocalAndRemoteState);

    promiseTest("checkDefaultStateOfArticleBeforeSyncing", () => {
        var instapaperDB = new av.InstapaperDB();

        return instapaperDB.initialize().then(() => {
            return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
        }).then((bookmark: av.IBookmark) => {
            strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");
        });
    });

    promiseTest("syncingSimpleItemLocallySetsItemInformationCorrectly", () => {
        var setupCompleted = setupLocalAndRemoteState();

        var instapaperDB = new av.InstapaperDB();
        var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

        return setupCompleted.then(() => {
            return instapaperDB.initialize();
        }).then(() => {
            return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
        }).then((bookmark: av.IBookmark) => {
            strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB);
        }).then((syncedBookmark: av.IBookmark) => {
            strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            strictEqual(syncedBookmark.hasImages, false, "Didn't expect images");
        });
    });

    promiseTest("syncingItemWithImagesLocallySetsItemInformationCorrectly", () => {
        var setupCompleted = setupLocalAndRemoteState();

        var instapaperDB = new av.InstapaperDB();
        var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

        return setupCompleted.then(() => {
            return instapaperDB.initialize();
        }).then(() => {
            return instapaperDB.getBookmarkByBookmarkId(articleWithImageId);
        }).then((bookmark: av.IBookmark) => {
            strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB);
        }).then((syncedBookmark: av.IBookmark) => {
            strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            strictEqual(syncedBookmark.hasImages, true, "Didn't expect images");

            return articlesFolder.getFolderAsync(articleWithImageId.toString());
        }).then((imagesSubFolder: st.StorageFolder) => {
            return imagesSubFolder.getFilesAsync();
        }).then((files) => {
            strictEqual(files.size, 2, "Unexpected number of files");
            files.forEach((file, index) => {
                var nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                strictEqual(nameAsNumber, index, "Incorrect filename");
            });

            return articlesFolder.getFileAsync(articleWithImageId + ".html");
        }).then((articleFile: st.StorageFile) => {
            return st.FileIO.readTextAsync(articleFile);
        }).then((articleContent: string) => {
            var parser = new DOMParser();
            var articleDocument = parser.parseFromString(articleContent, "text/html");
            var images = WinJS.Utilities.query("img", articleDocument.body);

            strictEqual(images.length, 2, "Wrong number of images compared to filename");

            var expectedPath = "ms-appdata:///local/" + articlesFolder.name + "/" + articleWithImageId + "/0.png";
            strictEqual((<HTMLImageElement>images[0]).src, expectedPath, "Incorrect path for the image URL");

            expectedPath = "ms-appdata:///local/" + articlesFolder.name + "/" + articleWithImageId + "/1.jpg";
            strictEqual((<HTMLImageElement>images[1]).src, expectedPath, "Incorrect path for the image URL");
        });
    });

    promiseTest("filesFromMissingBookmarksAreCleanedup", () => {
        var setupCompleted = setupLocalAndRemoteState();

        var instapaperDB = new av.InstapaperDB();
        var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

        return setupCompleted.then(() => {
            return instapaperDB.initialize();
        }).then(() => {
            // Create Fake File, and sync two articles so there are files
            // present that *SHOULD* be there.
            return WinJS.Promise.join([
                articlesFolder.createFileAsync("1.html", st.CreationCollisionOption.replaceExisting),
                articlesFolder.createFileAsync("2.html", st.CreationCollisionOption.replaceExisting),
                articlesFolder.createFolderAsync("2", st.CreationCollisionOption.replaceExisting).then((articleFolder: st.StorageFolder) => {
                    return WinJS.Promise.join([
                        articleFolder.createFileAsync("1.png", st.CreationCollisionOption.replaceExisting),
                        articleFolder.createFileAsync("2.png", st.CreationCollisionOption.replaceExisting),
                    ]);
                }),
                articleSync.syncSingleArticle(articleWithImageId, instapaperDB),
                articleSync.syncSingleArticle(normalArticleId, instapaperDB)
            ]);
        }).then(() => {
            return articleSync.removeFilesForNotPresentArticles(instapaperDB).then(() => {
                return WinJS.Promise.join({
                    files: articlesFolder.getFilesAsync(),
                    folders: articlesFolder.getFoldersAsync(),
                });
            });
        }).then((result: { files: c.IVectorView<st.StorageFile>, folders: c.IVectorView<st.StorageFolder> }) => {
            var files = result.files;
            var folders = result.folders;

            strictEqual(files.length, 2, "only expected two files");
            
            // Validate that the two remaining files are the correct ones
            var fileNames = files.map((file: st.StorageFile) => {
                return file.name.toLowerCase();
            });

            var imageArticleIndex = fileNames.indexOf(articleWithImageId + ".html");
            var normalArticleIndex = fileNames.indexOf(normalArticleId + ".html");

            notStrictEqual(imageArticleIndex, -1, "Image article file not found");
            notStrictEqual(normalArticleIndex, -1, "Normal article file not found");

            strictEqual(folders.length, 1, "Only expected one folder");
            strictEqual(folders.getAt(0).name, articleWithImageId + "", "Incorrect folder left behind");
        });
    });

    promiseTest("syncsAllArticles", () => {
        // Because we want to sync everything, lets make sure we clean
        // our state. We do this by resetting the flag that
        // setupLocalAndRemoteState uses to decide if it needs to rerun.
        stateConfigured = false;

        var idb = new av.InstapaperDB();

        return setupLocalAndRemoteState().then(() => {
            return idb.initialize();
        }).then(() => {
            var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
            return articleSync.syncAllArticlesNotDownloaded(idb);
        }).then(() => {

            var files = articlesFolder.getFilesAsync().then((files) => {
                var bookmark_hash: IBookmarkHash = {};

                files.forEach((file) => {
                    // If the local file isn't HTML, then it's not of interest to us
                    if (!(file.fileType.toLowerCase() === ".html")) {
                        return;
                    }

                    // Do magic to convert the filename (which includes the extension) into
                    // a number we can use to look up the ID
                    var bookmarkIdPartOfFileName = file.name.replace(file.fileType, "");
                    var bookmark_id: number = Number(bookmarkIdPartOfFileName);

                    bookmark_hash[bookmark_id] = file.path;
                });

                return bookmark_hash;
            });

            var bookmarks = idb.listCurrentBookmarks();

            return WinJS.Promise.join({
                bookmarks: bookmarks,
                fileMap: files,
            });
        }).then((result: { bookmarks: av.IBookmark[], fileMap: IBookmarkHash }) => {
            result.bookmarks.forEach((bookmark) => {
                var isInHash = result.fileMap.hasOwnProperty(bookmark.bookmark_id.toString());

                if (bookmark.contentAvailableLocally) {
                    ok(isInHash, "Didn't find bookmark in filesystem");
                } else {
                    ok(!isInHash, "Shouldn't have found bookmark locally");
                }
            });
        });
    });
}