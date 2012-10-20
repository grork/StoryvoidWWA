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
                this._complete(value);
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
})();