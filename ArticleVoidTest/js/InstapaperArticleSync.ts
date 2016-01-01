module Codevoid.ArticleVoid {
    import oauth = Codevoid.OAuth;
    import av = Codevoid.ArticleVoid;
    import api = Codevoid.ArticleVoid.InstapaperApi;
    import st = Windows.Storage;

    export class InstapaperArticleSync {
        private _bookmarksApi: api.Bookmarks;
        constructor(
            private _clientInformation: oauth.ClientInformation,
            private _destinationFolder: st.StorageFolder
        ) {
            if (!_destinationFolder) {
                throw new Error("Must supply valid destination folder");
            }

            this._bookmarksApi = new api.Bookmarks(this._clientInformation);
        }

        public syncSingleArticle(bookmark_id: number, dbInstance: av.InstapaperDB): WinJS.Promise<IBookmark> {
            return WinJS.Promise.join({
                content: this._bookmarksApi.getTextAndSaveToFileInDirectory(bookmark_id, this._destinationFolder),
                localBookmark: dbInstance.getBookmarkByBookmarkId(bookmark_id),
            }).then((result: { content: st.StorageFile, localBookmark: av.IBookmark }) => {
                result.localBookmark.contentAvailableLocally = true;

                return dbInstance.updateBookmark(result.localBookmark);
            });
        }
    }
}