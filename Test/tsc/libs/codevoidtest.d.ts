declare module InstapaperTestUtilities {
    export function promiseTest(name: string, test: (assert: QUnitAssert) => any, delay?: number);
    export function destroyRemoteData(clientInformation: Codevoid.OAuth.ClientInformation): WinJS.Promise<any>;
    export function deleteDb(assert?: QUnitAssert): WinJS.Promise<any>;
    export function getPlayground(): HTMLElement;
}

declare module CodevoidTests {
    export class TestControl extends Codevoid.UICore.Control {
        disposed: boolean;
    }
}

declare module Codevoid.Storyvoid {
    let Telemetry: any;
}