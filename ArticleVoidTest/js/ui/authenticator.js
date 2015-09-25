﻿(function () {
    "use strict";
    var msfp = Codevoid.Utilities.DOM.msfp;

    WinJS.Namespace.define("Codevoid.ArticleVoid.UI", {
        Authenticator: Codevoid.Utilities.derive(Codevoid.UICore.Control, function (element, options) {
            this._handlersToCleanup = [];
            element = element || document.createElement("div");
            this.base(element, options);

            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "authenticatorCredentials").then(function (template) {
                return template.render(null, element);
            }).done(function () {
                // Make sure we set the attribute after, since when we render
                // the template on our own element, it'll process the win-control
                // attribute and create two of them. This would be bad, mmmkay?
                if (!element.hasAttribute("data-win-control")) {
                    element.setAttribute("data-win-control", "Codevoid.ArticleVoid.UI.Authenticator");
                }

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
                    allowPasswordEntryChanged: this._allowPasswordEntryChanged.bind(this),
                    allowUsernameEntryChanged: this._allowUsernameEntryChanged.bind(this),
                    canAuthenticateChanged: this._canAuthenticateChanged.bind(this),
                    isWorkingChanged: this._isWorkingChanged.bind(this),
                    authenticationErrorMessageChanged: this._authenticationErrorMessageChanged.bind(this),
                });
                
                this._handlersToCleanup.push(cleanup);
            },
            _allowPasswordEntryChanged: function () {
                this.passwordInput.disabled = !this.viewModel.allowPasswordEntry;
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
            },
            _canAuthenticateChanged: function () {
                this.authenticateButton.disabled = !this.viewModel.canAuthenticate;
            },
            _isWorkingChanged: function () {
                var op = this.viewModel.isWorking ? "remove" : "add";
                WinJS.Utilities[op + "Class"](this.workingContainer, "hide");

                this.cancelButton.disabled = this.viewModel.isWorking;
                if (!this.viewModel.isWorking) {
                    this.usernameInput.focus();
                }
            },
            dispose: function () {
                this._handlersToCleanup.forEach(function (events) {
                    events.cancel();
                });
            },
            usernameChanged: msfp(function () {
                this.viewModel.username = this.usernameInput.value;
            }),
            passwordChanged: msfp(function () {
                this.viewModel.password = this.passwordInput.value;
            }),
            authenticate: msfp(function () {
                if (!this.viewModel.canAuthenticate || this.viewModel.isWorking) {
                    return;
                }

                this.viewModel.credentialAcquisitionComplete.complete();
            }),
            canceled: msfp(function () {
                if (this.viewModel.isWorking) {
                    return;
                }

                this.viewModel.credentialAcquisitionComplete.promise.cancel();
            }),
            containerKeyDown: msfp(function (e) {
                switch (e.keyCode) {
                    case WinJS.Utilities.Key.escape:
                        this.canceled();
                        break;

                    case WinJS.Utilities.Key.enter:
                        this.authenticate();
                        break;

                    default:
                        break;
                }
            }),
        }, {
            showAuthenticator: function () {
                Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));
                var vm = new Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel();
                vm.authenticate(true).then(null, function () { });
            },
        }),
    });
})();