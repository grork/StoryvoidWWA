/// <reference path="..\..\..\App\js\WebViewMessenger.ts" />
/// <reference path="..\..\..\App\js\WebViewMessenger_client.ts" />

// Note, that WebViewMessenger_client.ts is referenced above not becuase this file references it
// but because if we don't, TypeScript won't actually compile the file, which means the test fails
// when it loads the iframe for the cross-frame-communication

namespace Codevoid.WebViewMessengerTests {
    import getPlayground = InstapaperTestUtilities.getPlayground;
    import Signal = Codevoid.Utilities.Signal;
    import WebViewMessenger = Codevoid.Utilities.WebViewMessenger;

    describe("WebViewMessenger", function () {
        beforeEach(InstapaperTestUtilities.clearPlayground);
        afterEach(InstapaperTestUtilities.clearPlayground);

        it("webViewGetsStartMessage", () => {
            var s = new Signal();

            var div = getPlayground();
            var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
            var messenger = new WebViewMessenger(webView);
            messenger.events.addEventListener("ready", () => {
                s.complete();
            });

            webView.navigate("ms-appx-web:///TestWebViewTarget.html");

            assert.ok(!!messenger, "Didn't construct messenger");

            return s.promise;
        });

        it("webViewCanInvokeMessageRemotely", async () => {
            var s = new Signal();

            var div = getPlayground();
            var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
            var messenger = new WebViewMessenger(webView);
            messenger.events.addEventListener("ready", () => {
                s.complete();
            });

            webView.navigate("ms-appx-web:///TestWebViewTarget.html");

            assert.ok(!!messenger, "Didn't construct messenger");

            await s.promise;

            const message = await messenger.invokeForResult("ping");
            assert.strictEqual(message, "pong", "Incorrect message");
        });

        it("webViewCanInjectAdditionalScript", async () => {
            var s = new Signal();

            var div = getPlayground();
            var webView = <MSHTMLWebViewElement>div.appendChild(document.createElement("x-ms-webview"));
            var messenger = new WebViewMessenger(webView);
            messenger.events.addEventListener("ready", () => {
                s.complete();
            });

            webView.navigate("ms-appx-web:///TestWebViewTarget.html");

            assert.ok(!!messenger, "Didn't construct messenger");

            await s.promise;
            await messenger.addAdditionalScriptInsideWebView("ms-appx-web:///js/tests/WebViewTestScript.js");

            const testCookie: number = await messenger.invokeForResult("gettest");
            assert.strictEqual(testCookie, 42, "Got incorrect test cookie");
        });
    });
}