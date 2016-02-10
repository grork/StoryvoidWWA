module Codevoid.ArticleVoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.ArticleVoid;
    import api = Codevoid.ArticleVoid.InstapaperApi;
    import st = Windows.Storage;
    import http = Windows.Web.Http;
    import c = Windows.Foundation.Collections;

    interface IProcessedArticleInformation {
        relativePath: string;
        hasImages: boolean;
        firstImagePath: string,
        extractedDescription: string;
        failedToDownload: boolean;
        articleUnavailable: boolean;
    }

    interface IBookmarkHash { [id: number]: string };
    interface IFolderMap { [name: string]: st.StorageFolder };

    export class InstapaperArticleSync {
        private _bookmarksApi: api.Bookmarks;
        private _localFolderPathLength: number;
        private _eventSource: Utilities.EventSource;

        constructor(
            private _clientInformation: oauth.ClientInformation,
            private _destinationFolder: st.StorageFolder
        ) {
            if (!_destinationFolder) {
                throw new Error("Must supply valid destination folder");
            }

            // Require paths to begin w/ the local folder for simplified processing.
            // Or, another way: Folder we're working in should be a child of the local folder
            if (_destinationFolder.path.indexOf(st.ApplicationData.current.localFolder.path) !== 0) {
                throw new Error("Destination path must be child of local folder path");
            }

            this._localFolderPathLength = st.ApplicationData.current.localFolder.path.length;
            this._bookmarksApi = new api.Bookmarks(this._clientInformation);
            this._eventSource = new Utilities.EventSource();
        }

        public syncAllArticlesNotDownloaded(idb: InstapaperDB): WinJS.Promise<any> {
            this._eventSource.dispatchEvent("allarticlesstarting", null);

            // First list all the current folders, and then sort them by 
            // ID (E.g. well known first)
            return idb.listCurrentFolders().then((folders) => {
                folders.sort((firstFolder: IFolder, secondFolder: IFolder): number => {
                    if ((firstFolder.position === undefined) && (secondFolder.position === undefined)) {
                        // Assume we're sorting pre-canned folders. Sort by "id"
                        if (firstFolder.id < secondFolder.id) {
                            return -1;
                        } else if (firstFolder.id > secondFolder.id) {
                            return 1;
                        } else {
                            return;
                        }
                    }

                    if ((firstFolder.position === undefined) && (secondFolder.position !== undefined)) {
                        // Assume it's a pre-canned folder against a user folder. Pre-canned
                        // always go first
                        return -1;
                    }

                    if ((firstFolder.position !== undefined) && (secondFolder.position === undefined)) {
                        // Assume it's a user folder against a pre-canned folder. User folders
                        // always come after.
                        return 1;
                    }

                    // Since we've got user folders, sort soley by the users ordering preference
                    if (firstFolder.position < secondFolder.position) {
                        return -1;
                    } else if (firstFolder.position > secondFolder.position) {
                        return 1;
                    } else {
                        return 1;
                    }
                });

                // Get the bookmarks from each folder, and sort them by highest ID
                // first. Also remove any that are available locally / aren't
                // available through the service.
                var bookmarks = folders.map((folder) => {
                    return idb.listCurrentBookmarks(folder.id).then((bookmarks) => {
                        bookmarks = bookmarks.filter((bookmark) => {
                            return !bookmark.contentAvailableLocally && !bookmark.articleUnavailable;
                        });

                        bookmarks.sort((bookmarkA, bookmarkB) => {
                            if (bookmarkA.bookmark_id < bookmarkB.bookmark_id) {
                                return -1;
                            }

                            if (bookmarkA.bookmark_id > bookmarkB.bookmark_id) {
                                return 1;
                            }

                            return 0;
                        });

                        return bookmarks;
                    });
                });

                return WinJS.Promise.join(bookmarks);
            }).then((bookmarksByFolder: IBookmark[][]) => {
                // Flatten them all into on big array, assuming that
                // they're implicitly sorted now
                var bookmarksAsFlatList = [];

                bookmarksByFolder.forEach((bookmarks: IBookmark[]) => {
                    bookmarksAsFlatList = bookmarksAsFlatList.concat(bookmarks);
                });

                return bookmarksAsFlatList;
            }).then((articlesByUnreadFirst) => {
                return Codevoid.Utilities.serialize(articlesByUnreadFirst, (item: IBookmark) => {
                    return this.syncSingleArticle(item.bookmark_id, idb).then(null, () => { /* Eat errors */ });
                }, 4);
            }).then(() => {
                this._eventSource.dispatchEvent("allarticlescompleted", null);
            });
        }

        public syncSingleArticle(bookmark_id: number, dbInstance: av.InstapaperDB): WinJS.Promise<IBookmark> {
            var localBookmark = dbInstance.getBookmarkByBookmarkId(bookmark_id).then((bookmark) => {
                this._eventSource.dispatchEvent("syncingarticlestarting", {
                    bookmark_id: bookmark_id,
                    title: bookmark.title,
                });

                return bookmark;
            });

            var processArticle = this._bookmarksApi.getTextAndSaveToFileInDirectory(bookmark_id, this._destinationFolder).then(
                (file: st.StorageFile) => this._processArticle(file, bookmark_id));

            return WinJS.Promise.join({
                articleInformation: processArticle.then(null, (e) => {
                    return {
                        articleUnavailable: (e.error === 1550),
                        failedToDownload: true,
                    };
                }),
                localBookmark: localBookmark,
            }).then((result: { articleInformation: IProcessedArticleInformation, localBookmark: av.IBookmark }) => {
                if (result.articleInformation.failedToDownload) {
                    result.localBookmark.articleUnavailable = result.articleInformation.articleUnavailable;
                } else {
                    result.localBookmark.contentAvailableLocally = true;
                    result.localBookmark.localFolderRelativePath = result.articleInformation.relativePath;
                    result.localBookmark.hasImages = result.articleInformation.hasImages;
                    result.localBookmark.extractedDescription = result.articleInformation.extractedDescription;
                    result.localBookmark.firstImagePath = result.articleInformation.firstImagePath;
                }

                return dbInstance.updateBookmark(result.localBookmark);
            }).then((bookmark) => {
                this._eventSource.dispatchEvent("syncingarticlecompleted", { bookmark_id: bookmark_id });

                return bookmark;
            });
        }

        public removeFilesForNotPresentArticles(instapaperDB: av.InstapaperDB): WinJS.Promise<any> {
            var files = this._destinationFolder.getFilesAsync();

            var currentBookmarkIds = instapaperDB.listCurrentBookmarks().then((bookmarks) => {
                var bookmark_ids: IBookmarkHash = {};

                bookmarks.forEach((bookmark) => {
                    bookmark_ids[bookmark.bookmark_id] = "";
                });

                return bookmark_ids;
            });

            var folderMap = this._destinationFolder.getFoldersAsync().then((folders: c.IVectorView<st.StorageFolder>) => {
                var map: IFolderMap = {};

                folders.forEach((folder) => {
                    map[folder.name] = folder;
                });

                return map;
            });

            return WinJS.Promise.join({
                currentBookmarkIds: currentBookmarkIds,
                folderMap: folderMap,
                files: files,
            }).then((result: { currentBookmarkIds: IBookmarkHash, files: c.IVectorView<st.StorageFile>, folderMap: IFolderMap }) => {
                var deletions: Windows.Foundation.IAsyncAction[] = [];

                result.files.forEach((file: st.StorageFile) => {
                    // If the local file isn't HTML, then it's not of interest to us
                    if (!(file.fileType.toLowerCase() === ".html")) {
                        return;
                    }

                    // Do magic to convert the filename (which includes the extension) into
                    // a number we can use to look up the ID
                    var bookmarkIdPartOfFileName = file.name.replace(file.fileType, "");
                    var bookmark_id: number = Number(bookmarkIdPartOfFileName);
                    if (isNaN(bookmark_id)) {
                        return;
                    }

                    // If the bookmark ID isn't in the list
                    if (result.currentBookmarkIds.hasOwnProperty(bookmark_id.toString())) {
                        return;
                    }

                    // Delete the the file
                    deletions.push(file.deleteAsync());

                    // if theres a folder matching it, delete that too
                    var folderToDelete = result.folderMap[bookmark_id.toString()];
                    if (!folderToDelete) {
                        return;
                    }

                    deletions.push(folderToDelete.deleteAsync());
                });

                return WinJS.Promise.join(deletions);
            });
        }

        public get events() {
            return this._eventSource;
        }

        private _processArticle(file: st.StorageFile, bookmark_id: number): WinJS.Promise<IProcessedArticleInformation> {
            var fileContentsOperation = st.FileIO.readTextAsync(file);
            var parser = new DOMParser();
            var articleDocument: Document;

            var filePath = file.path.substr(this._localFolderPathLength).replace(/\\/g, "/");
            var processedInformation = {
                hasImages: false,
                firstImagePath: undefined,
                relativePath: filePath,
                extractedDescription: null,
            };

            return fileContentsOperation.then((contents: string) => {
                articleDocument = parser.parseFromString(contents, "text/html");
                var images = <HTMLImageElement[]><any>WinJS.Utilities.query("img", articleDocument.body);

                var articleCompleted: any = WinJS.Promise.as(false);

                // No point in processing the document if we don't have any images.
                if (images.length > 0) {
                    processedInformation.hasImages = true;

                    // Remove the file extension to create directory name that can be used
                    // to store the images simply. This is done by removing the file extension
                    // from whatever the actual article file name.
                    var imagesFolderName = file.name.replace(file.fileType, "")

                    // The <any> cast here is because of the lack of a meaingful
                    // covariance of the types in TypeScript. Or another way: I got this shit, yo.
                    this._eventSource.dispatchEvent("processingimagesstarting", { bookmark_id: bookmark_id });
                    articleCompleted = this._processImagesInArticle(images, imagesFolderName, bookmark_id).then((firstImagePath) => {
                        processedInformation.firstImagePath = firstImagePath;
                        this._eventSource.dispatchEvent("processingimagescompleted", { bookmark_id: bookmark_id });
                        return true;
                    });
                }
                
                // If the article actually has some content, extract the first 200 or so
                // characters, and allow them to be persisted into the DB later.
                var documentContentAsText = articleDocument.body.innerText;
                if (documentContentAsText) {
                    processedInformation.extractedDescription = documentContentAsText.substr(0, 200);
                }

                return articleCompleted;
            }).then((articleWasAltered: boolean) => {
                if (!articleWasAltered) {
                    return;
                }

                // Since we processed the article in some form, we need to
                // barf it back out disk w/ the modifications
                var rewrittenArticleContent = articleDocument.documentElement.outerHTML;
                st.FileIO.writeTextAsync(file, rewrittenArticleContent);
            }).then(() => processedInformation);
        }

        private _processImagesInArticle(images: HTMLImageElement[], imagesFolderName: string, bookmark_id: number): WinJS.Promise<string> {
            var imagesFolder = this._destinationFolder.createFolderAsync(imagesFolderName, st.CreationCollisionOption.openIfExists);
            var firstSuccessfulImage = "";

            return imagesFolder.then((folder: st.StorageFolder) => {
                return Utilities.serialize(images, (image: HTMLImageElement, index: number) => {
                    try {
                        if (!image.src ||
                            (image.src.indexOf(document.location.origin) === 0) ||
                            (image.src.indexOf("data:") === 0)) {
                            return;
                        }
                    } catch (e) {
                        return;
                    }

                    var sourceUrl = new Windows.Foundation.Uri(image.src);
                    this._eventSource.dispatchEvent("processingimagestarting", { bookmark_id: bookmark_id });
                    // Download the iamge from the service and then rewrite
                    // the URL on the image tag to point to the now downloaded
                    // image
                    return this._downloadImageToDisk(sourceUrl, index, folder).then((fileName: string) => {
                        image.src = "ms-appdata:///local/" + this._destinationFolder.name + "/" + imagesFolderName + "/" + fileName;

                        if (!firstSuccessfulImage) {
                            firstSuccessfulImage = image.src;
                        }

                        this._eventSource.dispatchEvent("processingimagecompleted", { bookmark_id: bookmark_id });
                    }, (e: { errorCode: number }) => {
                        if (e.errorCode !== 404) {
                            return WinJS.Promise.wrapError(e);
                        }
                    });
                }, 4);
            }).then(() => firstSuccessfulImage);
        }

        private _downloadImageToDisk(
            sourceUrl: Windows.Foundation.Uri,
            destinationFileNumber: number,
            destinationFolder: st.StorageFolder): WinJS.Promise<string> {

            var client = new http.HttpClient();
            client.defaultRequestHeaders.userAgent.append(this._clientInformation.getUserAgentHeader());

            var downloadStream = client.getAsync(sourceUrl).then((response: http.HttpResponseMessage) => {
                if (!response.isSuccessStatusCode) {
                    return WinJS.Promise.wrapError({
                        errorCode: response.statusCode,
                    });
                }

                var destinationFileName;

                // Detect what the file type is from the contentType that the
                // service responded with.
                switch (response.content.headers.contentType.mediaType.toLocaleLowerCase()) {
                    case "image/jpg":
                    case "image/jpeg":
                        destinationFileName = destinationFileNumber + ".jpg";
                        break;

                    case "image/png":
                        destinationFileName = destinationFileNumber + ".png";
                        break;

                    case "image/svg+xml":
                        destinationFileName = destinationFileNumber + ".svg";
                        break;

                    case "image/gif":
                        destinationFileName = destinationFileNumber + ".gif";
                        break;

                    default:
                        debugger;
                        destinationFileName = destinationFileNumber + "";
                        break;
                }

                var destinationFileStream = destinationFolder.createFileAsync(
                    destinationFileName,
                    st.CreationCollisionOption.replaceExisting).then((file: st.StorageFile) => file.openAsync(st.FileAccessMode.readWrite));

                // TypeScript got real confused by the types here,
                // so cast them away like farts in the wind
                return <any>WinJS.Promise.join({
                    remoteContent: response.content,
                    destination: destinationFileStream,
                    destinationFileName: destinationFileName,
                });
            });

            // Write the stream to disk
            return downloadStream.then((result: { destination: st.Streams.IRandomAccessStream, remoteContent: http.IHttpContent, destinationFileName: string }) => {
                return result.remoteContent.writeToStreamAsync(result.destination).then(() => result);
            }).then((result) => {
                result.destination.close();
                result.remoteContent.close();

                // Return the filename so that the image URL
                // can be rewritten.
                return result.destinationFileName;
            });
        }
    }
}