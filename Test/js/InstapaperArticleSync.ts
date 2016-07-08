module Codevoid.Storyvoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.Storyvoid;
    import api = Codevoid.Storyvoid.InstapaperApi;
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

    // Content sniffing headers
    // See:
    // https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
    // https://en.wikipedia.org/wiki/List_of_file_signatures
    // http://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload/29672957#29672957
    const PNG_HEADER: string     = "89504e470d0a1a0a"; // 8 bytes
    const JPEG_HEADER_1: string  = "ffd8ffdb"; // 4 bytes
    const JPEG_HEADER_2: string  = "ffd8ffe0"; // 4 bytes
    const JPEG_HEADER_3: string  = "ffd8ffe1"; // 4 bytes
    const GIF_HEADER_87A: string = "474946383761"; // 6 bytes
    const GIF_HEADER_89A: string = "474946383961"; // 6 bytes

    // Largest number of bytes to read a complete pre-amble for the above file formats
    // Set to 8 for a PNG initially
    const MAX_SNIFF_BYTES: number = 8;

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

                var imagesCompleted: WinJS.Promise<any> = WinJS.Promise.as();

                // Apppend messaging bootstrapper to allow two way
                // messaging between the webview we load this in,
                // and the host page.
                var scriptTag = articleDocument.createElement("script");
                scriptTag.src = "ms-appx-web:///js/WebViewMessenger_client.js";
                articleDocument.head.appendChild(scriptTag);

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
                    imagesCompleted = this._processImagesInArticle(images, imagesFolderName, bookmark_id).then((firstImagePath) => {
                        if (firstImagePath) {
                            processedInformation.firstImagePath = firstImagePath;
                        } else {
                            // if we never found a first image, that successfully downloaded
                            // we should just assume that there were no real images.
                            processedInformation.hasImages = false;
                        }

                        this._eventSource.dispatchEvent("processingimagescompleted", { bookmark_id: bookmark_id });
                    });
                }
                
                // If the article actually has some content, extract the first 200 or so
                // characters, and allow them to be persisted into the DB later.
                var documentContentAsText = articleDocument.body.innerText;
                if (documentContentAsText) {
                    processedInformation.extractedDescription = documentContentAsText.substr(0, 200);
                }

                return imagesCompleted;
            }).then(() => {
                // Since we processed the article in some form, we need to
                // barf it back out disk w/ the modifications
                var rewrittenArticleContent = "<!DOCTYPE html>\r\n" + articleDocument.documentElement.outerHTML;
                st.FileIO.writeTextAsync(file, rewrittenArticleContent, st.Streams.UnicodeEncoding.utf8);
            }).then(() => processedInformation);
        }

        private _processImagesInArticle(images: HTMLImageElement[], imagesFolderName: string, bookmark_id: number): WinJS.Promise<any> {
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
                        image.src = imagesFolderName + "/" + fileName;

                        if (!firstSuccessfulImage) {
                            firstSuccessfulImage = "ms-appdata:///local/" + this._destinationFolder.name + "/" + imagesFolderName + "/" + fileName;
                        }

                        this._eventSource.dispatchEvent("processingimagecompleted", { bookmark_id: bookmark_id });
                    }, (e: { errorCode: number }) => {
                        // For each image that fails, remove it from it's parent DOM so that
                        // we don't get little X's inside the viewer when rendered there.
                        image.parentElement.removeChild(image);
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

                // Cast away the type, since it seems to be wrong, and
                // and isn't really relevant
                return WinJS.Promise.join({
                    buffer: response.content.readAsBufferAsync(),
                    response: response
                });
            }).then((result: any) => {
                var header = "";
                var buffer: st.Streams.IBuffer = result.buffer;

                // Get the buffer in an indexable fashion, then loop through to
                // the MAX_SNIFF_BYTES to find the pre-amble of the file, converting
                // into *HEX* strings along the way.
                var reader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                for (var i = 0; (i < MAX_SNIFF_BYTES) && (i < buffer.length); i++) {
                    var byte = reader.readByte();

                    // If it's < 10 (hex), then add "0" for completness
                    if (byte < 17) {
                        header += "0";
                    }

                    // Append the hex value
                    header += byte.toString(16);
                }

                reader.close();

                return {
                    header: header.toLowerCase(),
                    response: result.response,
                };
            }).then((result: { header: string; response: http.HttpResponseMessage; }) => {
                var response = result.response;
                var header = result.header;
                var destinationFileName;
                var extension = "";

                // Turns out, the mime type header is complete
                // and utter crap, and is often wrong. So lets just fuck
                // around by sniffing the pre-amble on the file and see
                // what the actual file type might be.
                if (header) {
                    if (header.indexOf(PNG_HEADER) == 0) {
                        extension = "png";
                    } else if (header.indexOf(JPEG_HEADER_1) == 0) {
                        extension = "jpg";
                    } else if (header.indexOf(JPEG_HEADER_2) == 0) {
                        extension = "jpg";
                    } else if (header.indexOf(JPEG_HEADER_3) == 0) {
                        extension = "jpg";
                    } else if (header.indexOf(GIF_HEADER_87A) == 0) {
                        extension = "gif";
                    } else if (header.indexOf(GIF_HEADER_89A) == 0) {
                        extension = "gif";
                    }
                }

                // If we didn't find the extension by content sniffing, then
                // lets try and trust the actual media type.
                if (!extension) {
                    // Detect what the file type is from the contentType that the
                    // service responded with.
                    switch (response.content.headers.contentType.mediaType.toLocaleLowerCase()) {
                        case "image/jpg":
                        case "image/jpeg":
                            extension = "jpg";
                            break;

                        case "image/png":
                            extension = "png";
                            break;

                        case "image/svg+xml":
                            extension = "svg";
                            break;

                        case "image/gif":
                            extension = "gif";
                            break;

                        default:
                            debugger;
                            destinationFileName = destinationFileNumber + "";
                            break;
                    }
                }

                // Compute the final file name w. extension
                destinationFileName = destinationFileNumber + "." + extension;

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