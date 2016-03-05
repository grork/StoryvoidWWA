declare module InstapaperTestUtilities {
    export function promiseTest(name: string, func: () => WinJS.Promise<any>, delay?: number);
    export function startOnFailureOfPromise();
    export function startOnSuccessOfPromise();
    export function destroyRemoteData(clientInformation: Codevoid.OAuth.ClientInformation): WinJS.Promise<any>;
    export function deleteDb(): WinJS.Promise<any>;
    export function getPlayground(): HTMLElement;
}

declare module CodevoidTests {
    export class TestControl extends Codevoid.UICore.Control {
        disposed: boolean;
    }
}