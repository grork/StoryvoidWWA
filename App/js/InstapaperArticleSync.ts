namespace Codevoid.Storyvoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.Storyvoid;
    import api = Codevoid.Storyvoid.InstapaperApi;
    import st = Windows.Storage;
    import http = Windows.Web.Http;
    import c = Windows.Foundation.Collections;

    interface IFirstImageInformation {
        readonly localPath: string;
        readonly originalUrl: string;
    }

    interface IProcessedArticleInformation {
        hasImages: boolean;
        firstImageInformation: IFirstImageInformation,
        extractedDescription: string;
        readonly relativePath: string;
        readonly failedToDownload: boolean;
        readonly articleUnavailable: boolean;
    }

    interface IBookmarkHash { [id: number]: string };
    interface IFolderMap { [name: string]: st.StorageFolder };

    enum SpecializedThumbnail {
        None,
        YouTube,
        Vimeo
    }

    function getFilenameIfImageMeetsCriteria(data: {
        extension: string;
        size: { width: number; height: number };
        folder: string;
        filename: string;
    }): string {
        if (data.extension == "gif") {
            return null;
        }

        if (data.size.width < 150 || data.size.height < 150) {
            return null;
        }

        return "ms-appdata:///local/" + data.folder + "/" + data.filename;
    }

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

        public async syncAllArticlesNotDownloaded(idb: InstapaperDB, cancellationSource: Utilities.CancellationSource): Promise<void> {
            this._eventSource.dispatchEvent("allarticlesstarting", null);

            // First list all the current folders, and then sort them by 
            // ID (E.g. well known first)
            const folders = await idb.listCurrentFolders();
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
            const bookmarks = folders.map(async (folder) => {
                let folderBookmarks = await idb.listCurrentBookmarks(folder.id);
                folderBookmarks = folderBookmarks.filter((bookmark) => !bookmark.contentAvailableLocally && !bookmark.articleUnavailable);

                folderBookmarks.sort((bookmarkA, bookmarkB) => {
                    if (bookmarkA.bookmark_id < bookmarkB.bookmark_id) {
                        return -1;
                    }

                    if (bookmarkA.bookmark_id > bookmarkB.bookmark_id) {
                        return 1;
                    }

                    return 0;
                });

                return folderBookmarks;
            });

            const bookmarksByFolder = await Promise.all(bookmarks);
            // Flatten them all into on big array, assuming that
            // they're implicitly sorted now
            let articlesByUnreadFirst = [];

            for (let bookmarks of bookmarksByFolder) {
                articlesByUnreadFirst = articlesByUnreadFirst.concat(bookmarks);
            }

            await Codevoid.Utilities.serialize(articlesByUnreadFirst, async (item: IBookmark) => {
                try {
                    await this.syncSingleArticle(item.bookmark_id, idb, cancellationSource);
                } catch (e) { /* Eat errors */ }

                return null;
            }, 4, cancellationSource);


            this._eventSource.dispatchEvent("allarticlescompleted", null);
        }

        public async syncSingleArticle(bookmark_id: number, dbInstance: av.InstapaperDB, cancellationSource: Utilities.CancellationSource): Promise<IBookmark> {
            const localBookmark = await dbInstance.getBookmarkByBookmarkId(bookmark_id);
            this._eventSource.dispatchEvent("syncingarticlestarting", {
                bookmark_id: bookmark_id,
                title: localBookmark.title,
            });

            const articleStartTime = Date.now();

            const file = await this._bookmarksApi.getTextAndSaveToFileInDirectory(bookmark_id, this._destinationFolder);
            let articleInformation: IProcessedArticleInformation;
            try {
                articleInformation = await this._processArticle(file, localBookmark, cancellationSource);
            } catch (e) {
                articleInformation = {
                    articleUnavailable: (e && e.file && e.file.error === 1550),
                    failedToDownload: true,
                    relativePath: null,
                    hasImages: false,
                    firstImageInformation: null,
                    extractedDescription: null,
                };
            }

            if (articleInformation.failedToDownload) {
                localBookmark.articleUnavailable = articleInformation.articleUnavailable;
            } else {
                localBookmark.contentAvailableLocally = true;
                localBookmark.localFolderRelativePath = articleInformation.relativePath;
                localBookmark.hasImages = articleInformation.hasImages;
                localBookmark.extractedDescription = articleInformation.extractedDescription;
                if (articleInformation.firstImageInformation) {
                    localBookmark.firstImagePath = articleInformation.firstImageInformation.localPath;
                    localBookmark.firstImageOriginalUrl = articleInformation.firstImageInformation.originalUrl;
                }
            }

            const bookmark = await dbInstance.updateBookmark(localBookmark);
            this._eventSource.dispatchEvent("syncingarticlecompleted", { bookmark_id: bookmark_id });
            return bookmark;
        }

        public async removeFilesForNotPresentArticles(instapaperDB: av.InstapaperDB): Promise<void> {
            const filesOperation = this._destinationFolder.getFilesAsync();
            const currentBookmarksOperation = instapaperDB.listCurrentBookmarks();
            const foldersOperation = this._destinationFolder.getFoldersAsync();

            let [currentBookmarks, folders, files] = await Promise.all([currentBookmarksOperation, foldersOperation, filesOperation]);

            const currentBookmarkIds: IBookmarkHash = {};
            for (let bookmark of currentBookmarks) {
                currentBookmarkIds[bookmark.bookmark_id] = "";
            }

            const folderMap: IFolderMap = {};
            for (let folder of folders) {
                folderMap[folder.name] = folder;
            }

            const deletions: PromiseLike<void>[] = [];
            for (const file of files) {
                // If the local file isn't HTML, then it's not of interest to us
                if (!(file.fileType.toLowerCase() === ".html")) {
                    continue;
                }

                // Do magic to convert the filename (which includes the extension) into
                // a number we can use to look up the ID
                var bookmarkIdPartOfFileName = file.name.replace(file.fileType, "");
                var bookmark_id: number = Number(bookmarkIdPartOfFileName);
                if (isNaN(bookmark_id)) {
                    continue;
                }

                // If the bookmark ID isn't in the list
                if (currentBookmarkIds.hasOwnProperty(bookmark_id.toString())) {
                    continue;
                }

                // Delete the the file
                deletions.push(file.deleteAsync());

                // if theres a folder matching it, delete that too
                var folderToDelete = folderMap[bookmark_id.toString()];
                if (!folderToDelete) {
                    continue;
                }

                deletions.push(folderToDelete.deleteAsync());
            }

            await Promise.all(deletions);
        }

        public get events() {
            return this._eventSource;
        }

        private async _processArticle(file: st.StorageFile, bookmark: IBookmark, cancellationSource: Utilities.CancellationSource): Promise<IProcessedArticleInformation> {
            const parser = new DOMParser();

            const filePath = file.path.substr(this._localFolderPathLength).replace(/\\/g, "/");
            const processedInformation: IProcessedArticleInformation = {
                relativePath: filePath,
                hasImages: false,
                firstImageInformation: undefined,
                extractedDescription: null,
                failedToDownload: false,
                articleUnavailable: false,
            };

            const contents = await st.FileIO.readTextAsync(file);
            if (cancellationSource.cancelled) {
                throw new Error("Article Sync Cancelled: Processing Article: After Reading file");
            }

            let images: HTMLImageElement[];
            const articleDocument = parser.parseFromString(contents, "text/html");

            // See if the URL is for youtube, to allow customized processing of
            // youtube.com addresses so we have a better reader experience
            let uri: Windows.Foundation.Uri = null;

            // Determine if this article requires customized downloading
            // of the thumbnail (E.g. it's not gonna be in the article)
            let thumbnailType: SpecializedThumbnail = SpecializedThumbnail.None;
            try {
                uri = new Windows.Foundation.Uri(bookmark.url);
                thumbnailType = InstapaperArticleSync.urlRequiresCustomThumbnail(uri);
            } catch (e) { }

            switch (thumbnailType) {
                case SpecializedThumbnail.YouTube:
                    const videoID = uri.queryParsed.filter((entry) => entry.name === "v")[0];
                    const ytImageElement = document.createElement("img");
                    ytImageElement.src = "https://img.youtube.com/vi/" + videoID.value + "/hqdefault.jpg";
                    images = [ytImageElement];
                    break;

                case SpecializedThumbnail.Vimeo:
                    // Vimeo is a special snowflake; they don't have a supported
                    // URL format that allows the images to be referenced directly
                    //
                    // So, we need to go get a JSON blob from vimeo, and query that
                    // for the URL for the thumbnail.
                    //
                    // Documentation for the oEmbed API call:
                    // https://developer.vimeo.com/apis/oembed
                    const dataUri = new Windows.Foundation.Uri("https://vimeo.com/api/oembed.json?url=" + uri)
                    const client = new Windows.Web.Http.HttpClient();
                    client.defaultRequestHeaders.userAgent.append(this._clientInformation.getUserAgentHeader());

                    // Attempt to get the data, and pass on the string to be parsed into JSON
                    const response = await client.getAsync(dataUri);
                    if (!response.isSuccessStatusCode) {
                        throw {
                            errorCode: response.statusCode,
                        };
                    }

                    const data = await response.content.readAsStringAsync();
                    response.close();

                    let json: { thumbnail_url: string };
                    try {
                        json = JSON.parse(data);
                    } catch (ex) { }

                    // If we didn't get anything back, or we didn't get URL
                    // just return an empty array
                    if (!json || !json.thumbnail_url) {
                        images = [];
                    }

                    const vimeoImageElement = document.createElement("img");
                    vimeoImageElement.src = json.thumbnail_url;

                    images = [vimeoImageElement];
                    break;

                case SpecializedThumbnail.None:
                default:
                    images = <HTMLImageElement[]><any>WinJS.Utilities.query("img", articleDocument.body);
                    break;
            }

            // Apppend messaging bootstrapper to allow two way
            // messaging between the webview we load this in,
            // and the host page.
            const scriptTag = articleDocument.createElement("script");
            scriptTag.src = "ms-appx-web:///js/WebViewMessenger_client.js";
            articleDocument.head.appendChild(scriptTag);

            // Not all pages with content have a block element as their
            // body-content. This means they get inline sizing, which results
            // in weird sizing (E.g. no margin).
            //
            // To overcome this in a consistent way, just take all the children
            // from the body, and place them inside a wrapper div.
            //
            // Note, that since they're not elements, you can't just
            // look at children. You can't use childNodes either since
            // that represents the entire tree. So, lets just reparent
            // the firstChild until there is no more first child
            const wrapperTag = articleDocument.createElement("div");
            while (articleDocument.body.firstChild) {
                wrapperTag.appendChild(articleDocument.body.firstChild)
            }

            // Now we've got the things reparented, place the wrapper
            // into the document.
            articleDocument.body.appendChild(wrapperTag);

            if (images && images.length > 0) {
                // No point in processing the document if we don't have any images.
                processedInformation.hasImages = true;

                // Remove the file extension to create directory name that can be used
                // to store the images simply. This is done by removing the file extension
                // from whatever the actual article file name.
                const imagesFolderName = file.name.replace(file.fileType, "")

                // The <any> cast here is because of the lack of a meaingful
                // covariance of the types in TypeScript. Or another way: I got this, yo.
                this._eventSource.dispatchEvent("processingimagesstarting", { bookmark_id: bookmark.bookmark_id });
                const firstImagePath = await this._processImagesInArticle(images, imagesFolderName, bookmark.bookmark_id, cancellationSource);
                if (firstImagePath) {
                    processedInformation.firstImageInformation = firstImagePath;
                } else {
                    // if we never found a first image that successfully downloaded
                    // we should just assume that there were no real images.
                    processedInformation.hasImages = false;
                }

                this._eventSource.dispatchEvent("processingimagescompleted", { bookmark_id: bookmark.bookmark_id });
            }

            // If the article actually has some content, extract the first 200 or so
            // characters, and allow them to be persisted into the DB later.
            const documentContentAsText = articleDocument.body.innerText;
            if (documentContentAsText) {
                processedInformation.extractedDescription = documentContentAsText.substr(0, 400);
            }

            // Since we processed the article in some form, we need to
            // barf it back out disk w/ the modifications
            const rewrittenArticleContent = "<!DOCTYPE html>\r\n" + articleDocument.documentElement.outerHTML;
            await st.FileIO.writeTextAsync(file, rewrittenArticleContent, st.Streams.UnicodeEncoding.utf8);
            return processedInformation;
        }

        private async _processImagesInArticle(images: HTMLImageElement[], imagesFolderName: string, bookmark_id: number, cancellationSource: Utilities.CancellationSource): Promise<IFirstImageInformation> {
            const folder = await this._destinationFolder.createFolderAsync(imagesFolderName, st.CreationCollisionOption.openIfExists);
            if (cancellationSource.cancelled) {
                throw new Error("Article Sync Cancelled: Processing Images");
            }

            let firstSuccessfulImage: { localPath: string; originalUrl: string };
            await Utilities.serialize(images, async (image: HTMLImageElement, index: number) => {
                let sourceUrl: Windows.Foundation.Uri;
                try {
                    if (!image.src ||
                        (image.src.indexOf(document.location.origin) === 0) ||
                        (image.src.indexOf("data:") === 0)) {
                        return;
                    }

                    sourceUrl = new Windows.Foundation.Uri(image.src);
                } catch (e) {
                    return;
                }

                // Only support HTTP / HTTPS links
                var scheme = sourceUrl.schemeName.toLowerCase();
                switch (scheme) {
                    case "http":
                    case "https":
                        break;

                    default:
                        return;
                }

                this._eventSource.dispatchEvent("processingimagestarting", { bookmark_id: bookmark_id });

                try {
                    // Download the image from the service and then rewrite
                    // the URL on the image tag to point to the now downloaded
                    // image
                    const result = await this._downloadImageToDisk(sourceUrl, index, folder);
                    
                    // Check if the image is actually in a DOM of somesorts.
                    // This is a trick/indiciator that this is a specialist
                    // download e.g. YouTube, Vimeo etc -- e.g. something
                    // that isn't in the actual downloaded document.
                    if (image.parentElement) {
                        image.src = imagesFolderName + "/" + result.filename;
                    }

                    if (!firstSuccessfulImage && (result.extension != "gif")) {
                        firstSuccessfulImage = { localPath: "", originalUrl: "" };
                        firstSuccessfulImage.localPath = getFilenameIfImageMeetsCriteria({
                            extension: result.extension,
                            size: result.size,
                            folder: this._destinationFolder.name + "/" + imagesFolderName,
                            filename: result.filename
                        });

                        // If we did find a candidate image for the first image, lets also
                        // save the original URI into the database. This is so that when we create
                        // external information for this article later (UserActivity, or shareing)
                        // we have an externally accessible image URL 
                        if (firstSuccessfulImage.localPath) {
                            firstSuccessfulImage.originalUrl = sourceUrl.absoluteUri;
                        }
                    }

                    this._eventSource.dispatchEvent("processingimagecompleted", { bookmark_id: bookmark_id });
                } catch(e) {
                    // For each image that fails, remove it from it's parent DOM so that
                    // we don't get little X's inside the viewer when rendered there.
                    if (image.parentElement) {
                        image.parentElement.removeChild(image);
                    }
                }
            }, 4, cancellationSource);
            return firstSuccessfulImage;
        }

        private async _downloadImageToDisk(
            sourceUrl: Windows.Foundation.Uri,
            destinationFileNumber: number,
            destinationFolder: st.StorageFolder): Promise<{ filename: string; extension: string; size: { width: number, height: number } }> {

            const client = new http.HttpClient();
            client.defaultRequestHeaders.userAgent.append(this._clientInformation.getUserAgentHeader());

            const response = await client.getAsync(sourceUrl);
            if (!response.isSuccessStatusCode) {
                throw {
                    errorCode: response.statusCode,
                };
            }

            const buffer = await response.content.readAsBufferAsync();
            var header = "";

            // Get the buffer in an indexable fashion, then loop through to
            // the MAX_SNIFF_BYTES to find the pre-amble of the file, converting
            // into *HEX* strings along the way.
            const reader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
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

            header = header.toLowerCase();
            let destinationFileName: string;
            let extension = "";

            // Turns out, the mime type header is complete
            // and utter crap, and is often wrong. So lets just faff
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
                        destinationFileName = `${destinationFileNumber}`;
                        break;
                }
            }

            // Compute the final file name w. extension
            destinationFileName = `${destinationFileNumber}.${extension}`;

            const destinationFile = await destinationFolder.createFileAsync(destinationFileName, st.CreationCollisionOption.replaceExisting);
            const destinationStream = await destinationFile.openAsync(st.FileAccessMode.readWrite);

            // Write the stream to disk
            await response.content.writeToStreamAsync(destinationStream);

            response.content.close();
            destinationStream.close();

            // Get the size from the file properties, so we can decide
            // if it's worth using as a preview image. Note, the image
            // size here is in physical pixels, and doesn't take into
            // account the scale factor of the device.
            let size = { width: 0, height: 0 };
            try {
                const properties = await destinationFile.properties.getImagePropertiesAsync();

                size = {
                    width: properties.width,
                    height: properties.height,
                };
            } catch (e) { }

            // Return the filename so that the image URL
            // can be rewritten.
            return {
                filename: destinationFileName,
                extension,
                size
            };
        }

        private static urlRequiresCustomThumbnail(uri: Windows.Foundation.Uri): SpecializedThumbnail {
            const host = uri.host.toLowerCase();
            const path = uri.path.toLowerCase();

            if ((host === "youtube.com" || host === "www.youtube.com")
                && (path === "/watch")) {
                // YouTube URLs are of the format:
                // http[s]://[www.]youtube.com/watch?v=ID
                const videoID = uri.queryParsed.filter((entry) => entry.name === "v")[0];

                // Make sure we've got a Video ID, vs some other
                // random part of YouTube
                if (videoID) {
                    return SpecializedThumbnail.YouTube;
                }
            } else if ((host === "vimeo.com" || host === "www.vimeo.com")
                && uri.path && (uri.path.length > 1)) {
                // Vimeo URLs are of the format:
                // http[s]://[www.]vimeo.com/IntegerNumericId

                // Drop the leading /
                const parsedPath = parseInt(uri.path.substring(1));

                // If the parsed part is actually a number, we
                if (!isNaN(parsedPath)) {
                    return SpecializedThumbnail.Vimeo;
                }
            }

            return SpecializedThumbnail.None;
        }
    }
}