(function () {
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
                    canAuthenticateChanged: this._canAuthenticateChanged.bind(this),
                });
                
                this._handlersToCleanup.push(cleanup);
            },
            _allowPasswordEntryChanged: function () {
                this.passwordInput.disabled = !this.viewModel.allowPasswordEntry;
            },
            _canAuthenticateChanged: function () {
                this.authenticateButton.disabled = !this.viewModel.canAuthenticate;
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
                if (!this.viewModel.canAuthenticate) {
                    return;
                }

                this.viewModel.credentialAcquisitionComplete.complete();
            }),
            canceled: msfp(function () {
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