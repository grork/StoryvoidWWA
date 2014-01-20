declare module InstapaperTestUtilities {
    export function promiseTest(name: string, func: () => WinJS.Promise<any> , delay?: number);
    export function getPlayground(): HTMLElement;
}

declare module CodevoidTests {
    export class TestControl extends Codevoid.UICore.Control {
        disposed: boolean;
    }
}