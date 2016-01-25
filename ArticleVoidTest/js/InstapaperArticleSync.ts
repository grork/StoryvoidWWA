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
    }

    interface IBookmarkHash { [id: number]: string };
    interface IFolderMap { [name: string]: st.StorageFolder };

    export class InstapaperArticleSync {
        private _bookmarksApi: api.Bookmarks;
        private _localFolderPathLength: number;

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
        }

        public syncAllArticlesNotDownloaded(idb: InstapaperDB): WinJS.Promise<any> {
            return idb.listCurrentBookmarks().then((bookmarks) => {
                var notDownloadedBookmarks = bookmarks.filter((bookmark) => {
                    return !bookmark.contentAvailableLocally;
                });

                return Codevoid.Utilities.serialize(notDownloadedBookmarks, (item: IBookmark) => {
                    return this.syncSingleArticle(item.bookmark_id, idb).then(null, () => {
                    });
                });
            });
        }

        public syncSingleArticle(bookmark_id: number, dbInstance: av.InstapaperDB): WinJS.Promise<IBookmark> {
            var processArticle = this._bookmarksApi.getTextAndSaveToFileInDirectory(bookmark_id, this._destinationFolder).then(
                (file: st.StorageFile) => this._processArticle(file));

            return WinJS.Promise.join({
                articleInformation: processArticle,
                localBookmark: dbInstance.getBookmarkByBookmarkId(bookmark_id)
            }).then((result: { articleInformation: IProcessedArticleInformation, localBookmark: av.IBookmark }) => {

                result.localBookmark.contentAvailableLocally = true;
                result.localBookmark.localFolderRelativePath = result.articleInformation.relativePath;
                result.localBookmark.hasImages = result.articleInformation.hasImages;

                return dbInstance.updateBookmark(result.localBookmark);
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

        private _processArticle(file: st.StorageFile): WinJS.Promise<IProcessedArticleInformation> {
            var fileContentsOperation = st.FileIO.readTextAsync(file);
            var parser = new DOMParser();
            var articleDocument: Document;

            var filePath = file.path.substr(this._localFolderPathLength).replace(/\\/g, "/");
            var processedInformation = {
                hasImages: false,
                relativePath: filePath,
            };

            return fileContentsOperation.then((contents: string) => {
                articleDocument = parser.parseFromString(contents, "text/html");
                var images = WinJS.Utilities.query("img", articleDocument.body);

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
                    articleCompleted = this._processImagesInArticle(<HTMLImageElement[]><any>images, imagesFolderName);
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

        private _processImagesInArticle(images: HTMLImageElement[], imagesFolderName: string): WinJS.Promise<boolean> {
            var imagesFolder = this._destinationFolder.createFolderAsync(imagesFolderName, st.CreationCollisionOption.openIfExists);

            return imagesFolder.then((folder: st.StorageFolder) => {
                return Utilities.serialize(images, (image: HTMLImageElement, index: number) => {
                    var sourceUrl = new Windows.Foundation.Uri(image.src);

                    // Download the iamge from the service and then rewrite
                    // the URL on the image tag to point to the now downloaded
                    // image
                    return this._downloadImageToDisk(sourceUrl, index, folder).then((fileName: string) => {
                        image.src = "ms-appdata:///local/" + this._destinationFolder.name + "/" + imagesFolderName + "/" + fileName;
                    });
                });
            }).then(() => true);
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
                    case "image/jpeg":
                        destinationFileName = destinationFileNumber + ".jpg";
                        break;

                    case "image/png":
                        destinationFileName = destinationFileNumber + ".png";
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