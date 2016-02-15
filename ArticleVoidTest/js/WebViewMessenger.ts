module Codevoid.Utilities {
    export class WebViewMessenger {
        private _events: EventSource = new EventSource();
        private _handlers: ICancellable;
        constructor(private _webView: MSHTMLWebViewElement) {
            this._handlers = addEventListeners(this._webView, {
                MSWebViewScriptNotify: this._onNotifyMessage.bind(this),
            });
        }

        public get events(): EventSource {
            return this._events;
        }

        private _onNotifyMessage(e: { value: string }) {
            var payload = JSON.parse(e.value);

            switch (payload.message) {
                case "ready":
                    this.events.dispatchEvent("ready", null);
                    break;
            }
        }
    }
}