module Codevoid.Utilities {
    interface IMessageDetails {
        message: string;
        responseId: number;
        payload: any;
    }

    export class WebViewMessenger_Client {
        private _messageHandlers: { [id: string]: (payload: any, completion: (payload: any) => void) => any } = {};

        constructor() {
        }

        private _handleMessage(args): void {
            var data: IMessageDetails = JSON.parse(args);

            switch (data.message.toLowerCase()) {
                case "ping":
                    this.sendMessage("response", "pong", data.responseId);
                    break;

                case "addscript":
                    this._addScript(data.payload.url, data.responseId);
                    break;

                case "addstylesheet":
                    this._addStyleSheet(data.payload.url, data.responseId);
                    break;

                default:
                    var handler = this._messageHandlers[data.message];
                    if (handler) {
                        handler(data.payload, this._getCompletionForId(data.responseId));
                    }
                    break;
            }
        }

        private _getCompletionForId(responseId: number): (payload: any) => void {
            return (payload: any) => {
                this.sendMessage("response", payload, responseId);
            };
        }

        private _addScript(scriptPath: string, responseId: number): void {
            var scriptTag = document.createElement("script");
            scriptTag.addEventListener("load", () => {
                this.sendMessage("response", null, responseId);
            });

            scriptTag.src = scriptPath;

            document.head.appendChild(scriptTag);
        }

        private _addStyleSheet(scriptPath: string, responseId: number): void {
            var styleSheetTag = document.createElement("link");
            styleSheetTag.addEventListener("load", () => {
                this.sendMessage("response", null, responseId);
            });

            styleSheetTag.rel = "stylesheet";
            styleSheetTag.href = scriptPath;

            document.head.appendChild(styleSheetTag);
        }

        public initialize(): void {
            document.addEventListener("DOMContentLoaded", () => {
                this.sendMessage("ready", null);
            });

            (<any>window).messageHandler = this._handleMessage.bind(this);
        }

        public sendMessage(message: string, payload: any, responseId?: number): void {
            var notifyData = {
                message: message,
                payload: payload,
                responseId: responseId
            };

            var bridge = (<any>window).MessageBridge || window.external;
            bridge.notify(JSON.stringify(notifyData));
        }

        public addHandlerForMessage(message: string, handler: (payload: any, completion: (payload: any) => void) => any) {
            this._messageHandlers[message] = handler;
        }

        public static Instance: WebViewMessenger_Client;
    }

    var viewerClient = new WebViewMessenger_Client();
    WebViewMessenger_Client.Instance = viewerClient;

    viewerClient.initialize();
}