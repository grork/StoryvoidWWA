
declare module Codevoid.Utilities.DOM {
    export function removeChild(parent: HTMLElement, child: HTMLElement): HTMLElement;
}

declare module Codevoid.Utilities {
    export interface ICancellable {
        cancel();
    }
    export function addEventListeners(source: EventTarget, handlers: any): ICancellable;
}

declare module Codevoid.ArticleVoid.UI {
    export class Authenticator {
        static showAuthenticator(): void;
    }
}