(function () {
    "use strict";

    if (!window.alert) {
        window.alert = function (message) {
            (new Windows.UI.Popups.MessageDialog(message)).showAsync();
        };
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
    });
})();