module Codevoid.ArticleVoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.ArticleVoid;
    import api = Codevoid.ArticleVoid.InstapaperApi;
    import st = Windows.Storage;

    interface IProcessedArticleInformation {
        relativePath: string;
        hasImages: boolean;
    }

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

        private _processArticle(file: st.StorageFile): WinJS.Promise<IProcessedArticleInformation> {
            var fileContentsOperation = st.FileIO.readTextAsync(file);

            var filePath = file.path.substr(this._localFolderPathLength).replace(/\\/g, "/");
            var processedInformation = {
                hasImages: false,
                relativePath: filePath,
            };

            return fileContentsOperation.then((contents: string) => {
                var parser = new DOMParser();
                var articleDocument = parser.parseFromString(contents, "text/html");
                var images = WinJS.Utilities.query("img", articleDocument.body);

                if (images.length > 1) {
                    // TODO: Handle images
                    debugger;
                }

                return processedInformation;
            });
        }
    }
}