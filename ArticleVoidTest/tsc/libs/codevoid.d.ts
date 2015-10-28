
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
    export function addEventListeners(source: EventTarget, handlers: any): ICancellable;
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
}