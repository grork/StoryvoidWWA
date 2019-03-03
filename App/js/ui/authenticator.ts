namespace Codevoid.Storyvoid.UI {
    const msfp = WinJS.Utilities.markSupportedForProcessing;

    export class Authenticator extends Codevoid.UICore.Control {
        private _handlersToCleanup: Utilities.ICancellable[] = [];
        private accountInformationContainer: HTMLElement;
        private authenticateButton: HTMLButtonElement;
        private credentialContainer: HTMLElement;
        private errorMessage: HTMLElement;
        private errorMessageContainer: HTMLElement;
        private passwordInput: HTMLInputElement;
        private usernameInput: HTMLInputElement;
        private viewModel: Codevoid.Storyvoid.Authenticator.AuthenticatorViewModel;
        private workingContainer: HTMLElement;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "authenticatorCredentials").then(function (template) {
                return template.render(null, element);
            }).then(() => {
                // Make sure we set the attribute after, since when we render
                // the template on our own element, it'll process the win-control
                // attribute and create two of them. This would be bad, mmmkay?
                Codevoid.Utilities.DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.Authenticator");

                this._handlersToCleanup.push(Codevoid.Utilities.DOM.marryEventsToHandlers(element, this));
                Codevoid.Utilities.DOM.marryPartsToControl(element, this);
                this._initializeViewModelListeners();

                WinJS.Promise.timeout().then(() => this.usernameInput.focus());
            });
        }

        private _initializeViewModelListeners() {
            const cleanup = Codevoid.Utilities.addEventListeners(this.viewModel, {
                allowUsernameEntryChanged: this._allowUsernameEntryChanged.bind(this),
                canAuthenticateChanged: this._canAuthenticateChanged.bind(this),
                isWorkingChanged: this._isWorkingChanged.bind(this),
                authenticationErrorMessageChanged: this._authenticationErrorMessageChanged.bind(this),
            });

            this._handlersToCleanup.push(cleanup);
        }

        private _allowUsernameEntryChanged() {
            this.usernameInput.disabled = !this.viewModel.allowUsernameEntry;
        }

        private _authenticationErrorMessageChanged() {
            const messageContent = this.viewModel.authenticationErrorMessage;
            this.errorMessage.textContent = messageContent;

            if (!messageContent) {
                WinJS.Utilities.addClass(this.errorMessageContainer, "hide");
                WinJS.Utilities.addClass(this.accountInformationContainer, "show");
            } else {
                WinJS.Utilities.removeClass(this.errorMessageContainer, "hide");
                WinJS.Utilities.removeClass(this.accountInformationContainer, "show");
            }
        }

        private _canAuthenticateChanged() {
            this.authenticateButton.disabled = !this.viewModel.canAuthenticate;
        }

        private _isWorkingChanged() {
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
        }

        private _fadeElement(el: HTMLElement, targetOpacity: number) {
            // If there were some events hanging off this element
            // waiting for a previous animation to complete, just
            // cancel & clean them up
            if ((<any>el)._handlers) {
                (<any>el)._handlers.cancel();
                (<any>el)._handlers = null;
            }

            WinJS.Utilities.addClass(el, "animateOpacity");

            const handlers = Codevoid.Utilities.addEventListeners(el, {
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
            (<any>el)._handlers = handlers;

            // make sure the element is visible
            WinJS.Utilities.removeClass(el, "hide");

            // Bounce through the dispatcher to give the DOM a moment to layout
            // and then actually apply the transform to initial positions
            WinJS.Promise.timeout(1).then(() => {
                el.style.opacity = targetOpacity.toString();
            });
        }

        public dispose() {
            this._handlersToCleanup.forEach((events) => events.cancel());
        }

        public usernameChanged() {
            this.viewModel.username = this.usernameInput.value;
        }

        public usernameKeydown(e: KeyboardEvent) {
            if (e.keyCode === WinJS.Utilities.Key.enter && !this.passwordInput.value) {
                e.stopPropagation();
                e.preventDefault();
                this.passwordInput.focus();
            }
        }

        public passwordChanged() {
            this.viewModel.password = this.passwordInput.value;
        }

        public authenticate() {
            if (!this.viewModel.canAuthenticate || this.viewModel.isWorking) {
                return;
            }

            const readyToAuthenticate = document.createEvent("Event");
            readyToAuthenticate.initEvent("readytoauthenticate", true, true);

            this.element.dispatchEvent(readyToAuthenticate);
        }

        public containerKeyDown(e: KeyboardEvent) {
            switch (e.keyCode) {
                case WinJS.Utilities.Key.enter:
                    this.authenticate();
                    break;

                default:
                    break;
            }
        }
    }

    WinJS.Utilities.markSupportedForProcessing(Authenticator.prototype.usernameChanged);
    WinJS.Utilities.markSupportedForProcessing(Authenticator.prototype.usernameKeydown);
    WinJS.Utilities.markSupportedForProcessing(Authenticator.prototype.passwordChanged);
    WinJS.Utilities.markSupportedForProcessing(Authenticator.prototype.containerKeyDown);
    WinJS.Utilities.markSupportedForProcessing(Authenticator.prototype.authenticate);
}