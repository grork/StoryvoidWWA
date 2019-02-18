declare module Codevoid.Utilities {
    export function derive(...args: any[]): any
}

(function () {
    "use strict";
    const msfp = WinJS.Utilities.markSupportedForProcessing;

    WinJS.Namespace.define("Codevoid.Storyvoid.UI", {
        Authenticator: Codevoid.Utilities.derive(Codevoid.UICore.Control, function (element, options) {
            this._handlersToCleanup = [];
            this.base(element, options);

            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "authenticatorCredentials").then(function (template) {
                return template.render(null, element);
            }).done(function () {
                // Make sure we set the attribute after, since when we render
                // the template on our own element, it'll process the win-control
                // attribute and create two of them. This would be bad, mmmkay?
                Codevoid.Utilities.DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.Authenticator");

                this._handlersToCleanup.push(Codevoid.Utilities.DOM.marryEventsToHandlers(element, this));
                Codevoid.Utilities.DOM.marryPartsToControl(element, this);
                this._initializeViewModelListeners();

                WinJS.Promise.timeout().then(function () {
                    this.usernameInput.focus();
                }.bind(this));
            }.bind(this));
        }, {
            _handlersToCleanup: null,
            _initializeViewModelListeners: function () {
                var cleanup = Codevoid.Utilities.addEventListeners(this.viewModel, {
                    allowUsernameEntryChanged: this._allowUsernameEntryChanged.bind(this),
                    canAuthenticateChanged: this._canAuthenticateChanged.bind(this),
                    isWorkingChanged: this._isWorkingChanged.bind(this),
                    authenticationErrorMessageChanged: this._authenticationErrorMessageChanged.bind(this),
                });
                
                this._handlersToCleanup.push(cleanup);
            },
            _allowUsernameEntryChanged: function () {
                this.usernameInput.disabled = !this.viewModel.allowUsernameEntry;
            },
            _authenticationErrorMessageChanged: function () {
                var messageContent = this.viewModel.authenticationErrorMessage;
                var op = "addClass";

                if (!messageContent) {
                    op = "addClass";
                } else {
                    op = "removeClass"
                }

                this.errorMessage.textContent = messageContent;
                WinJS.Utilities[op](this.errorMessageContainer, "hide");
                WinJS.Utilities[op](this.accountInformationContainer, "show");
            },
            _canAuthenticateChanged: function () {
                this.authenticateButton.disabled = !this.viewModel.canAuthenticate;
            },
            _isWorkingChanged: function () {
                if (this.viewModel.isWorking) {
                    // If we're working, we want to move the focus
                    // out of our text box so we don't see a flashing
                    // caret.
                    this.credentialContainer.focus();

                    // Fade the containers out so we can have a nice experience
                    this._fadeElement(this.workingContainer, 1.0);
                    this._fadeElement(this.credentialContainer, 0.0);
                } else {
                    // Fade the elements to ensure we can see the text boxes etc.
                    this._fadeElement(this.workingContainer, 0.0);
                    this._fadeElement(this.credentialContainer, 1.0);

                    // If we're re-showing the text box, make sure
                    // we put focus into them.
                    this.usernameInput.focus();
                }
            },
            _fadeElement: function (el, targetOpacity) {
                // If there were some events hanging off this element
                // waiting for a previous animation to complete, just
                // cancel & clean them up
                if (el._handlers) {
                    el._handlers.cancel();
                    el._handlers = null;
                }

                WinJS.Utilities.addClass(el, "animateOpacity");

                var handlers = Codevoid.Utilities.addEventListeners(el, {
                    transitionend: (e) => {
                        if (e.target != el) {
                            // Not the element we're looking for, so skip
                            return;
                        }

                        handlers.cancel();

                        WinJS.Utilities.removeClass(el, "animateOpacity");

                        // If we've transitioned to a final opacity
                        // that is basically invisible, we should just hide
                        // the element
                        if (targetOpacity < 0.01) {
                            WinJS.Utilities.addClass(el, "hide");
                        }
                    }
                });

                // Save Handlers so we can cancel them later.
                el._handlers = handlers;

                // make sure the element is visible
                WinJS.Utilities.removeClass(el, "hide");

                // Bounce through the dispatcher to give the DOM a moment to layout
                // and then actually apply the transform to initial positions
                WinJS.Promise.timeout(1).done(() => {
                    el.style.opacity = targetOpacity;
                });
            },
            dispose: function () {
                this._handlersToCleanup.forEach(function (events) {
                    events.cancel();
                });
            },
            usernameChanged: msfp(function () {
                this.viewModel.username = this.usernameInput.value;
            }),
            usernameKeydown: msfp(function(e) {
                if(e.keyCode === WinJS.Utilities.Key.enter && !this.passwordInput.value)
                {
                    e.stopPropagation();
                    e.preventDefault();
                    this.passwordInput.focus();
                }
            }),
            passwordChanged: msfp(function () {
                this.viewModel.password = this.passwordInput.value;
            }),
            authenticate: msfp(function () {
                if (!this.viewModel.canAuthenticate || this.viewModel.isWorking) {
                    return;
                }

                var readyToAuthenticate = document.createEvent("Event");
                readyToAuthenticate.initEvent("readytoauthenticate", true, true);

                this.element.dispatchEvent(readyToAuthenticate);
            }),
            containerKeyDown: msfp(function (e) {
                switch (e.keyCode) {
                    case WinJS.Utilities.Key.enter:
                        this.authenticate();
                        break;

                    default:
                        break;
                }
            }),
        }),
    });
})();