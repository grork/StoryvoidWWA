declare module Codevoid.Utilities {
    export interface ICancellable {
        cancel();
    }

    export interface IIndexedDatabase {
        objectStoreNames: string[];
        query(tableName: string): { execute(): WinJS.Promise<any[]> };
        close(): void;
    }

    export interface IIndexedDBOpenOptions {
        server: string;
        version: number;
    }
    export interface IIndexedDB {
        open(options: IIndexedDBOpenOptions): WinJS.Promise<IIndexedDatabase>;
    }

    export interface EventObject<T> {
        detail: T;
    }

    export class EventSource {
        //#region Methods

        /**
         * Adds an event listener to the control.
         * @param type The type (name) of the event.
         * @param listener The listener to invoke when the event gets raised.
         * @param useCapture If true, initiates capture, otherwise false.
        **/
        addEventListener(type: string, listener: Function, useCapture?: boolean): void;

        /**
         * Raises an event of the specified type and with the specified additional properties.
         * @param type The type (name) of the event.
         * @param eventProperties The set of additional properties to be attached to the event object when the event is raised.
         * @returns true if preventDefault was called on the event.
        **/
        dispatchEvent(type: string, eventProperties?: any): boolean;

        /**
         * Removes an event listener from the control.
         * @param type The type (name) of the event.
         * @param listener The listener to remove.
         * @param useCapture true if capture is to be initiated, otherwise false.
        **/
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;

        //#endregion Methods
    }
}

declare module Codevoid.Storyvoid {
    export class SyncOperation {
        start: string;
        end: string;
        foldersStart: string;
        foldersEnd: string;
        bookmarksStart: string;
        bookmarksEnd: string;
        bookmarkFolder: string;
        folder: string;
        bookmark: string;
    }

    export interface ISyncStatusUpdate {
        operation: string;
        title: string;
    }

    export interface ISyncOptions {
        dbInstance: InstapaperDB;
        folders: boolean,
        bookmarks: boolean,
        singleFolder?: boolean,
        folder?: number,
        cancellationSource?: Codevoid.Utilities.CancellationSource;
    }

    export class InstapaperSync extends Utilities.EventSource {
        constructor(clientInformation: Codevoid.OAuth.ClientInformation);
        addEventListener(name: "syncstatusupdate", handler: (eventData: Utilities.EventObject<ISyncStatusUpdate>) => any, useCapture?: boolean) : void;
        sync(syncOptions?: ISyncOptions): WinJS.Promise<void>;
        perFolderBookmarkLimits: { [id: string]: number };
        defaultBookmarkLimit: number;
        static Operation: SyncOperation;
    }

    export interface IFolder {
        title: string;
        localOnly: boolean;
        folder_id: string;
        id: number;
        position: number;
    }

    export interface IBookmark {
        title: string;
        url: string;
        bookmark_id: number;
        progress: number;
        progress_timestamp: number;
        folder_id: string;
        folder_dbid: number;
        time: number;
        contentAvailableLocally: boolean;
        hasImages: boolean;
        firstImagePath: string;
        firstImageOriginalUrl: string;
        localFolderRelativePath: string;
        description: string;
        extractedDescription: string;
        articleUnavailable: boolean;
        starred: number;
        doNotAddToJumpList?: boolean;
    }

    export interface IFoldersChangedEvent {
        operation: string;
        folder_dbid: number;
        title: string;
        folder: IFolder;
    }

    export interface IBookmarksChangedEvent {
        operation: string;
        bookmark_id: number;
        bookmark: IBookmark;
        destinationfolder_dbid: number;
        sourcefolder_dbid: number;
    }

    export class InstapaperDB {
        constructor();
        initialize(name?: string, version?: string): WinJS.Promise<InstapaperDB>;
        deleteAllData(): WinJS.Promise<any>;
        dispose(): void;

        // Folder Interface
        listCurrentFolders(): WinJS.Promise<IFolder[]>;
        listCurrentBookmarks(folder_id?: number): WinJS.Promise<IBookmark[]>;
        getFolderByDbId(folderId: number): WinJS.Promise<IFolder>;

        // Bookmark interface
        addBookmark(bookmark: IBookmark): WinJS.Promise<IBookmark>;
        moveBookmark(bookmark_id: number, destinationfolder_dbid: number): WinJS.Promise<IBookmark>;
        removeBookmark(bookmark_id: number): WinJS.Promise<IBookmark>;
        likeBookmark(bookmark_id: number): WinJS.Promise<IBookmark>;
        unlikeBookmark(bookmark_id: number): WinJS.Promise<IBookmark>;
        updateBookmark(bookmark: IBookmark, dontRaiseChangeNotification?: boolean): WinJS.Promise<IBookmark>;
        updateReadProgress(bookmark_id: number, progress: number): WinJS.Promise<IBookmark>;
        getBookmarkByBookmarkId(bookmark_id: number): WinJS.Promise<IBookmark>;

        getPendingFolderEdits(): WinJS.Promise<any>;
        getPendingBookmarkEdits(): WinJS.Promise<{
            adds: any[],
            deletes: any[],
            moves: any[],
            likes: any[],
            unlikes: any[],
        }>;

        commonFolderDbIds: {
            archive: number;
            liked: number;
            unread: number;
            orphaned: number;
        };

        // Event Source interface
        addEventListener(type: "folderschanged", listener: (e: Utilities.EventObject<IFoldersChangedEvent>) => any): void;
        addEventListener(type: "bookmarkschanged", listener: (e: Utilities.EventObject<IBookmarksChangedEvent>) => any): void;
        addEventListener(type: string, listener: (e: any) => void): void;

        dispatchEvent(type: "folderschanged", detail: IFoldersChangedEvent): void;
        dispatchEvent(type: "bookmarkschanged", detail: IBookmarksChangedEvent): void;
        dispatchEvent(type: string, detail: any): void;

        removeEventListener(type: string, listener: any): void;

        // Statics
        static DBVersion: number;
        static DBName: string;

        static CommonFolderIds: {
            Archive: string;
            Liked: string;
            Unread: string;
            Orphaned: string;
        };

        static FolderChangeTypes: {
            ADD: string;
            DELETE: string;
            UPDATE: string,
        }

        static BookmarkChangeTypes: {
            ADD: string;
            DELETE: string;
            MOVE: string;
            LIKE: string;
            UNLIKE: string;
            UPDATE: string;
        }
    }
}

declare module Codevoid.Storyvoid.InstapaperApi {
    export class Bookmarks {
        constructor(clientInformation: Codevoid.OAuth.ClientInformation);
        add(parameters: { url: string, title?: string, description?: string, folder_id?: string }): WinJS.Promise<IBookmark>;
        deleteBookmark(bookmark_id: number): WinJS.Promise<any>;
        list({ folder_id: string }): WinJS.Promise<{ bookmarks: IBookmark[], duration: number }>;
        updateReadProgress(paramters: { bookmark_id: number, progress: number, progress_timestamp: number }): WinJS.Promise<IBookmark>;
        getTextAndSaveToFileInDirectory(bookmark_id: number, desinationDirectory: Windows.Storage.StorageFolder): WinJS.Promise<Windows.Storage.StorageFile>;
        static haveToString(have: any): string;
    }

    export interface IAccessTokenInformation {
        oauth_token: string;
        oauth_token_secret: string;
    }
}

declare module Codevoid.Storyvoid.Authenticator {
    export function getStoredCredentials(): Codevoid.OAuth.ClientInformation;
    export function clearClientInformation(): void;
    export function saveAccessToken(accessToken: InstapaperApi.IAccessTokenInformation): Codevoid.OAuth.ClientInformation;
    export class AuthenticatorViewModel {
        constructor();

        authenticate(minimumDuration?: number): WinJS.Promise<InstapaperApi.IAccessTokenInformation>;
        holdWorkingStateOnSuccess: boolean;
    }
}

declare module Codevoid.Storyvoid.UI {
    export class Authenticator extends Codevoid.UICore.Control {
        constructor(element: HTMLElement, options: any);
    }

    export class SplitViewCommandWithData extends WinJS.UI.SplitViewCommand {
        dataContext: any;
    }

    export interface IAppLaunchInformation {
        bookmark_id: number;
        originalUrl: Windows.Foundation.Uri;
    }

    export interface IAppWithAbilityToSignIn {
        readonly launchInformation: IAppLaunchInformation;
        signOut(wasPreviouslySignedIn?: boolean): void;
        signedIn(credentials: OAuth.ClientInformation, usingSavedCredentials: boolean): void;
    }

    export interface ISignedInViewModel extends UICore.ViewModel {
        processLaunchInformation?(launchInformation: IAppLaunchInformation): void;
        signedIn(usingSavedCredentials: boolean): WinJS.Promise<any>;
        signInCompleted(): void;
        uiPresented?(): void;
    }
}

// Microsot moved the MSHTMLWebViewElement declaration out of lib.d.ts, so we need
// to duplicate it here. See this breaking change:
// https://github.com/Microsoft/TypeScript/issues/23143

interface MSWebViewAsyncOperationEventMap {
    "complete": Event;
    "error": Event;
}

interface MSWebViewAsyncOperation extends EventTarget {
    readonly error: DOMError;
    oncomplete: (this: MSWebViewAsyncOperation, ev: Event) => any;
    onerror: (this: MSWebViewAsyncOperation, ev: Event) => any;
    readonly readyState: number;
    readonly result: any;
    readonly target: MSHTMLWebViewElement;
    readonly type: number;
    start(): void;
    readonly COMPLETED: number;
    readonly ERROR: number;
    readonly STARTED: number;
    readonly TYPE_CAPTURE_PREVIEW_TO_RANDOM_ACCESS_STREAM: number;
    readonly TYPE_CREATE_DATA_PACKAGE_FROM_SELECTION: number;
    readonly TYPE_INVOKE_SCRIPT: number;
    addEventListener<K extends keyof MSWebViewAsyncOperationEventMap>(type: K, listener: (this: MSWebViewAsyncOperation, ev: MSWebViewAsyncOperationEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof MSWebViewAsyncOperationEventMap>(type: K, listener: (this: MSWebViewAsyncOperation, ev: MSWebViewAsyncOperationEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var MSWebViewAsyncOperation: {
    prototype: MSWebViewAsyncOperation;
    new(): MSWebViewAsyncOperation;
    readonly COMPLETED: number;
    readonly ERROR: number;
    readonly STARTED: number;
    readonly TYPE_CAPTURE_PREVIEW_TO_RANDOM_ACCESS_STREAM: number;
    readonly TYPE_CREATE_DATA_PACKAGE_FROM_SELECTION: number;
    readonly TYPE_INVOKE_SCRIPT: number;
};

interface MSWebViewSettings {
    isIndexedDBEnabled: boolean;
    isJavaScriptEnabled: boolean;
}

declare var MSWebViewSettings: {
    prototype: MSWebViewSettings;
    new(): MSWebViewSettings;
};

interface MSHTMLWebViewElement extends HTMLElement {
    readonly canGoBack: boolean;
    readonly canGoForward: boolean;
    readonly containsFullScreenElement: boolean;
    readonly documentTitle: string;
    height: number;
    readonly settings: MSWebViewSettings;
    src: string;
    width: number;
    addWebAllowedObject(name: string, applicationObject: any): void;
    buildLocalStreamUri(contentIdentifier: string, relativePath: string): string;
    capturePreviewToBlobAsync(): MSWebViewAsyncOperation;
    captureSelectedContentToDataPackageAsync(): MSWebViewAsyncOperation;
    getDeferredPermissionRequestById(id: number): DeferredPermissionRequest;
    getDeferredPermissionRequests(): DeferredPermissionRequest[];
    goBack(): void;
    goForward(): void;
    invokeScriptAsync(scriptName: string, ...args: any[]): MSWebViewAsyncOperation;
    navigate(uri: string): void;
    navigateFocus(navigationReason: NavigationReason, origin: FocusNavigationOrigin): void;
    navigateToLocalStreamUri(source: string, streamResolver: any): void;
    navigateToString(contents: string): void;
    navigateWithHttpRequestMessage(requestMessage: any): void;
    refresh(): void;
    stop(): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: MSHTMLWebViewElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: MSHTMLWebViewElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var MSHTMLWebViewElement: {
    prototype: MSHTMLWebViewElement;
    new(): MSHTMLWebViewElement;
};