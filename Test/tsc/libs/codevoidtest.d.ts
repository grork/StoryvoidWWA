declare module InstapaperTestUtilities {
    export function destroyRemoteData(clientInformation: Codevoid.OAuth.ClientInformation): WinJS.Promise<any>;
    export function deleteDb(): WinJS.Promise<any>;
    export function getPlayground(): HTMLElement;
    export function clearPlayground(): void;
}

declare module CodevoidTests {
    export class TestControl extends Codevoid.UICore.Control {
        disposed: boolean;
    }
}

declare module Codevoid.Storyvoid {
    let Telemetry: any;
}