interface Window {
    appassert(assertion: boolean, message: string): void;
    appfail(message: string): void;
}

declare module Codevoid.Utilities.DOM {
    export class LogViewer {
        constructor(host: HTMLElement);
    }
}

namespace Codevoid.Utilities {
    WinJS.Namespace.define("Codevoid.Utilities", {
        EventSource: WinJS.Class.mix(WinJS.Class.define(function () {
        }), WinJS.Utilities.eventMixin),
        derive: function derive(baseClass, constructor, instanceMembers, staticMembers) {
            /// <summary>
            /// Enables javascript 'classes' to be derived, and have simple access to the
            /// 'base' classes constructor.
            ///
            /// This allows for a more fluid hiearchy of classes without having explicit,
            /// coded in type names which can be a challenge as time passes and things move
            /// around.
            ///
            /// When using this method, the derived class can gain access to the base class
            /// constructor through 'this.base()'. It can supply arguments as it sees fit,
            /// and these will be passed down from class to class
            /// </summary>
            instanceMembers = instanceMembers || {};
            if (baseClass instanceof Function) {
                instanceMembers.base = function () {
                    // Patching stuff up. Comment
                    var original = this.base;
                    this.base = baseClass.prototype.base;
                    baseClass.apply(this, arguments);
                    this.base = original;
                };
            }

            return WinJS.Class.derive(baseClass, constructor, instanceMembers, staticMembers);
        },
    })

    if (!window.alert) {
        (function () {
            var alertsToShow = [];
            var dialogVisible = false;

            function showPendingAlerts() {
                if (dialogVisible || !alertsToShow.length) {
                    return;
                }

                dialogVisible = true;
                (new Windows.UI.Popups.MessageDialog(alertsToShow.shift())).showAsync().done(function () {
                    dialogVisible = false;
                    showPendingAlerts();
                });
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
    }

    export class Signal extends EventSource {
        private _wrappedPromise: WinJS.Promise<any>;
        private _complete: (value: any) => void;
        private _completed: boolean = false;
        private _error: (errorInfo: any) => void;
        private _progress: (progress: any) => void;

        constructor() {
            super();

            var that = this;
            // This uses the "that" pattern 'c ause it's called from a constructor, and
            // I don't want to mess with anything weird to upset the promise gods.
            this._wrappedPromise = new WinJS.Promise(function (c, e, p) {
                that._complete = c;
                that._error = e;
                that._progress = p;
            }, this._handleCancelled.bind(this));
        }

        private _handleCancelled(): void {
            this.dispatchEvent("cancelled", { signal: this });
        }

        public get promise(): WinJS.Promise<any> {
            return this._wrappedPromise;
        }

        public complete(result?: any): void {
            if (this._completed) {
                throw new Error("Cannot complete an already completed promise");
            }

            this._complete(result);
            this._completed = true;
        }

        public error(errorInfo: any): void {
            this._error(errorInfo);
        }

        public progress(progressInfo: any): void {
            this._progress(progressInfo);
        }
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

    export class CancellationSource {
        private _cancelled: boolean = false;

        public cancel(): void {
            this._cancelled = true;
        }

        public get cancelled(): boolean {
            return this._cancelled;
        }
    }

    export function serialize(items: any[], work: (item: any, index?: number) => WinJS.Promise<any>, concurrentWorkLimit?: number, cancellationSource?: CancellationSource): WinJS.Promise<any> {
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
                    signal.promise.cancel();
                    return;
                }

                signal.complete();
            }
        }

        // Set up all the signals so that as each one
        // is signalled, the work it needs to do gets
        // done.
        items.forEach(function (item, index) {
            const signal = new Codevoid.Utilities.Signal();
            signals.push(signal);

            results.push(signal.promise.then(function () {
                numberInFlight++;
                return WinJS.Promise.as(work(item, index));
            }).then(function (value) {
                numberInFlight--;
                doWork();
                return value;
            }, function (error) {
                numberInFlight--;
                doWork();
                return WinJS.Promise.wrapError(error);
            }));
        });

        doWork();

        return WinJS.Promise.join(results);
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

    var fragmentCache = {};
    var templateCache = {};
    const TEMPLATE_ID_ATTRIBUTE_NAME = "data-templateid";

    WinJS.Namespace.define("Codevoid.Utilities.DOM", {
        msfp: WinJS.Utilities.markSupportedForProcessing,
        disposeOfControl: function disposeOfControl(element) {
            if (!element || !element.winControl || !element.winControl.dispose) {
                return;
            }

            try {
                element.winControl.dispose();
            } catch (e) {
                window.appfail("Failed to unload control:\n" + e.toString() + "\nStack:\n" + e.stack);
            }
        },
        disposeOfControlTree: function disposeOfControlTree(root) {
            var toUnload = WinJS.Utilities.query("[data-win-control]", root);
            if (root.hasAttribute("data-win-control")) {
                toUnload.unshift(root);
            }

            for (var i = toUnload.length - 1; i > -1; i--) {
                Codevoid.Utilities.DOM.disposeOfControl(toUnload[i]);
            }
        },
        removeChild: function (element, child) {
            Codevoid.Utilities.DOM.disposeOfControlTree(child);
            return element.removeChild(child);
        },
        empty: function (element) {
            window.appassert(element, "no element provided");
            if (!element) {
                return;
            }

            Codevoid.Utilities.DOM.disposeOfControlTree(element);
            element.innerHTML = "";
        },
        setControlAttribute: function (element, controlClassName) {
            if (element.hasAttribute("data-win-control")) {
                return;
            }

            element.setAttribute("data-win-control", controlClassName);
        },
        loadTemplate: function (path, id) {
            var templateCacheKey = path + "#" + id;
            var template = templateCache[templateCacheKey];
            if (template) {
                return WinJS.Promise.wrap(template);
            }

            var fragmentPromise = fragmentCache[path];
            if (!fragmentPromise) {
                fragmentCache[path] = fragmentPromise = WinJS.UI.Fragments.renderCopy(path);
            }

            return fragmentPromise.then(function (fragment) {
                var templates = WinJS.Utilities.query("[" + TEMPLATE_ID_ATTRIBUTE_NAME + "]", fragment);

                var templatePromises = templates.map(function (el) {
                    return WinJS.UI.process(el).then(function (control) {
                        control.disableOptimizedProcessing = true;
                        return {
                            template: control,
                            id: el.getAttribute(TEMPLATE_ID_ATTRIBUTE_NAME),
                        };
                    });
                });

                return WinJS.Promise.join(templatePromises);
            }).then(function (templateControls) {
                templateControls.forEach(function (controlInfo) {
                    templateCache[path + "#" + controlInfo.id] = controlInfo.template;
                });

                var template = templateCache[templateCacheKey];

                if (!template) {
                    return WinJS.Promise.wrapError(new Error("No template with name '" + id + "' found"));
                }

                return template;
            });
        },
        clearTemplateCaches: function () {
            WinJS.UI.Fragments.clearCache();
            templateCache = {};
            fragmentCache = {};
        },
        marryPartsToControl: function (element, control) {
            var parts = WinJS.Utilities.query("[data-part]", element);
            parts.forEach(function (part) {
                var partName = part.getAttribute("data-part");
                if (!partName) {
                    return;
                }

                control[partName] = part.winControl || part;
            });
        },
        marryEventsToHandlers: function marryEventsToHandlers(element, context) {
            var eventElements = WinJS.Utilities.query("[data-event]", element);
            var cancellation = {
                handlers: [],
                cancel: function () {
                    this.handlers.forEach(function (item) {
                        item.element.removeEventListener(item.event, item.handler);
                    });
                }
            };
            // Make sure we include the root element. It might not actually have
            // the attribute we want, but it's easier to include here, since we
            // check anyway.
            eventElements.unshift(element);

            eventElements.forEach(function (el) {
                var eventOptions;
                var attributeData = el.getAttribute("data-event");
                if (!attributeData) {
                    return;
                }

                eventOptions = WinJS.UI.optionsParser(attributeData, context);

                Object.keys(eventOptions).forEach(function (key) {
                    if (!eventOptions[key]) {
                        throw new Error("Missing event handler for '" + key + "' event");
                    }

                    var wrapper = function () {
                        eventOptions[key].apply(context, arguments);
                    };

                    cancellation.handlers.push({
                        element: el,
                        event: key,
                        handler: wrapper,
                    });

                    el.addEventListener(key, wrapper);
                });
            });

            return cancellation;
        },
        /// <summary>
        /// Class to view the outoput of Codevoid.Utilties.Logging in a nice top level floating "window"
        /// </summary>
        LogViewer: WinJS.Class.define(function (element, options) {
            this._handlersToCancel = [];

            // Set up our own element
            this.element = element;
            Codevoid.Utilities.DOM.setControlAttribute(element, "Codevoid.Utilities.DOM.LogViewer");
            WinJS.Utilities.addClass(element, "codevoid-logviewer");
            WinJS.UI.setOptions(this, options);

            // Create the container for all the messages
            this._messageContainer = document.createElement("div");
            WinJS.Utilities.addClass(this._messageContainer, "codevoid-logviewer-messages");
            this.element.appendChild(this._messageContainer);

            // Create the dismiss button to hide this thing
            var dismissElement = document.createElement("div");
            WinJS.Utilities.addClass(dismissElement, "codevoid-logviewer-dismiss");

            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(dismissElement, {
                click: function () {
                    this._dismiss();
                }.bind(this)
            }));

            this.element.appendChild(dismissElement);

            // Capture the logger & listen for events
            this._logger = Codevoid.Utilities.Logging.instance;
            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(this._logger, {
                newlogmessage: function (e) {
                    var message = e.detail;

                    this._appendMessage(message);
                }.bind(this),
                logcleared: function () {
                    this._messageContainer.innerHTML = "";
                }.bind(this),
            }));

            var clearLogElement = document.createElement("div");
            WinJS.Utilities.addClass(clearLogElement, "codevoid-logviewer-clearlog");
            clearLogElement.textContent = "Clear Log";

            this._handlersToCancel.push(Codevoid.Utilities.addEventListeners(clearLogElement, {
                click: function () {
                    this._logger.clear();
                }.bind(this),
            }));

            this.element.appendChild(clearLogElement);

            this._logger.messages.forEach(function (message) {
                this._appendMessage(message);
            }.bind(this));
        }, {
                _handlersToCancel: null,
                element: null,
                _logger: null,
                _messageContainer: null,
                _appendMessage: function (message) {
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
                },
                _dismiss: function () {
                    this._handlersToCancel.forEach(function (toCancel) {
                        toCancel.cancel();
                    });

                    this._handlersToCancel = null;

                    this.element.parentElement.removeChild(this.element);
                },
            }),
    });
}