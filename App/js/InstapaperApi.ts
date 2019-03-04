namespace Codevoid.Storyvoid {
    export interface IFolder {
        title: string;
        localOnly?: boolean;
        folder_id?: string;
        id?: number;
        position?: number;
        folder_dbid?: number;
    }

    export interface IBookmark {
        title: string;
        url?: string;
        bookmark_id: number;
        progress?: number;
        progress_timestamp?: number;
        folder_id?: string;
        folder_dbid?: number;
        time?: number;
        contentAvailableLocally?: boolean;
        hasImages?: boolean;
        firstImagePath?: string;
        firstImageOriginalUrl?: string;
        localFolderRelativePath?: string;
        description?: string;
        extractedDescription?: string;
        articleUnavailable?: boolean;
        starred?: number;
        doNotAddToJumpList?: boolean;
        hash?: string;
        type?: "bookmark";
    }
}

namespace Codevoid.Storyvoid.InstapaperApi {

    //#region Endpoint URLs
    const INSTAPAPER_API_URL = "https://www.instapaper.com/api/1/";

    const AccountEndPoints = {
        access_token: INSTAPAPER_API_URL + "oauth/access_token",
        verify_credentials: INSTAPAPER_API_URL + "account/verify_credentials"
    };

    const BookmarksEndPoints = {
        list: INSTAPAPER_API_URL + "bookmarks/list",
        add: INSTAPAPER_API_URL + "bookmarks/add",
        deleteBookmark: INSTAPAPER_API_URL + "bookmarks/delete",
        move: INSTAPAPER_API_URL + "bookmarks/move",
        updateReadProgress: INSTAPAPER_API_URL + "bookmarks/update_read_progress",
        star: INSTAPAPER_API_URL + "bookmarks/star",
        unstar: INSTAPAPER_API_URL + "bookmarks/unstar",
        archive: INSTAPAPER_API_URL + "bookmarks/archive",
        unarchive: INSTAPAPER_API_URL + "bookmarks/unarchive",
        getText: INSTAPAPER_API_URL + "bookmarks/get_text",
    };

    const FolderEndPoints = {
        list: INSTAPAPER_API_URL + "folders/list",
        add: INSTAPAPER_API_URL + "folders/add",
        deleteFolder: INSTAPAPER_API_URL + "folders/delete",
        setOrder: INSTAPAPER_API_URL + "folders/set_order",
    };
    //#endregion

    function extractSingleItemFromJSONArray(data: string): any {
        return extractDataFromJSON(data, true);
    }

    function extractArrayFromResponse(data: string): any[] {
        return extractDataFromJSON(data, false);
    }

    function extractDataFromJSON(data: string, reduceSingleItemToObject: boolean): any {
        let objectData = (data) ? JSON.parse(data) : "";
        window.appassert(!!objectData, "didn't parse object data");
        window.appassert(Array.isArray(objectData), "Wasn't an array");

        if (objectData.length === 1) {
            if (objectData[0].type === "error") {
                return new Codevoid.Storyvoid.InstapaperApi.InstapaperApiException(objectData[0].error_code, objectData[0].message);
            }

            if (reduceSingleItemToObject) {
                objectData = objectData[0];
            }
        }

        return objectData;
    }

    function handleSingleItemJSONError(error: Codevoid.OAuth.IRequestError): PromiseLike<{ error: number } | { error_code: number; message: string }> {
        var result;

        if (error.response) {
            result = extractSingleItemFromJSONArray(error.response);
        } else {
            result = { error: error.status };
        }

        return WinJS.Promise.wrapError(result);
    }

    export interface IAccessTokenInformation {
        oauth_token: string;
        oauth_token_secret: string;
    }

    export interface IUserInformation {
        readonly type: "user";
        readonly user_id: number;
        readonly username: string;
    }

    export interface IHaveStatus {
        readonly id: number;
        readonly hash?: string;
        readonly progress?: number;
        readonly progressLastChanged?: number;
    }

    export interface IBookmarkListParameters {
        readonly limit?: number;
        readonly folder_id?: string;
        readonly have?: IHaveStatus[];
    }

    export interface IBookmarkListResult {
        readonly bookmarks: IBookmark[];
        readonly meta: { delete_ids: string };
        readonly user: IUserInformation;
        readonly duration: number;
    }

    export interface IBookmarkAddParameters {
        readonly url: string;
        readonly title?: string;
        readonly description?: string;
        readonly folder_id?: string;
    }

    export interface IBookmarkMoveParameters {
        readonly bookmark_id: number;
        readonly destination: string;
    }

    export interface IBookmarkUpdateReadProgressParameters {
        bookmark_id: number;
        progress: number;
        progress_timestamp: number;
    }

    export function getCurrentTimeAsUnixTimestamp(): number {
        const timestampInMilliseconds = Date.now();
        const timestampInSeconds = Math.floor(timestampInMilliseconds / 1000);

        return timestampInSeconds;
    }

    export class InstapaperApiException {
        constructor(public error: number, public message: string) { }
    }

    export class Accounts {
        constructor(private _clientInformation: Codevoid.OAuth.ClientInformation) { }

        public getAccessToken(username: string, password: string): PromiseLike<IAccessTokenInformation> {
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.access_token);
            request.data = [
                { key: "x_auth_username", value: username },
                { key: "x_auth_password", value: password },
                { key: "x_auth_mode", value: "client_auth" }
            ];

            return request.send().then(function extractTokenInfo(responseData: string) {
                window.appassert(!!responseData, "Didn't get response data");
                const nameValuePairs = responseData.split("&");
                const result: IAccessTokenInformation = {
                    oauth_token: null,
                    oauth_token_secret: null,
                };

                for (let item of nameValuePairs) {
                    let tokenParts = item.split("=");
                    const key = decodeURIComponent(tokenParts[0]);
                    result[key] = decodeURIComponent(tokenParts[1]);
                }

                return result;
            });
        }

        public verifyCredentials(): PromiseLike<IUserInformation> {
            var request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.verify_credentials);
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }
    }

    export class Bookmarks {
        constructor(private _clientInformation: Codevoid.OAuth.ClientInformation) { }

        private _updateDailyAddCount(): void {
            const store = Windows.Storage.ApplicationData.current.roamingSettings;
            let current = store.values[this._clientInformation.clientToken];
            if (!current) {
                current = new Windows.Storage.ApplicationDataCompositeValue();
            }

            const currentTimeInNyc = new Date(Date.now() + (3 * 60 * 60 * 1000));
            let previousStoredDateInInNyc = current["date"];
            if (!previousStoredDateInInNyc) {
                window.appfail("You should stop this run, and wait for the roaming setting to roam");
                previousStoredDateInInNyc = Date.now() - (24 * 60 * 60 * 1000);
            }

            current["date"] = currentTimeInNyc.getTime();

            var previousTimeInNyc = new Date(previousStoredDateInInNyc);

            if ((currentTimeInNyc.getFullYear() === previousTimeInNyc.getFullYear())
                && (currentTimeInNyc.getMonth() === previousTimeInNyc.getMonth())
                && (currentTimeInNyc.getDate() === previousTimeInNyc.getDate())
                && current["count"]) {
                current["count"]++;
            } else {
                current["count"] = 1;
            }

            store.values[this._clientInformation.clientToken] = current;

            console.log("Current daily add count: " + current["count"]);
            window.appassert(current["count"] < 121, "Too many adds. Change account, or give up for the day");
        }

        public list(parameters?: IBookmarkListParameters): PromiseLike<IBookmarkListResult> {
            const data: Codevoid.OAuth.NameValuePair[] = [];
            if (parameters) {
                if (parameters.limit) {
                    data.push({ key: "limit", value: parameters.limit });
                }

                if (parameters.folder_id) {
                    data.push({ key: "folder_id", value: parameters.folder_id });
                }

                if (parameters.have && parameters.have.length) {
                    window.appassert(Array.isArray(parameters.have), "expected 'have' parameter to be an array");
                    window.appassert(parameters.have.length > 0, "didn't actually supply any parameters");

                    const haveStrings = parameters.have.map((have) => Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have));

                    window.appassert(haveStrings.length > 0, "didn't get any have strings to send");
                    data.push({ key: "have", value: haveStrings.join(",") });
                }
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.list);

            if (data.length) {
                request.data = data;
            }

            const startTime = Date.now();
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError).then(function stripMetaAndUserObject(data) {
                window.appassert(Array.isArray(data), "Expected array for data");
                window.appassert(data.length > 1, "expected at least 2 objects");

                return {
                    meta: data.shift(),
                    user: data.shift(),
                    bookmarks: data,
                    duration: Date.now() - startTime
                };
            });
        }

        public add(parameters: IBookmarkAddParameters): PromiseLike<IBookmark> {
            if (!parameters.url) {
                throw new Error("Requires URL");
            }

            const data = [
                { key: "url", value: parameters.url }
            ];

            if (parameters.title) {
                data.push({ key: "title", value: parameters.title });
            }

            if (parameters.description) {
                data.push({ key: "description", value: parameters.description });
            }

            if (parameters.folder_id && (parameters.folder_id !== "unread")) {
                data.push({ key: "folder_id", value: parameters.folder_id });
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.add);
            request.data = data;

            this._updateDailyAddCount();
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public deleteBookmark(bookmark_id: number): PromiseLike<any> {
            if (!bookmark_id) {
                throw new Error("Requires bookmark ID to delete");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.deleteBookmark);
            request.data = data;
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public move(parameters: IBookmarkMoveParameters): PromiseLike<IBookmark> {
            if (!parameters.bookmark_id) {
                throw new Error("Requires Bookmark ID");
            }

            if (!parameters.destination) {
                throw new Error("Requires destination folder");
            }

            const data = [
                { key: "bookmark_id", value: parameters.bookmark_id },
                { key: "folder_id", value: parameters.destination },
            ];

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.move);
            request.data = data;

            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public updateReadProgress(parameters: IBookmarkUpdateReadProgressParameters): PromiseLike<IBookmark> {
            if (!parameters.bookmark_id) {
                throw new Error("Requires Bookmark ID");
            }

            if ((parameters.progress < 0.0) || (parameters.progress > 1.0)) {
                throw new Error("Must have valid progress between 0.0 and 1.0");
            }

            if (!parameters.progress_timestamp) {
                throw new Error("Requires timestamp");
            }

            const data = [
                { key: "bookmark_id", value: parameters.bookmark_id },
                { key: "progress", value: parameters.progress },
                { key: "progress_timestamp", value: parameters.progress_timestamp }
            ];

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.updateReadProgress);
            request.data = data;
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public star(bookmark_id: number): PromiseLike<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.star);
            request.data = data;

            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public unstar(bookmark_id: number): PromiseLike<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unstar);
            request.data = data;

            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public archive(bookmark_id: number): PromiseLike<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.archive);
            request.data = [{ key: "bookmark_id", value: bookmark_id }]

            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public unarchive(bookmark_id: number): PromiseLike<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unarchive);
            request.data = [{ key: "bookmark_id", value: bookmark_id }];

            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }

        public getText(bookmark_id: number): PromiseLike<string> {
            if (!bookmark_id) {
                throw new Error("bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.getText);
            request.data = data;

            return <PromiseLike<string>>request.send().then(function (response: string) {
                return response;
            }, handleSingleItemJSONError);
        }

        public getTextAndSaveToFileInDirectory(bookmark_id: number, destinationDirectory: Windows.Storage.StorageFolder): PromiseLike<Windows.Storage.StorageFile> {
            if (!bookmark_id) {
                throw new Error("bookmark ID required");
            }

            if (!destinationDirectory) {
                throw new Error("Directory required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.getText);
            request.data = data;

            const contentRequest = request.retrieveRawContent().then((r) => r, handleSingleItemJSONError);
            const targetFileName = `${bookmark_id}.html`;

            return contentRequest.then((content: Windows.Web.Http.IHttpContent) => {
                const fileOutputStream = destinationDirectory.createFileAsync(targetFileName, Windows.Storage.CreationCollisionOption.replaceExisting).then(function (file) {
                    return file.openAsync(Windows.Storage.FileAccessMode.readWrite);
                });

                return <PromiseLike<any>>WinJS.Promise.join({
                    outputStream: fileOutputStream,
                    inputStream: content,
                });
            }).then((result: any) => {
                return result.inputStream.writeToStreamAsync(result.outputStream).then(() => result);
            }).then((result) => {
                // Close the two streams we read so we can
                // open the file and hand it to someone else.
                result.outputStream.close();
                result.inputStream.close();
                return <PromiseLike<Windows.Storage.StorageFile>>destinationDirectory.getFileAsync(targetFileName);
            });
        }

        public static haveToString(haveParameter: IHaveStatus | number): string {
            if (!isNaN(<number>haveParameter)) {
                return haveParameter.toString();
            }

            const have = <IHaveStatus>haveParameter;

            window.appassert(!!have.id, "Needs an ID at minimum");
            let haveString: string = have.id.toString();
            if (have.hash) {
                haveString += ":" + have.hash;
            }

            if (have.hasOwnProperty("progress")) {
                if (!have.progressLastChanged && have.progress) {
                    throw new Error("No progress last changed provided");
                }

                if (have.progressLastChanged) {
                    haveString += ":" + have.progress + ":" + have.progressLastChanged;
                }
            }

            return haveString;
        }
    }

    export class Folders {
        constructor(private _clientInformation: Codevoid.OAuth.ClientInformation) { }

        public list(): PromiseLike<IFolder[]> {
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.list);
            return <PromiseLike<IFolder[]>>request.send().then(extractArrayFromResponse, handleSingleItemJSONError);
        }

        public add(title: string): PromiseLike<IFolder> {
            if (!title) {
                throw new Error("Title is required to create a folder");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.add);
            request.data = [{ key: "title", value: title }];
            return request.send().then(extractSingleItemFromJSONArray).then(function (data) {
                if (!data.folder_id) {
                    return WinJS.Promise.wrapError(new Codevoid.Storyvoid.InstapaperApi.InstapaperApiException(1251, "User already has a folder with this title"));
                }

                return data;
            }, handleSingleItemJSONError);
        }

        public deleteFolder(folder_id: string): PromiseLike<any> {
            if (!folder_id) {
                throw new Error("Folder ID is required to delete a folder");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.deleteFolder);
            request.data = [{ key: "folder_id", value: folder_id }];
            return request.send().then(extractSingleItemFromJSONArray, handleSingleItemJSONError);
        }
    }
}