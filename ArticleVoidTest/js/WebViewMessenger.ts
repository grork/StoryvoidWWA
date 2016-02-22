module Codevoid.Utilities {
    export class WebViewMessenger {
        private _events: EventSource = new EventSource();
        private _handlers: ICancellable;
        private _messageBridge: CodevoidN.Utilities.WebViewNotifier;
        private _nextMessageId: number = 0;
        private _waitingForResponse: { [id: number]: Signal } = {};

        constructor(private _webView: MSHTMLWebViewElement) {
            this._messageBridge = new CodevoidN.Utilities.WebViewNotifier();

            this._handlers = addEventListeners(this._messageBridge, {
                mswebviewscriptnotify: this._onNotifyMessage.bind(this),
            });

            var firstNavigationStarting = addEventListeners(this._webView, {
                MSWebViewNavigationStarting: () => {
                    firstNavigationStarting.cancel();
                    this._webView.addWebAllowedObject("MessageBridge", this._messageBridge);
                }
            });
        }

        public get events(): EventSource {
            return this._events;
        }

        private _onNotifyMessage(e: { value: string, target: string }) {
            var payload = JSON.parse(e.value || e.target);

            switch (payload.message) {
                case "ready":
                    this.events.dispatchEvent("ready", null);
                    break;

                case "response":
                    var signal = this._waitingForResponse[payload.responseId];

                    // Remove this from those waiting responses, so we don't
                    // fill it up and leak.
                    delete this._waitingForResponse[payload.responseId];
                    signal.complete(payload.payload);
                    break;
            }
        }

        public addAdditionalScriptInsideWebView(fullScriptPath: string): WinJS.Promise<any> {
            return this.invokeForResult("addscript", { url: fullScriptPath });
        }

        public addStyleSheet(fullStyleSheetPath: string): WinJS.Promise<any> {
            return this.invokeForResult("addstylesheet", { url: fullStyleSheetPath });
        }

        public invokeForResult(message: string, payload?: any): WinJS.Promise<any> {
            var completionSignal = new Signal();
            var responseId = this._nextMessageId++;

            this._waitingForResponse[responseId] = completionSignal;

            var messagePayload = {
                message: message,
                payload: payload,
                responseId: responseId
            };

            var scriptOperation = this._webView.invokeScriptAsync("messageHandler", JSON.stringify(messagePayload));
            scriptOperation.start();

            return completionSignal.promise;
        }
    }
}