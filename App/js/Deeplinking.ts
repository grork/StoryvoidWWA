module Codevoid.Storyvoid {
    export class Deeplinking {
        public static extractBookmarkInformationFromUri(uri: Windows.Foundation.Uri): UI.IAppLaunchInformation {
            if (!uri || uri.host !== "openarticle") {
                return null;
            }

            const result: UI.IAppLaunchInformation = {
                bookmark_id: 0,
                originalUrl: null,
            };

            let rawBookmarkId: string;
            let rawOriginalUrl: string;

            // Theres no way on the queryParsed object to easily
            // see if there is a key present, so just loop through
            // them all and pull out the ones we're going to do
            // something with.
            uri.queryParsed.forEach((entry) => {
                switch (entry.name) {
                    case "bookmark_id":
                        rawBookmarkId = entry.value;
                        break;

                    case "original_url":
                        rawOriginalUrl = entry.value;
                        break;
                }
            });

            const bookmarkId = parseInt(rawBookmarkId, 10);
            if (!isNaN(bookmarkId)) {
                result.bookmark_id = bookmarkId;
            }

            try {
                const originalUrl = new Windows.Foundation.Uri(rawOriginalUrl);
                result.originalUrl = originalUrl;
            } catch { }

            return result;
        }

        public static getUriForBookmark(bookmark: IBookmark): string {
            return `storyvoid://openarticle/?bookmark_id=${bookmark.bookmark_id}&original_uri=${bookmark.url}`;
        }
    }
}