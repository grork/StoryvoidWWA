/// <reference path="..\..\..\App\js\WebViewMessenger.ts" />
/// <reference path="..\..\..\App\js\WebViewMessenger_client.ts" />
// Note, that WebViewMessenger_client.ts is referenced above not becuase this file references it
// but because if we don't, TypeScript won't actually compile the file, which means the test fails
// when it loads the iframe for the cross-frame-communication

module Codevoid.WebViewMessengerTests {
    import getPlayground = InstapaperTestUtilities.getPlayground;
    import promiseTest = InstapaperTestUtilities.promiseTest;
    import Signal = Codevoid.Utilities.Signal;
    import WebViewMessenger = Codevoid.Utilities.WebViewMessenger;

    module("WebViewMessenger");

    promiseTest("webViewGetsStartMessage", () => {
        var s = new Signal();

        var div = getPlayground();
        var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
        var messenger = new WebViewMessenger(webView);
        messenger.events.addEventListener("ready", () => {
            s.complete();
        });

        webView.navigate("ms-appx-web:///TestWebViewTarget.html");

        ok(!!messenger, "Didn't construct messenger");

        return s.promise;
    });

    promiseTest("webViewCanInvokeMessageRemotely", () => {
        var s = new Signal();

        var div = getPlayground();
        var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
        var messenger = new WebViewMessenger(webView);
        messenger.events.addEventListener("ready", () => {
            s.complete();
        });

        webView.navigate("ms-appx-web:///TestWebViewTarget.html");

        ok(!!messenger, "Didn't construct messenger");

        return s.promise.then(() => {
            return messenger.invokeForResult("ping");
        }).then((message) => {
            strictEqual(message, "pong", "Incorrect message");
        });
    });

    promiseTest("webViewCanInjectAdditionalScript", () => {
        var s = new Signal();

        var div = getPlayground();
        var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
        var messenger = new WebViewMessenger(webView);
        messenger.events.addEventListener("ready", () => {
            s.complete();
        });

        webView.navigate("ms-appx-web:///TestWebViewTarget.html");

        ok(!!messenger, "Didn't construct messenger");

        return s.promise.then(() => {
            return messenger.addAdditionalScriptInsideWebView("ms-appx-web:///js/tests/WebViewTestScript.js");
        }).then(() => {
            return messenger.invokeForResult("gettest");
        }).then((testCookie: number) => {
            strictEqual(testCookie, 42, "Got incorrect test cookie");
        });
    });
}