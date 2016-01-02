module Codevoid.ArticleVoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.ArticleVoid;
    import api = Codevoid.ArticleVoid.InstapaperApi;
    import st = Windows.Storage;

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
            return WinJS.Promise.join({
                content: this._bookmarksApi.getTextAndSaveToFileInDirectory(bookmark_id, this._destinationFolder),
                localBookmark: dbInstance.getBookmarkByBookmarkId(bookmark_id),
            }).then((result: { content: st.StorageFile, localBookmark: av.IBookmark }) => {
                result.localBookmark.contentAvailableLocally = true;

                var relativePath = result.content.path.substr(this._localFolderPathLength).replace(/\\/g, "/");
                result.localBookmark.localFolderRelativePath = relativePath;

                return dbInstance.updateBookmark(result.localBookmark);
            });
        }
    }
}