interface Window {
    appassert(assertion: boolean, message: string): void;
    appfail(message: string): void;
}

namespace Codevoid.Utilities {
    function getCancelledError(): Error {
        const error = new Error("Canceled");
        error.name = "Canceled";

        return error;
    }

    type EventListenerEntry = {
        useCapture: boolean;
        listener: Function;
    }

    class EventMixinEvent {
        private _preventDefaultCalled: boolean = false;
        public _stopImmediatePropagationCalled = false;
        public timeStamp: number;

        constructor(public type: string, public detail: any, public target: any) {
            this.timeStamp = Date.now();
        }
        public get bubbles(): boolean {
            return false;
        }

        public get cancelable(): boolean {
            return false;
        }

        public get currentTarget() {
            return this.target;
        }

        public get defaultPrevented(): boolean {
            return this._preventDefaultCalled;
        }

        public get trusted(): boolean {
            return false;
        }

        public get eventPhase(): number {
            return 0;
        }

        public preventDefault(): void {
            this._preventDefaultCalled = true;
        }

        public stopImmediatePropagation(): void {
            this._stopImmediatePropagationCalled = true;
        }

        public stopPropagation(): void { }

        static supportedForProcessing: false;
    }

    export class EventSource {
        private _listeners: { [type: string]: EventListenerEntry[] } = null;

        /**
         * Adds an event listener to the control.
         * @param type The type (name) of the event.
         * @param listener The listener to invoke when the event gets raised.
         * @param useCapture If true, initiates capture, otherwise false.
        **/
        public addEventListener(type: string, listener: Function, useCapture?: boolean): void {
            useCapture = useCapture || false;
            this._listeners = this._listeners || {};
            const eventListeners = (this._listeners[type] = this._listeners[type] || []);

            for (let i = 0, len = eventListeners.length; i < len; i++) {
                let l = eventListeners[i];
                if (l.useCapture === useCapture && l.listener === listener) {
                    return;
                }
            }

            eventListeners.push({ listener: listener, useCapture: useCapture });
        }

        /**
         * Raises an event of the specified type and with the specified additional properties.
         * @param type The type (name) of the event.
         * @param details The set of additional properties to be attached to the event object when the event is raised.
         * @returns true if preventDefault was called on the event.
        **/
        public dispatchEvent(type: string, details?: any): boolean {
            let listeners = this._listeners && this._listeners[type];

            if (listeners) {
                const eventValue = new EventMixinEvent(type, details, this);
                // Need to copy the array to protect against people unregistering while we are dispatching
                listeners = listeners.slice(0, listeners.length);

                for (let i = 0, len = listeners.length; i < len && !eventValue._stopImmediatePropagationCalled; i++) {
                    listeners[i].listener(eventValue);
                }

                return eventValue.defaultPrevented || false;
            }
            return false;
        }

        /**
         * Removes an event listener from the control.
         * @param type The type (name) of the event.
         * @param listener The listener to remove.
         * @param useCapture true if capture is to be initiated, otherwise false.
        **/
        public removeEventListener(type: string, listener: Function, useCapture?: boolean): void {
            useCapture = useCapture || false;

            var listeners = this._listeners && this._listeners[type];

            if (listeners) {
                for (let i = 0, len = listeners.length; i < len; i++) {
                    const l = listeners[i];

                    if (l.listener === listener && l.useCapture === useCapture) {
                        listeners.splice(i, 1);
                        if (listeners.length === 0) {
                            delete this._listeners[type];
                        }

                        // Only want to remove one element for each call to removeEventListener
                        break;
                    }
                }
            }
        }
    }

    if (!window.alert) {
        (function () {
            var alertsToShow = [];
            var dialogVisible = false;

            async function showPendingAlerts() {
                if (dialogVisible || !alertsToShow.length) {
                    return;
                }

                dialogVisible = true;
                await (new Windows.UI.Popups.MessageDialog(alertsToShow.shift())).showAsync();
                dialogVisible = false;
                showPendingAlerts();
            }

            window.alert = function (message) {
                if (window.console && window.console.log) {
                    window.console.log(message);
                }

                alertsToShow.push(message);
                showPendingAlerts();
            };
        })();
    }

    if (!window.appassert) {
        window.appassert = function appassert(assertion, message) {
            if (!assertion) {
                debugger;
                alert(message);
            }
        };
    }

    if (!window.appfail) {
        window.appfail = function appfail(message) {
            debugger;
            alert(message);
        };
    }

    export interface ICancellable {
        cancel();
    }

    export interface EventObject<T> {
        detail: T;
    }

    export class Debounce {
        private completed: boolean = false;
        private timeoutId: number = null;

        constructor(private debounceOperation: Function, private idleTimeout: number, private completeOnlyOnce?: boolean) {
            if (!debounceOperation) {
                throw new Error("An operation must be supplied at construction time");
            }

            if (idleTimeout < 1) {
                throw new Error("Timeout must be greater than 0");
            }
        }

        private operation(): void {
            if (this.completeOnlyOnce && this.completed) {
                return;
            }

            this.completed = true;
            this.debounceOperation();
        }

        public cancel(): void {
            if (this.timeoutId === null) {
                return;
            }

            clearTimeout(this.timeoutId);
        }

        public bounce(): void {
            if (this.completeOnlyOnce && this.completed) {
                return;
            }

            this.cancel();

            this.timeoutId = setTimeout(this.operation.bind(this), this.idleTimeout);
        }

        public triggerNow(): void {
            this.cancel();
            this.operation();
        }
    }

    export class Signal extends EventSource {
        private _wrappedPromise: PromiseLike<any>;
        private _complete: (value: any) => void;
        private _completed: boolean = false;
        private _error: (errorInfo: any) => void;

        constructor() {
            super();

            var that = this;
            // This uses the "that" pattern 'c ause it's called from a constructor, and
            // I don't want to mess with anything weird to upset the promise gods.
            this._wrappedPromise = new Promise(function (c, e) {
                that._complete = c;
                that._error = e;
            });
        }

        public get promise(): PromiseLike<any> {
            return this._wrappedPromise;
        }

        public complete(result?: any): void {
            if (this._completed) {
                throw new Error("Cannot complete an already completed promise");
            }

            this._complete(result);
            this._completed = true;
        }

        public error(errorInfo?: any): void {
            this._error(errorInfo);
        }

        public cancel(): void {
            this._error(getCancelledError());
        }
    }

    export function timeout(delay: number = 0, cancellationToken?: CancellationSource): Promise<void> {
        let timerId: number = 0;
        let listener: ICancellable;

        if (cancellationToken) {
            if (cancellationToken.cancelled) {
                return Promise.reject(getCancelledError());
            }

            listener = addEventListeners(cancellationToken, {
                cancelled: () => {
                    clearTimeout(timerId);
                    reject(getCancelledError());
                }
            });
        }

        let reject: (e: any) => any;
        const p = new Promise<void>((c, r) => {
            timerId = setTimeout(() => {
                c();
                if (listener) { listener.cancel(); }
            }, delay);

            reject = r;
        });

        return p;
    }

    export interface ILogMessage {
        message: string;
        useFixedLayout: boolean;
    }

    /// <summary>
    /// Logging helper class that provides structured & unstructured logging.
    /// Structured in this case means support for saying "this message should be presented without reformatting"
    ///
    /// Additionally, this provides an in memory store of the messages so they can be seen later if the
    /// viewer was not open at the time they were originally logged.
    /// </summary>
    export class Logging extends EventSource {
        private _logMessages: ILogMessage[];

        public logToConsole: boolean = false;

        constructor() {
            super();
            this.clear();
        }

        public log(message: string, fixedLayout?: boolean): void {
            const messageDetail = { message: message, useFixedLayout: fixedLayout };
            this._logMessages.push(messageDetail);

            if (this.logToConsole) {
                console.log(message);
            }

            this.dispatchEvent("newlogmessage", messageDetail);
        }

        public get messages(): ILogMessage[] {
            return [].concat(this._logMessages);
        }

        public showViewer(): void {
            let viewerElement = document.createElement("div");
            document.body.appendChild(viewerElement);

            viewerElement.winControl = new Codevoid.Utilities.DOM.LogViewer(viewerElement);
        }

        public clear(): void {
            this._logMessages = [];
            this.dispatchEvent("logcleared");
        }

        private static _instance: Logging;
        static get instance(): Logging {
            if (!Logging._instance) {
                Logging._instance = new Logging();
            }

            return Logging._instance;
        }
    }

    export class CancellationSource extends EventSource {
        private _cancelled: boolean = false;

        public cancel(): void {
            this._cancelled = true;
            this.dispatchEvent("cancelled");
        }

        public get cancelled(): boolean {
            return this._cancelled;
        }
    }

    export interface CancellationSource {
        addEventListener(name: "cancelled", handler: (eventData: Utilities.EventObject<void>) => any, useCapture?: boolean): void;
    }

    export function serialize(items: any[], work: (item: any, index?: number) => PromiseLike<any>, concurrentWorkLimit?: number, cancellationSource?: CancellationSource): PromiseLike<any> {
        concurrentWorkLimit = (!concurrentWorkLimit) ? 1 : concurrentWorkLimit;
        const results: any[] = [];
        const signals: Signal[] = [];
        let numberInFlight = 0;

        function doWork() {
            // Start the "cascade"
            if (!signals.length) {
                return;
            }

            while ((numberInFlight < concurrentWorkLimit) && signals.length) {
                var signal = signals.shift();

                if (cancellationSource && cancellationSource.cancelled) {
                    signal.cancel();
                    return;
                }

                numberInFlight++;
                signal.complete();
            }
        }

        // Set up all the signals so that as each one
        // is signalled, the work it needs to do gets
        // done.
        items.forEach((item, index) => {
            const signal = new Codevoid.Utilities.Signal();
            signals.push(signal);

            results.push(signal.promise.then(() => {
                const r = work(item, index);
                return r;
            }).then((value) => {
                numberInFlight--;
                doWork();
                return value;
            }, (error) => {
                numberInFlight--;
                doWork();
                return Promise.reject(error);
            }));
        });

        doWork();

        return Promise.all(results);
    }

    interface EventHandlerEntry {
        event: string;
        handler: Function;
    }

    export interface IEventSource {
        addEventListener: any;
        removeEventListener: any
    }

    class CancellableImpl implements ICancellable {
        public handlers: EventHandlerEntry[] = [];

        constructor(private eventSource: IEventSource) { }

        cancel(): void {
            for (let handler of this.handlers) {
                this.eventSource.removeEventListener(handler.event, handler.handler);
            }
        }
    }

    export function addEventListeners(eventSource: IEventSource, handlerMap: { [eventName: string]: Function }): ICancellable {
        const cancellation = new CancellableImpl(eventSource);

        for (let key in handlerMap) {
            eventSource.addEventListener(key, handlerMap[key]);
            cancellation.handlers.push({ event: key, handler: handlerMap[key] });
        }

        return cancellation;
    }
}

namespace Codevoid.Utilities.DOM {
    let fragmentCache: { [path: string]: PromiseLike<HTMLElement> } = {};
    let templateCache: { [templateId: string]: WinJS.Binding.Template } = {};
    const TEMPLATE_ID_ATTRIBUTE_NAME = "data-templateid";

    export function disposeOfControl(element: Element): void {
        if (!element || !element.winControl || !element.winControl.dispose) {
            return;
        }

        try {
            element.winControl.dispose();
        } catch (e) {
            window.appfail(`Failed to unload control:\n${e.toString()}\nStack:\n${e.stack}`);
        }
    }

    export function disposeOfControlTree(root: Element): void {
        var toUnload = WinJS.Utilities.query("[data-win-control]", <HTMLElement>root);
        if (root.hasAttribute("data-win-control")) {
            toUnload.unshift(<HTMLElement>root);
        }

        for (var i = toUnload.length - 1; i > -1; i--) {
            Codevoid.Utilities.DOM.disposeOfControl(toUnload[i]);
        }
    }

    export function removeChild(parent: HTMLElement, child: HTMLElement): HTMLElement {
        Codevoid.Utilities.DOM.disposeOfControlTree(child);
        return parent.removeChild(child);
    }

    export function empty(element: HTMLElement): void {
        window.appassert(!!element, "no element provided");
        if (!element) {
            return;
        }

        Codevoid.Utilities.DOM.disposeOfControlTree(element);
        element.innerHTML = "";
    }

    export function setControlAttribute(element: HTMLElement, controlClassName: string): void {
        if (element.hasAttribute("data-win-control")) {
            return;
        }

        element.setAttribute("data-win-control", controlClassName);
    }

    export async function loadTemplate(path: string, id: string): Promise<WinJS.Binding.Template> {
        const templateCacheKey = `${path}#${id}`;

        // If we have the template already in memory, return it
        const template = templateCache[templateCacheKey];
        if (template) {
            return template;
        }

        // We didn't have it, so lets go get the tree if we have it...
        // We store promises here, not the result so that if two requests come
        // in concurrenctly, we can wait on the same actual renderCopy, rather
        // than starting a second
        let fragmentPromise = fragmentCache[path];
        if (!fragmentPromise) {
            // Didnt't have the element tree, so lets actually load it.
            fragmentCache[path] = fragmentPromise = WinJS.UI.Fragments.renderCopy(path);
        }

        // Wait for the load to complete so we have the elements
        const fragment = await fragmentPromise;
        const templates = WinJS.Utilities.query(`[${TEMPLATE_ID_ATTRIBUTE_NAME}]`, fragment);

        // Extract all the templates, even the ones we weren't looking for (aka warm the cache)
        const templatePromises = templates.map(async (el: HTMLElement) => {
            const control = await WinJS.UI.process(el);
            control.disableOptimizedProcessing = true;
            return {
                template: control,
                id: el.getAttribute(TEMPLATE_ID_ATTRIBUTE_NAME),
            };
        });

        // awit for all the loading to complete
        const templateControls: { template: WinJS.Binding.Template; id: string }[] = await Promise.all(templatePromises);

        // Plop them in the cache
        for (let controlInfo of templateControls) {
            templateCache[path + "#" + controlInfo.id] = controlInfo.template;
        }

        const foundTemplate = templateCache[templateCacheKey];
        if (!foundTemplate) {
            throw new Error("No template with name '" + id + "' found");
        }

        return foundTemplate;
    }

    export function clearTemplateCaches(): void {
        WinJS.UI.Fragments.clearCache();
        templateCache = {};
        fragmentCache = {};
    }

    export function marryPartsToControl(element: HTMLElement, control: any): void {
        const parts = WinJS.Utilities.query("[data-part]", element);
        parts.forEach(function (part) {
            var partName = part.getAttribute("data-part");
            if (!partName) {
                return;
            }

            control[partName] = part.winControl || part;
        });
    }

    export function marryEventsToHandlers(element: HTMLElement, context: any): ICancellable {
        const eventElements = WinJS.Utilities.query("[data-event]", element);
        const cancellation = {
            handlers: [],
            cancel: function () {
                for (let item of this.handlers) {
                    item.element.removeEventListener(item.event, item.handler);
                }
            }
        };

        // Make sure we include the root element. It might not actually have
        // the attribute we want, but it's easier to include here, since we
        // check anyway.
        eventElements.unshift(element);

        eventElements.forEach(function (el) {
            const attributeData = el.getAttribute("data-event");
            if (!attributeData) {
                return;
            }

            const eventOptions = WinJS.UI.optionsParser(attributeData, context);
            for(let key in eventOptions) {
                if (!eventOptions[key]) {
                    throw new Error("Missing event handler for '" + key + "' event");
                }

                const wrapper = function () {
                    eventOptions[key].apply(context, arguments);
                };

                cancellation.handlers.push({
                    element: el,
                    event: key,
                    handler: wrapper,
                });

                el.addEventListener(key, wrapper);
            };
        });

        return cancellation;
    }

    /// <summary>
    /// Class to view the outoput of Codevoid.Utilties.Logging in a nice top level floating "window"
    /// </summary>
    export class LogViewer {
        private _handlersToCancel: ICancellable[] = [];
        private _logger: Logging = null;
        private _messageContainer: HTMLElement;

        constructor(private element: HTMLElement, options?: any) {
            // Set up our own element
            Codevoid.Utilities.DOM.setControlAttribute(element, "Codevoid.Utilities.DOM.LogViewer");
            WinJS.Utilities.addClass(element, "codevoid-logviewer");
            WinJS.UI.setOptions(this, options);

            // Create the container for all the messages
            this._messageContainer = document.createElement("div");
            WinJS.Utilities.addClass(this._messageContainer, "codevoid-logviewer-messages");
            this.element.appendChild(this._messageContainer);

            // Create the dismiss button to hide this thing
            const dismissElement = document.createElement("div");
            WinJS.Utilities.addClass(dismissElement, "codevoid-logviewer-dismiss");

            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(dismissElement, {
                click: () => {
                    this._dismiss();
                }
            }));

            this.element.appendChild(dismissElement);

            // Capture the logger & listen for events
            this._logger = Codevoid.Utilities.Logging.instance;
            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(this._logger, {
                newlogmessage: (e: EventObject<ILogMessage>) => this._appendMessage(e.detail),
                logcleared: () => this._messageContainer.innerHTML = "",
            }));

            const clearLogElement = document.createElement("div");
            WinJS.Utilities.addClass(clearLogElement, "codevoid-logviewer-clearlog");
            clearLogElement.textContent = "Clear Log";

            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(clearLogElement, {
                click: () => this._logger.clear(),
            }));

            this.element.appendChild(clearLogElement);

            for (let message of this._logger.messages) {
                this._appendMessage(message);
            }
        }

        private _appendMessage(message: ILogMessage): void {
            var messageElement;
            if (message.useFixedLayout) {
                // If it's using fixed layout, then we want to render it
                // in a 'pre' element to ensure forrect formatting
                messageElement = document.createElement("pre");
            } else {
                messageElement = document.createElement("div");
            }

            messageElement.textContent = message.message;

            this._messageContainer.appendChild(messageElement);
        }

        private _dismiss(): void {
            for (let toCancel of this._handlersToCancel) {
                toCancel.cancel();
            }

            this._handlersToCancel = null;
            this.element.parentElement.removeChild(this.element);
        }
    }
}