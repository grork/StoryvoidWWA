module Codevoid.Utilities {
    export class WebViewMessenger_Client {
    }

    (<any>window.external).notify(JSON.stringify({ message: "ready" }));
}