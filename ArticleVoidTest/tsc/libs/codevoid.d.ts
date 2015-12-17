﻿
declare module Codevoid.Utilities.DOM {
    export function removeChild(parent: HTMLElement, child: HTMLElement): HTMLElement;
    export function loadTemplate(file: string, templateId: string): WinJS.Promise<WinJS.Binding.Template>;
    export function setControlAttribute(element: HTMLElement, controlClassName: string);
    export function marryEventsToHandlers(element: HTMLElement, context: any): ICancellable;
    export function marryPartsToControl(element: HTMLElement, context: any): void; 
}

declare module Codevoid.Utilities {
    export interface ICancellable {
        cancel();
    }

    export function addEventListeners(source: { addEventListener: any, removeEventListener: any }, handlers: any): ICancellable;
    export function serialize(items: any[], work: (item: any, index: number) => WinJS.Promise<any>);

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

    export class Logging {
        log(message: string, fixedLayout?: boolean);
        showViewer();
        clear();
        static instance: Logging;
    }

    export class Signal extends EventSource {
        promise: WinJS.Promise<any>;
        complete(result?: any);
        error(errorInfo: any);
        progress(progressInfo: any);
    }

    export class EventSource {
        //#region Methods

        /**
         * Adds an event listener to the control.
         * @param type The type (name) of the event.
         * @param listener The listener to invoke when the event gets raised.
         * @param useCapture If true, initiates capture, otherwise false.
        **/
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture ?: boolean): void;

        /**
         * Raises an event of the specified type and with the specified additional properties.
         * @param type The type (name) of the event.
         * @param eventProperties The set of additional properties to be attached to the event object when the event is raised.
         * @returns true if preventDefault was called on the event.
        **/
        dispatchEvent(type: string, eventProperties: any): boolean;

        /**
         * Removes an event listener from the control.
         * @param type The type (name) of the event.
         * @param listener The listener to remove.
         * @param useCapture true if capture is to be initiated, otherwise false.
        **/
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture ?: boolean): void;

        //#endregion Methods
    }
}

declare module Codevoid.OAuth {
    export class ClientInformation {
    }
}

declare module Codevoid.ArticleVoid {
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
    export class InstapaperSync {
        constructor(clientInformation: Codevoid.OAuth.ClientInformation);
        addEventListener(name: string, handler: (eventData: { detail: ISyncStatusUpdate }) => void);
        sync(): WinJS.Promise<void>;
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
        bookmark_id: number;
        progress: number;
        title: string;
        url: string;
    }

    export class InstapaperDB {
        constructor();
        initialize(): WinJS.Promise<InstapaperDB>;
        deleteAllData(): WinJS.Promise<any>;
        dispose(): void;
        listCurrentFolders(): WinJS.Promise<IFolder[]>;
        listCurrentBookmarks(folder_id: number): WinJS.Promise<IBookmark[]>;
        commonFolderDbIds: {
            archive: number;
            liked: number;
            unread: number;
            orphaned: number;
        };

        getFolderByDbId(folderId: number): WinJS.Promise<IFolder>

        static DBVersion: number;
        static DBName: string;

        static CommonFolderIds: {
            Archive: string;
            Liked: string;
            Unread: string;
            Orphaned: string;
        };
    }
}

declare module Codevoid.ArticleVoid.InstapaperApi {
    export class Bookmarks {
        constructor(clientInformation: Codevoid.OAuth.ClientInformation);
        add(parameters: { url: string, title?: string, description?: string, folder_id?: string }): WinJS.Promise<void>;
    }
}

declare module Codevoid.ArticleVoid.Authenticator {
    export function getStoredCredentials(): Codevoid.OAuth.ClientInformation;
    export function clearClientInformation(): void;
    export function getClientInformation(): WinJS.Promise<Codevoid.OAuth.ClientInformation>;
    export class AuthenticatorViewModel {
        constructor();

        authenticate(retry?: boolean): WinJS.Promise<Codevoid.OAuth.ClientInformation>;
    }
}

declare module Codevoid.ArticleVoid.UI {
    export class Authenticator {
        static showAuthenticator(): WinJS.Promise<Codevoid.OAuth.ClientInformation>;
    }

    export class SplitViewCommandWithData extends WinJS.UI.SplitViewCommand {
        dataContext: any;
    }

    export interface IAppWithAbilityToSignIn {
        signOut(): void;
        signedIn(credentials: OAuth.ClientInformation): void;
    }

    export interface ISignedInViewModel extends UICore.ViewModel {
        signedIn(): void;
    }
}