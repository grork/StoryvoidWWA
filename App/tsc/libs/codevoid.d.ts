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
    export interface ISyncStatusUpdate {
        operation: string;
        title?: string;
    }

    export interface ISyncOptions {
        dbInstance?: InstapaperDB;
        folders: boolean,
        bookmarks: boolean,
        singleFolder?: boolean,
        folder?: number,
        cancellationSource?: Codevoid.Utilities.CancellationSource;
        skipOrphanCleanup?: boolean;
        _testPerFolderCallback?: any;
    }
}

declare module Codevoid.Storyvoid.UI {
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