/// <reference path="..\..\..\App\js\InstapaperArticleSync.ts" />
/// <reference path="..\..\..\App\js\OAuth.ts" />

module CodevoidTests.InstapaperArticleSyncTests {
    import st = Windows.Storage;
    import c = Windows.Foundation.Collections;
    import av = Codevoid.Storyvoid;

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var token = "PLACEHOLDER";
    var secret = "PLACEHOLDER";

    var clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperArticleSync Tests";

    // Sample, known articles
    var normalArticleUrl = "http://www.codevoid.net/articlevoidtest/TestPage1.html";
    var normalArticleId: number;
    var articleWithImageUrl = "http://www.codevoid.net/articlevoidtest/TestPage11.html";
    var articleWithImageId: number;
    var youTubeArticleUrl = "https://www.youtube.com/watch?v=qZRsVqOIWms";
    var youTubeArticleId: number;
    var vimeoArticleUrl = "https://vimeo.com/76979871";
    var vimeoArticleId: number;

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
            api.add({ url: youTubeArticleUrl }).then((article: av.IBookmark) => {
                youTubeArticleId = article.bookmark_id;
            }),
            api.add({ url: vimeoArticleUrl }).then((article: av.IBookmark) => {
                vimeoArticleId = article.bookmark_id;
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

    describe("InstapaperArticleSyncTests", function () {
        // Remove remote data for known state
        it("setupLocalAndRemoteState", () => {
            return setupLocalAndRemoteState();
        });

        it("checkDefaultStateOfArticleBeforeSyncing", () => {
            var instapaperDB = new av.InstapaperDB();

            return instapaperDB.initialize().then(() => {
                return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");
            });
        });

        it("syncingSimpleItemLocallySetsItemInformationCorrectly", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
                return instapaperDB.getBookmarkByBookmarkId(normalArticleId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

                return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then((syncedBookmark: av.IBookmark) => {
                assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
                assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
                assert.strictEqual(syncedBookmark.hasImages, false, "Didn't expect images");
                assert.strictEqual(syncedBookmark.extractedDescription, "Bacon ipsum dolor sit amet tail prosciutto drumstick ea. Fugiat culpa eiusmod qui, enim officia consequat cow t-bone prosciutto beef ribs. Ribeye kielbasa esse capicola excepteur, ham labore pancetta pariatur andouille corned beef cillum tongue. Pork loin flank pork belly, boudin labore hamburger meatball bacon. Meatball id adipisicing corned beef deserunt beef ribs. Bresaola et ut ham hock dolor ", "Wrong number of extracted description letters");
            });
        });

        it("syncingItemWithImagesLocallySetsItemInformationCorrectly", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

                return instapaperDB.getBookmarkByBookmarkId(articleWithImageId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

                return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then((syncedBookmark: av.IBookmark) => {
                assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
                assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
                assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
                assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/0.png", "Incorrect first image path");

                return articlesFolder.getFolderAsync(articleWithImageId.toString());
            }).then((imagesSubFolder: st.StorageFolder) => {
                return imagesSubFolder.getFilesAsync();
            }).then((files) => {
                assert.strictEqual(files.size, 2, "Unexpected number of files");
                files.forEach((file, index) => {
                    var nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                    assert.strictEqual(nameAsNumber, index, "Incorrect filename");
                });

                return articlesFolder.getFileAsync(articleWithImageId + ".html");
            }).then((articleFile: st.StorageFile) => {
                return st.FileIO.readTextAsync(articleFile);
            }).then((articleContent: string) => {
                var parser = new DOMParser();
                var articleDocument = parser.parseFromString(articleContent, "text/html");
                var images = WinJS.Utilities.query("img", articleDocument.body);

                assert.strictEqual(images.length, 2, "Wrong number of images compared to filename");

                var packageName = Windows.ApplicationModel.Package.current.id.name.toLowerCase();
                var expectedPath = "ms-appx://" + packageName + "/" + articleWithImageId + "/0.png";
                assert.strictEqual((<HTMLImageElement>images[0]).src, expectedPath, "Incorrect path for the image URL");

                expectedPath = "ms-appx://" + packageName + "/" + articleWithImageId + "/1.jpg";
                assert.strictEqual((<HTMLImageElement>images[1]).src, expectedPath, "Incorrect path for the image URL");
            });
        });

        it("syncingYouTubeVideoDownloadsCustomizedImage", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

                return instapaperDB.getBookmarkByBookmarkId(youTubeArticleId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

                return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then((syncedBookmark: av.IBookmark) => {
                assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
                assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
                assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
                assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/0.jpg", "Incorrect first image path");

                return articlesFolder.getFolderAsync(syncedBookmark.bookmark_id.toString());
            }).then((imagesSubFolder: st.StorageFolder) => {
                return imagesSubFolder.getFilesAsync();
            }).then((files) => {
                assert.strictEqual(files.size, 1, "Unexpected number of files");
                files.forEach((file, index) => {
                    var nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                    assert.strictEqual(nameAsNumber, index, "Incorrect filename");
                });
            });
        });

        it("syncingVimeoVideoDownloadsCustomizedImage", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

                return instapaperDB.getBookmarkByBookmarkId(vimeoArticleId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

                return articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then((syncedBookmark: av.IBookmark) => {
                assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
                assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
                assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
                assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/0.jpg", "Incorrect first image path");

                return articlesFolder.getFolderAsync(syncedBookmark.bookmark_id.toString());
            }).then((imagesSubFolder: st.StorageFolder) => {
                return imagesSubFolder.getFilesAsync();
            }).then((files) => {
                assert.strictEqual(files.size, 1, "Unexpected number of files");
                files.forEach((file, index) => {
                    var nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                    assert.strictEqual(nameAsNumber, index, "Incorrect filename");
                });
            });
        });

        it("syncingUnavailableItemSetsDBCorrectly", () => {
            var bookmarksApi = new av.InstapaperApi.Bookmarks(clientInformation);
            var badBookmarkId;

            stateConfigured = false;

            var setupCompleted = bookmarksApi.add({ url: "http://codevoid.net/articlevoidtest/foo.html" }).then((bookmark: av.IBookmark) => {
                badBookmarkId = bookmark.bookmark_id;

                return setupLocalAndRemoteState();
            });

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

                return instapaperDB.getBookmarkByBookmarkId(badBookmarkId);
            }).then((bookmark: av.IBookmark) => {
                assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

                return articleSync.syncSingleArticle(badBookmarkId, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then((syncedBookmark: av.IBookmark) => {
                assert.ok(!syncedBookmark.contentAvailableLocally, "Expected bookmark to be unavailable locally");
                assert.strictEqual(syncedBookmark.localFolderRelativePath, undefined, "File path incorrect");
                assert.ok(!syncedBookmark.hasImages, "Didn't expect images");
                assert.ok(syncedBookmark.articleUnavailable, "File should indicate error");

                return articlesFolder.tryGetItemAsync(badBookmarkId + ".html");
            }).then((articleFile: st.IStorageItem) => {
                assert.ok(articleFile == null, "Shouldn't have downloaded article");

                return bookmarksApi.deleteBookmark(badBookmarkId);
            });
        });

        it("filesFromMissingBookmarksAreCleanedup", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            return setupCompleted.then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
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
                    articleSync.syncSingleArticle(articleWithImageId, instapaperDB, new Codevoid.Utilities.CancellationSource()),
                    articleSync.syncSingleArticle(normalArticleId, instapaperDB, new Codevoid.Utilities.CancellationSource())
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

                assert.strictEqual(files.length, 2, "only expected two files");

                // Validate that the two remaining files are the correct ones
                var fileNames = files.map((file: st.StorageFile) => {
                    return file.name.toLowerCase();
                });

                var imageArticleIndex = fileNames.indexOf(articleWithImageId + ".html");
                var normalArticleIndex = fileNames.indexOf(normalArticleId + ".html");

                assert.notStrictEqual(imageArticleIndex, -1, "Image article file not found");
                assert.notStrictEqual(normalArticleIndex, -1, "Normal article file not found");

                assert.strictEqual(folders.length, 1, "Only expected one folder");
                assert.strictEqual(folders.getAt(0).name, articleWithImageId + "", "Incorrect folder left behind");
            });
        });

        it("eventsFiredForSingleArticle", () => {
            var setupCompleted = setupLocalAndRemoteState();

            var instapaperDB = new av.InstapaperDB();
            var articleSync;

            var happenings: { event: string, bookmark_id: number }[] = [];

            return setupCompleted.then(() => {
                return deleteAllLocalFiles();
            }).then(() => {
                return instapaperDB.initialize();
            }).then(() => {
                articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
                Codevoid.Utilities.addEventListeners(articleSync.events, {
                    syncingarticlestarting: (args) => {
                        happenings.push({
                            event: "syncstart",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                    syncingarticlecompleted: (args) => {
                        happenings.push({
                            event: "syncstop",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                    processingimagesstarting: (args) => {
                        happenings.push({
                            event: "imagesstarting",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                    processingimagescompleted: (args) => {
                        happenings.push({
                            event: "imagesstop",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                    processingimagestarting: (args) => {
                        happenings.push({
                            event: "imagestart",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                    processingimagecompleted: (args) => {
                        happenings.push({
                            event: "imagestop",
                            bookmark_id: args.detail.bookmark_id,
                        });
                    },
                });

                return articleSync.syncSingleArticle(articleWithImageId, instapaperDB, new Codevoid.Utilities.CancellationSource());
            }).then(() => {
                assert.strictEqual(happenings.length, 8, "incorrect number of events");

                var first = happenings[0];
                assert.strictEqual(first.event, "syncstart", "incorrect first event");
                assert.strictEqual(first.bookmark_id, articleWithImageId, "Incorrect ID");

                var second = happenings[1];
                assert.strictEqual(second.event, "imagesstarting", "incorrect second event");
                assert.strictEqual(second.bookmark_id, articleWithImageId, "Incorrect ID");

                var third = happenings[2];
                assert.strictEqual(third.event, "imagestart", "incorrect third event");
                assert.strictEqual(third.bookmark_id, articleWithImageId, "Incorrect ID");

                var fourth = happenings[3];
                assert.strictEqual(fourth.event, "imagestart", "incorrect fourth event");
                assert.strictEqual(fourth.bookmark_id, articleWithImageId, "Incorrect ID");

                var fifth = happenings[4];
                assert.strictEqual(fifth.event, "imagestop", "incorrect fifth event");
                assert.strictEqual(fifth.bookmark_id, articleWithImageId, "Incorrect ID");

                var sixth = happenings[5];
                assert.strictEqual(sixth.event, "imagestop", "incorrect sixth event");
                assert.strictEqual(sixth.bookmark_id, articleWithImageId, "Incorrect ID");

                var seventh = happenings[6];
                assert.strictEqual(seventh.event, "imagesstop", "incorrect seventh event");
                assert.strictEqual(seventh.bookmark_id, articleWithImageId, "Incorrect ID");

                var eigth = happenings[7];
                assert.strictEqual(eigth.event, "syncstop", "incorrect eigth event");
                assert.strictEqual(eigth.bookmark_id, articleWithImageId, "Incorrect ID");
            });
        });

        it("syncsAllArticles", () => {
            // Because we want to sync everything, lets make sure we clean
            // our state. We do this by resetting the flag that
            // setupLocalAndRemoteState uses to decide if it needs to rerun.
            stateConfigured = false;

            var idb = new av.InstapaperDB();

            return setupLocalAndRemoteState().then(() => {
                return idb.initialize();
            }).then(() => {
                var articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
                return articleSync.syncAllArticlesNotDownloaded(idb, new Codevoid.Utilities.CancellationSource());
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
                        assert.ok(isInHash, "Didn't find bookmark in filesystem");
                    } else {
                        assert.ok(!isInHash, "Shouldn't have found bookmark locally");
                    }
                });
            });
        });
    });
}