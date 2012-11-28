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
                })
            }
            window.alert = function (message) {
                if (window.console && window.console.log) {
                    window.console.log(message);
                }

                alertsToShow.push(message);
                showPendingAlerts();
            }
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
    });

    WinJS.Namespace.define("Codevoid.Utilities.DOM", {
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
    });
})();