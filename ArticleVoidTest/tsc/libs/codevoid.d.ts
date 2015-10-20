
declare module Codevoid.Utilities.DOM {
    export function removeChild(parent: HTMLElement, child: HTMLElement): HTMLElement;
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

declare module Codevoid.ArticleVoid.Authenticator {
    export function hasStoredCredentials(): boolean;
    export function clearClientInformation(): void;
}

declare module Codevoid.ArticleVoid.UI {
    export class Authenticator {
        static showAuthenticator(): WinJS.Promise<Codevoid.OAuth.ClientInformation>;
    }
}