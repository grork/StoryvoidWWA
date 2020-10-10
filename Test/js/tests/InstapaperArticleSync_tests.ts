/// <reference path="..\..\..\App\js\InstapaperArticleSync.ts" />
/// <reference path="..\..\..\App\js\OAuth.ts" />
/// <reference path="..\..\..\App\js\InstapaperApi.ts" />
/// <reference path="..\..\..\App\js\AuthenticatorService.ts" />
/// <reference path="..\..\..\App\js\InstapaperSync.ts" />
/// <reference path="..\..\..\App\js\InstapaperDB.ts" />

namespace CodevoidTests.InstapaperArticleSyncTests {
    import st = Windows.Storage;
    import c = Windows.Foundation.Collections;
    import av = Codevoid.Storyvoid;

    interface IBookmarkHash { [id: number]: string };

    const clientID = CodevoidTests.INSTAPAPER_CLIENT_ID;
    const clientSecret = CodevoidTests.INSTAPAPER_CLIENT_SECRET;

    const token = CodevoidTests.INSTAPAPER_TOKEN;
    const secret = CodevoidTests.INSTAPAPER_TOKEN_SECRET;

    const clientInformation = new Codevoid.OAuth.ClientInformation(clientID, clientSecret, token, secret);
    clientInformation.productName = "Codevoid InstapaperArticleSync Tests";

    // Sample, known articles
    const normalArticleUrl = "https://www.codevoid.net/articlevoidtest/_TestPage1.html";
    let normalArticleId: number;
    const articleWithImageUrl = "https://www.codevoid.net/articlevoidtest/TestPageWithImage.html";
    let articleWithImageId: number;
    const youTubeArticleUrl = "https://www.youtube.com/watch?v=qZRsVqOIWms";
    let youTubeArticleId: number;
    const vimeoArticleUrl = "https://vimeo.com/76979871";
    let vimeoArticleId: number;

    let articlesFolder: st.StorageFolder;
    let stateConfigured = false;

    async function deleteAllLocalFiles(): Promise<any> {
        articlesFolder = await st.ApplicationData.current.localFolder.createFolderAsync("ArticleTemp", st.CreationCollisionOption.openIfExists);
        const files = await articlesFolder.getItemsAsync();
        await Promise.all(files.map((file: st.IStorageItem) => file.deleteAsync()));
    }

    async function setupLocalAndRemoteState(): Promise<any> {
        if (stateConfigured) {
            return;
        }

        const dbInstance = new av.InstapaperDB();
        const api = new av.InstapaperApi.Bookmarks(clientInformation);

        const [normal, withImage, youTube, vimeo, clearLocalFiles] = await Promise.all([
            api.add({ url: normalArticleUrl }),
            api.add({ url: articleWithImageUrl }),
            api.add({ url: youTubeArticleUrl }),
            api.add({ url: vimeoArticleUrl }),
            deleteAllLocalFiles(), // Clear any downloaded files
        ]);

        normalArticleId = normal.bookmark_id;
        articleWithImageId = withImage.bookmark_id;
        youTubeArticleId = youTube.bookmark_id;
        vimeoArticleId = vimeo.bookmark_id;

        await InstapaperTestUtilities.deleteDb(); // Clear the DB itself

        await dbInstance.initialize();
        const sync = new av.InstapaperSync(clientInformation);
        await sync.sync({
            dbInstance: dbInstance,
            folders: false,
            bookmarks: true,
            singleFolder: true,
            folder: dbInstance.commonFolderDbIds.unread
        });
        dbInstance.dispose();
        stateConfigured = true;
    }

    describe("InstapaperArticleSyncTests", function () {
        // Remove remote data for known state
        it("setupLocalAndRemoteState", () => {
            return setupLocalAndRemoteState();
        });

        it("checkDefaultStateOfArticleBeforeSyncing", async () => {
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            
            const bookmark = await instapaperDB.getBookmarkByBookmarkId(normalArticleId);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");
        });

        it("syncingSimpleItemLocallySetsItemInformationCorrectly", async () => {
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();

            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
            const bookmark = await instapaperDB.getBookmarkByBookmarkId(normalArticleId);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            const syncedBookmark = await articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            assert.strictEqual(syncedBookmark.hasImages, false, "Didn't expect images");
            assert.strictEqual(syncedBookmark.extractedDescription, "Bacon ipsum dolor sit amet tail prosciutto drumstick ea. Fugiat culpa eiusmod qui, enim officia consequat cow t-bone prosciutto beef ribs. Ribeye kielbasa esse capicola excepteur, ham labore pancetta pariatur andouille corned beef cillum tongue. Pork loin flank pork belly, boudin labore hamburger meatball bacon. Meatball id adipisicing corned beef deserunt beef ribs. Bresaola et ut ham hock dolor ", "Wrong number of extracted description letters");
        });

        it("syncingItemWithImagesLocallySetsItemInformationCorrectly", async () => {
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(articleWithImageId);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            const syncedBookmark = await articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
            assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/SampleImage1.png", "Incorrect first image path");

            const imagesSubFolder = await articlesFolder.getFolderAsync(articleWithImageId.toString());
            const files = await imagesSubFolder.getFilesAsync();
            assert.strictEqual(files.size, 2, "Unexpected number of files");
            files.forEach((file, index) => {
                const nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                assert.strictEqual(nameAsNumber, index, "Incorrect filename");
            });

            const articleFile = await articlesFolder.getFileAsync(articleWithImageId + ".html");
            const articleContent = await st.FileIO.readTextAsync(articleFile);
            const parser = new DOMParser();
            const articleDocument = parser.parseFromString(articleContent, "text/html");
            const images = WinJS.Utilities.query("img", articleDocument.body);

            assert.strictEqual(images.length, 2, "Wrong number of images compared to filename");

            const packageName = Windows.ApplicationModel.Package.current.id.name.toLowerCase();
            let expectedPath = "ms-appx://" + packageName + "/" + articleWithImageId + "/SampleImage1.png";
            assert.strictEqual((<HTMLImageElement>images[0]).src, expectedPath, "Incorrect path for the image URL");

            expectedPath = "ms-appx://" + packageName + "/" + articleWithImageId + "/SampleImage2.jpg";
            assert.strictEqual((<HTMLImageElement>images[1]).src, expectedPath, "Incorrect path for the image URL");
        });

        it("syncingYouTubeVideoDownloadsCustomizedImage", async () => {
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(youTubeArticleId);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            const syncedBookmark = await articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
            assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/0.jpg", "Incorrect first image path");

            const imagesSubFolder = await articlesFolder.getFolderAsync(syncedBookmark.bookmark_id.toString());
            const files = await imagesSubFolder.getFilesAsync();
            assert.strictEqual(files.size, 1, "Unexpected number of files");
            files.forEach((file, index) => {
                const nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                assert.strictEqual(nameAsNumber, index, "Incorrect filename");
            });
        });

        it("syncingVimeoVideoDownloadsCustomizedImage", async () => {
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(vimeoArticleId);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            const syncedBookmark = await articleSync.syncSingleArticle(bookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.strictEqual(syncedBookmark.contentAvailableLocally, true, "Expected bookmark to be available locally");
            assert.strictEqual(syncedBookmark.localFolderRelativePath, "/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + ".html", "File path incorrect");
            assert.strictEqual(syncedBookmark.hasImages, true, "Expected images");
            assert.strictEqual(syncedBookmark.firstImagePath, "ms-appdata:///local/" + articlesFolder.name + "/" + syncedBookmark.bookmark_id + "/0.jpg", "Incorrect first image path");

            const imagesSubFolder = await articlesFolder.getFolderAsync(syncedBookmark.bookmark_id.toString());
            const files = await imagesSubFolder.getFilesAsync();
            assert.strictEqual(files.size, 1, "Unexpected number of files");
            files.forEach((file, index) => {
                const nameAsNumber = parseInt(file.name.replace(file.fileType, ""));
                assert.strictEqual(nameAsNumber, index, "Incorrect filename");
            });
        });

        it("syncingUnavailableItemSetsDBCorrectly", async () => {
            stateConfigured = false; // Reset state so we rebuild it all
            const bookmarksApi = new av.InstapaperApi.Bookmarks(clientInformation);
            const badBookmark = await bookmarksApi.add({ url: "http://codevoid.net/articlevoidtest/_foo.html" });
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

            const bookmark = await instapaperDB.getBookmarkByBookmarkId(badBookmark.bookmark_id);
            assert.strictEqual(bookmark.contentAvailableLocally, false, "Didn't expect content to be available locally");

            const syncedBookmark = await articleSync.syncSingleArticle(badBookmark.bookmark_id, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.ok(!syncedBookmark.contentAvailableLocally, "Expected bookmark to be unavailable locally");
            assert.strictEqual(syncedBookmark.localFolderRelativePath, undefined, "File path incorrect");
            assert.ok(!syncedBookmark.hasImages, "Didn't expect images");
            assert.ok(syncedBookmark.articleUnavailable, "File should indicate error");

            const articleFile = await articlesFolder.tryGetItemAsync(badBookmark.bookmark_id + ".html");
            assert.ok(articleFile == null, "Shouldn't have downloaded article");

            await bookmarksApi.deleteBookmark(badBookmark.bookmark_id);
        });

        it("filesFromMissingBookmarksAreCleanedup", async () => {
            await setupLocalAndRemoteState();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);


            // Create Fake File, and sync two articles so there are files
            // present that *SHOULD* be there.
            await Promise.all([
                articlesFolder.createFileAsync("1.html", st.CreationCollisionOption.replaceExisting),
                articlesFolder.createFileAsync("2.html", st.CreationCollisionOption.replaceExisting),
                articleSync.syncSingleArticle(articleWithImageId, instapaperDB, new Codevoid.Utilities.CancellationSource()),
                articleSync.syncSingleArticle(normalArticleId, instapaperDB, new Codevoid.Utilities.CancellationSource())
            ]);

            const articleFolder = await articlesFolder.createFolderAsync("2", st.CreationCollisionOption.replaceExisting);
            await Promise.all([
                articleFolder.createFileAsync("1.png", st.CreationCollisionOption.replaceExisting),
                articleFolder.createFileAsync("2.png", st.CreationCollisionOption.replaceExisting),
            ]);

            await articleSync.removeFilesForNotPresentArticles(instapaperDB);
            const [files, folders] = await Promise.all([
                articlesFolder.getFilesAsync(),
                articlesFolder.getFoldersAsync(),
            ]);

            assert.strictEqual(files.length, 2, "only expected two files");

            // Validate that the two remaining files are the correct ones
            let fileNames = files.map((file: st.StorageFile) => {
                return file.name.toLowerCase();
            });

            let imageArticleIndex = fileNames.indexOf(articleWithImageId + ".html");
            let normalArticleIndex = fileNames.indexOf(normalArticleId + ".html");

            assert.notStrictEqual(imageArticleIndex, -1, "Image article file not found");
            assert.notStrictEqual(normalArticleIndex, -1, "Normal article file not found");

            assert.strictEqual(folders.length, 1, "Only expected one folder");
            assert.strictEqual(folders.getAt(0).name, articleWithImageId + "", "Incorrect folder left behind");
        });

        it("eventsFiredForSingleArticle", async () => {
            let happenings: { event: string, bookmark_id: number }[] = [];
            await setupLocalAndRemoteState();
            await deleteAllLocalFiles();
            const instapaperDB = new av.InstapaperDB();
            await instapaperDB.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);
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

            await articleSync.syncSingleArticle(articleWithImageId, instapaperDB, new Codevoid.Utilities.CancellationSource());
            assert.strictEqual(happenings.length, 8, "incorrect number of events");

            const first = happenings[0];
            assert.strictEqual(first.event, "syncstart", "incorrect first event");
            assert.strictEqual(first.bookmark_id, articleWithImageId, "Incorrect ID");

            const second = happenings[1];
            assert.strictEqual(second.event, "imagesstarting", "incorrect second event");
            assert.strictEqual(second.bookmark_id, articleWithImageId, "Incorrect ID");

            const third = happenings[2];
            assert.strictEqual(third.event, "imagestart", "incorrect third event");
            assert.strictEqual(third.bookmark_id, articleWithImageId, "Incorrect ID");

            const fourth = happenings[3];
            assert.strictEqual(fourth.event, "imagestart", "incorrect fourth event");
            assert.strictEqual(fourth.bookmark_id, articleWithImageId, "Incorrect ID");

            const fifth = happenings[4];
            assert.strictEqual(fifth.event, "imagestop", "incorrect fifth event");
            assert.strictEqual(fifth.bookmark_id, articleWithImageId, "Incorrect ID");

            const sixth = happenings[5];
            assert.strictEqual(sixth.event, "imagestop", "incorrect sixth event");
            assert.strictEqual(sixth.bookmark_id, articleWithImageId, "Incorrect ID");

            const seventh = happenings[6];
            assert.strictEqual(seventh.event, "imagesstop", "incorrect seventh event");
            assert.strictEqual(seventh.bookmark_id, articleWithImageId, "Incorrect ID");

            const eigth = happenings[7];
            assert.strictEqual(eigth.event, "syncstop", "incorrect eigth event");
            assert.strictEqual(eigth.bookmark_id, articleWithImageId, "Incorrect ID");
        });

        it("syncsAllArticles", async () => {
            // Because we want to sync everything, lets make sure we clean
            // our state. We do this by resetting the flag that
            // setupLocalAndRemoteState uses to decide if it needs to rerun.
            stateConfigured = false;

            await setupLocalAndRemoteState();
            const idb = new av.InstapaperDB();
            await idb.initialize();
            const articleSync = new av.InstapaperArticleSync(clientInformation, articlesFolder);

            await articleSync.syncAllArticlesNotDownloaded(idb, new Codevoid.Utilities.CancellationSource());
            const files = await articlesFolder.getFilesAsync();
            const bookmark_hash: IBookmarkHash = {};

            files.forEach((file) => {
                // If the local file isn't HTML, then it's not of interest to us
                if (!(file.fileType.toLowerCase() === ".html")) {
                    return;
                }

                // Do magic to convert the filename (which includes the extension) into
                // a number we can use to look up the ID
                let bookmarkIdPartOfFileName = file.name.replace(file.fileType, "");
                let bookmark_id: number = Number(bookmarkIdPartOfFileName);

                bookmark_hash[bookmark_id] = file.path;
            });

            const bookmarks = await idb.listCurrentBookmarks();

            bookmarks.forEach((bookmark) => {
                let isInHash = bookmark_hash.hasOwnProperty(bookmark.bookmark_id.toString());

                if (bookmark.contentAvailableLocally) {
                    assert.ok(isInHash, "Didn't find bookmark in filesystem");
                } else {
                    assert.ok(!isInHash, "Shouldn't have found bookmark locally");
                }
            });
        });
    });
}