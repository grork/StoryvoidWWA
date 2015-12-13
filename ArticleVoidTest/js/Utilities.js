(function () {
    "use strict";

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
    
    WinJS.Namespace.define("Codevoid.Utilities", {
        Signal: WinJS.Class.mix(WinJS.Class.define(function () {
            var that = this;
            // This uses the "that" pattern 'c ause it's called from a constructor, and
            // I don't want to mess with anything weird to upset the promise gods.
            this._wrappedPromise = new WinJS.Promise(function (c, e, p) {
                that._complete = c;
                that._error = e;
                that._progress = p;
            }, this._handleCancelled.bind(this));
        },
        {
            _wrappedPromise: null,
            _complete: null,
            _completed: false,
            _error: null,
            _progress: null,
            _handleCancelled: function _handleCancelled(e) {
                this.dispatchEvent("cancelled", { signal: this });
            },
            promise: {
                get: function () {
                    return this._wrappedPromise;
                }
            },
            complete: function signal_complete(value) {
                if (this._completed) {
                    throw new Error("Cannot complete an already completed promise");
                }

                this._complete(value);
                this._completed = true;
            },
            error: function signal_error(errorInfo) {
                this._error(errorInfo);
            },
            progress: function signal_progress(progressInfo) {
                this._progress(progressInfo);
            },
        }), WinJS.Utilities.eventMixin),
        /// <summary>
        /// Logging helper class that provides structured & unstructured logging.
        /// Structured in this case means support for saying "this message should be presented without reformatting"
        ///
        /// Additionally, this provides an in memory store of the messages so they can be seen later if the
        /// viewer was not open at the time they were originally logged.
        /// </summary>
        Logging: WinJS.Class.mix(WinJS.Class.define(function () {
            this.clear();
        }, {
            _logMessages: null,
            logToConsole: false,
            log: function _log(message, fixedLayout) {
                var messageDetail = { message: message, useFixedLayout: fixedLayout };
                this._logMessages.push(messageDetail);

                if (this.logToConsole) {
                    console.log(message);
                }

                this.dispatchEvent("newlogmessage", messageDetail);
            },
            messages: {
                get: function logging_getMessages() {
                    // Clone the messages list to stop consumers manipultating the list itself
                    // Doesn't protect against manipulating each individual message itself.
                    return [].concat(this._logMessages);
                },
            },
            clear: function () {
                this._logMessages = [];
                this.dispatchEvent("logcleared");
            },
            showViewer: function () {
                var viewerElement = document.createElement("div");
                document.body.appendChild(viewerElement);

                viewerElement.winControl = new Codevoid.Utilities.DOM.LogViewer(viewerElement);
            }
        }, {
            _instance: null,
            instance: {
                get: function loggin_getInstance() {
                    if (!Codevoid.Utilities.Logging._instance) {
                        Codevoid.Utilities.Logging._instance = new Codevoid.Utilities.Logging();
                    }

                    return Codevoid.Utilities.Logging._instance;
                }
            }
        }), WinJS.Utilities.eventMixin),
        EventSource: WinJS.Class.mix(WinJS.Class.define(function() {
        }), WinJS.Utilities.eventMixin),
        serialize: function serialize(items, work) {
            var results = [];
            var signals = [];

            function doWork() {
                // Start the "cascade"
                if(!signals.length) {
                    return;
                }

                var signal = signals.shift();
                signal.complete();
            }

            // Set up all the signals so that as each one
            // is signalled, the work it needs to do gets
            // done.
            items.forEach(function (item, index) {
                var signal = new Codevoid.Utilities.Signal();
                signals.push(signal);

                results.push(signal.promise.then(function () {
                    return WinJS.Promise.as(work(item, index));
                }).then(function (value) {
                    doWork();
                    return value;
                }, function (error) {
                    doWork();
                    return WinJS.Promise.wrapError(error);
                }));
            });

            doWork();

            return WinJS.Promise.join(results);
        },
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
        property: function property(name, defaultValue) {
            var propertyName = "_" + name + "Storage";
            return {
                get: function property_getter() {
                    if (!(propertyName in this)) {
                        return defaultValue;
                    }

                    return this[propertyName];
                },
                set: function property_setter(newValue) {
                    var oldValue = this[name];
                    if (oldValue === newValue) {
                        return;
                    }

                    this[propertyName] = newValue;
                    this.dispatchEvent(name + "Changed", {
                        previous: oldValue,
                        current: newValue,
                    });
                },
            };
        },
        addEventListeners: function (eventSource, handlerMap) {
            var cancellation = {
                handlers: [],
                cancel: function () {
                    this.handlers.forEach(function (l) {
                        eventSource.removeEventListener(l.event, l.handler);
                    });
                }
            };

            Object.keys(handlerMap).forEach(function (key) {
                eventSource.addEventListener(key, handlerMap[key]);
                cancellation.handlers.push({ event: key, handler: handlerMap[key] });
            });

            return cancellation;
        },
    });

    var fragmentCache = {};
    var templateCache = {};
    var templateIdAttributeName =  "data-templateid";

    WinJS.Namespace.define("Codevoid.Utilities.DOM", {
        msfp: WinJS.Utilities.markSupportedForProcessing,
        disposeOfControl: function disposeOfControl(element) {
            if (!element || !element.winControl || !element.winControl.dispose) {
                return;
            }

            try {
                element.winControl.dispose();
            } catch (e) {
                appfail("Failed to unload control:\n" + e.toString() + "\nStack:\n" + e.stack);
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
            appassert(element, "no element provided");
            if (!element) {
                return;
            }

            Codevoid.Utilities.DOM.disposeOfControlTree(element);
            element.innerHTML = "";
        },
        setControlAttribute: function(element, controlClassName) {
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
                var templates = WinJS.Utilities.query("[" + templateIdAttributeName + "]", fragment);

                var templatePromises = templates.map(function (el) {
                    return WinJS.UI.process(el).then(function (control) {
                        control.disableOptimizedProcessing = true;
                        return {
                            template: control,
                            id: el.getAttribute(templateIdAttributeName),
                        };
                    });
                });

                return WinJS.Promise.join(templatePromises);
            }).then(function (templateControls) {
                templateControls.forEach(function(controlInfo) {
                    templateCache[path + "#" + controlInfo.id] = controlInfo.template;
                });

                var template = templateCache[templateCacheKey];
                
                if (!template) {
                    return WinJS.Promise.wrapError(new Error("No template with name '" + id + "' found"));
                }

                return template;
            });
        },
        clearTemplateCaches: function() {
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
                        throw new Exception("Missing event handler for '" + key + "' event");
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
            _appendMessage: function(message) {
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
})();