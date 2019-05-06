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

    enum ResultProcessing {
        asIs,
        reduceToSingleItem,
    }

    function localAssert(condition: boolean, message: string) {
        if (condition) {
            return;
        }

        debugger;
        console.debug(message);
    }

    function extractSingleItemFromJSONArray(data: string, resultProcessing?: ResultProcessing): any {
        let objectData = (data) ? JSON.parse(data) : "";
        localAssert(!!objectData, "didn't parse object data");
        localAssert(Array.isArray(objectData), "Wasn't an array");

        if (objectData.length === 1) {
            if (objectData[0].type === "error") {
                return new Codevoid.Storyvoid.InstapaperApi.InstapaperApiException(objectData[0].error_code, objectData[0].message);
            }

            if (resultProcessing == ResultProcessing.reduceToSingleItem) {
                objectData = objectData[0];
            }
        }

        return objectData;
    }

    async function processRequest<T>(request: Codevoid.OAuth.OAuthRequest, resultProcessing: ResultProcessing = ResultProcessing.reduceToSingleItem): Promise<T> {
        let data: string;
        try {
            data = await request.send();
        } catch (e) { throwRequestError(e); };

        return extractSingleItemFromJSONArray(data, resultProcessing);
    }

    function throwRequestError(error: Codevoid.OAuth.IRequestError): void {
        let result;

        if (error.response) {
            result = extractSingleItemFromJSONArray(error.response);
        } else {
            result = { error: error.status };
        }

        throw result;
    }

    export interface IAccessTokenInformation {
        readonly oauth_token: string;
        readonly oauth_token_secret: string;
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
        readonly bookmark_id: number;
        readonly progress: number;
        readonly progress_timestamp: number;
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

        public async getAccessToken(username: string, password: string): Promise<IAccessTokenInformation> {
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.access_token);
            request.data = [
                { key: "x_auth_username", value: username },
                { key: "x_auth_password", value: password },
                { key: "x_auth_mode", value: "client_auth" }
            ];

            const responseData = await request.send();
            localAssert(!!responseData, "Didn't get response data");
            const nameValuePairs = responseData.split("&");
            const result: IAccessTokenInformation = {
                oauth_token: null,
                oauth_token_secret: null,
            };

            for (let item of nameValuePairs) {
                const tokenParts = item.split("=");
                const key = decodeURIComponent(tokenParts[0]);
                result[key] = decodeURIComponent(tokenParts[1]);
            }

            return result;
        }

        public async verifyCredentials(): Promise<IUserInformation> {
            return await processRequest(new Codevoid.OAuth.OAuthRequest(this._clientInformation, AccountEndPoints.verify_credentials));
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
                alert("You should stop this run, and wait for the roaming setting to roam");
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
            localAssert(current["count"] < 121, "Too many adds. Change account, or give up for the day");
        }

        public async list(parameters?: IBookmarkListParameters): Promise<IBookmarkListResult> {
            const data: Codevoid.OAuth.NameValuePair[] = [];
            if (parameters) {
                if (parameters.limit) {
                    data.push({ key: "limit", value: parameters.limit });
                }

                if (parameters.folder_id) {
                    data.push({ key: "folder_id", value: parameters.folder_id });
                }

                if (parameters.have && parameters.have.length) {
                    localAssert(Array.isArray(parameters.have), "expected 'have' parameter to be an array");
                    localAssert(parameters.have.length > 0, "didn't actually supply any parameters");

                    const haveStrings = parameters.have.map((have) => Codevoid.Storyvoid.InstapaperApi.Bookmarks.haveToString(have));

                    localAssert(haveStrings.length > 0, "didn't get any have strings to send");
                    data.push({ key: "have", value: haveStrings.join(",") });
                }
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.list);

            if (data.length) {
                request.data = data;
            }

            const startTime = Date.now();
            const [meta, user, ...bookmarks] = await processRequest<any[]>(request);
            return {
                meta,
                user,
                bookmarks,
                duration: Date.now() - startTime
            };
        }

        public async add(parameters: IBookmarkAddParameters): Promise<IBookmark> {
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
            return await processRequest<IBookmark>(request);
        }

        public async deleteBookmark(bookmark_id: number): Promise<any[]> {
            if (!bookmark_id) {
                throw new Error("Requires bookmark ID to delete");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.deleteBookmark);
            request.data = data;
            return await processRequest(request, ResultProcessing.asIs);
        }

        public async move(parameters: IBookmarkMoveParameters): Promise<IBookmark> {
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

            return await processRequest(request);
        }

        public async updateReadProgress(parameters: IBookmarkUpdateReadProgressParameters): Promise<IBookmark> {
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
            return await processRequest(request);
        }

        public async star(bookmark_id: number): Promise<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.star);
            request.data = data;

            return await processRequest(request);
        }

        public async unstar(bookmark_id: number): Promise<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unstar);
            request.data = data;

            return await processRequest(request);
        }

        public async archive(bookmark_id: number): Promise<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.archive);
            request.data = [{ key: "bookmark_id", value: bookmark_id }]

            return await processRequest(request);
        }

        public async unarchive(bookmark_id: number): Promise<IBookmark> {
            if (!bookmark_id) {
                throw new Error("Bookmark ID required");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.unarchive);
            request.data = [{ key: "bookmark_id", value: bookmark_id }];

            return await processRequest(request);
        }

        public async getText(bookmark_id: number): Promise<string> {
            if (!bookmark_id) {
                throw new Error("bookmark ID required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.getText);
            request.data = data;

            try {
                return await request.send();
            } catch (e) { throwRequestError(e); };
        }

        public async getTextAndSaveToFileInDirectory(bookmark_id: number, destinationDirectory: Windows.Storage.StorageFolder): Promise<Windows.Storage.StorageFile> {
            if (!bookmark_id) {
                throw new Error("bookmark ID required");
            }

            if (!destinationDirectory) {
                throw new Error("Directory required");
            }

            const data = [{ key: "bookmark_id", value: bookmark_id }];
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, BookmarksEndPoints.getText);
            request.data = data;

            let content: Windows.Web.Http.IHttpContent;
            try {
                content = await request.retrieveRawContent();
            } catch (e) {
                throwRequestError(e);
            }

            const targetFileName = `${bookmark_id}.html`;
            const file = await destinationDirectory.createFileAsync(targetFileName, Windows.Storage.CreationCollisionOption.replaceExisting);
            const outputStream = await file.openAsync(Windows.Storage.FileAccessMode.readWrite);
            await content.writeToStreamAsync(outputStream);

            // Close the two streams we read so we can
            // open the file and hand it to someone else.
            outputStream.close();
            content.close();

            return destinationDirectory.getFileAsync(targetFileName);
        }

        public static haveToString(haveParameter: IHaveStatus | number): string {
            if (!isNaN(<number>haveParameter)) {
                return haveParameter.toString();
            }

            const have = <IHaveStatus>haveParameter;

            localAssert(!!have.id, "Needs an ID at minimum");
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

        public async list(): Promise<IFolder[]> {
            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.list);
            return processRequest(request, ResultProcessing.asIs);
        }

        public async add(title: string): Promise<IFolder> {
            if (!title) {
                throw new Error("Title is required to create a folder");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.add);
            request.data = [{ key: "title", value: title }];
            const data = await processRequest<IFolder>(request);
            if (!data.folder_id) {
                throw new Codevoid.Storyvoid.InstapaperApi.InstapaperApiException(1251, "User already has a folder with this title");
            }

            return data;
        }

        public async deleteFolder(folder_id: string): Promise<any[]> {
            if (!folder_id) {
                throw new Error("Folder ID is required to delete a folder");
            }

            const request = new Codevoid.OAuth.OAuthRequest(this._clientInformation, FolderEndPoints.deleteFolder);
            request.data = [{ key: "folder_id", value: folder_id }];
            return processRequest(request);
        }
    }
}