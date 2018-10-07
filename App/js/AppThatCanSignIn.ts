module Codevoid.Storyvoid.UI {
    export class AppThatCanSignIn implements IAppWithAbilityToSignIn {
        private _signedOutViewModel: Codevoid.Storyvoid.UI.SignedOutViewModel;
        private _signedInViewModel: Codevoid.Storyvoid.UI.ISignedInViewModel;
        private _uiSettings: Windows.UI.ViewManagement.UISettings;
        public initialize(): WinJS.Promise<any> {
            this._uiSettings = new Windows.UI.ViewManagement.UISettings();

            const viewerSettings = new Settings.ViewerSettings();
            viewerSettings.refreshThemeOnDOM();

            Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));

            var credentials = Codevoid.Storyvoid.Authenticator.getStoredCredentials();
            let work: WinJS.Promise<any> = WinJS.Promise.as();
            if (!credentials) {
                this.signOut(false/*wasPreviouslySignedIn*/);
            } else {
                work = this.signedIn(credentials, true /*usingSavedCredentials*/);
            }

            // RS5 seems to have removed the default disablement of the zoom
            // controls (mouse, keyboard), so this adds them back by handling
            // the appropriate events, and stopping the events.
            Utilities.addEventListeners(document, {
                mousewheel: (ev: MouseWheelEvent) => {
                    if (!ev.ctrlKey) {
                        return;
                    }

                    ev.preventDefault();
                },
                keydown: (ev: KeyboardEvent) => {
                    // Equal, Dash, really mean plus & minus, the traditional zoom keys
                    if (((ev.keyCode === WinJS.Utilities.Key.equal) || (ev.keyCode === WinJS.Utilities.Key.dash)) && ev.ctrlKey) {
                        ev.preventDefault();
                    }
                }
            });

            Utilities.addEventListeners(this._uiSettings, {
                colorvalueschanged: () => {
                    viewerSettings.refreshThemeOnDOM();
                }
            });

            return work;
        }

        public signOut(wasPreviouslySignedIn?: boolean): void {
            var signedInElement = <HTMLElement>document.body.firstElementChild;

            this._signedOutViewModel = new Codevoid.Storyvoid.UI.SignedOutViewModel(this);
            var signedOutElement = <HTMLElement>Codevoid.UICore.Experiences.currentHost.addExperienceForModel(this._signedOutViewModel);

            // If we weren't previously signed in -- e.g. on first startup
            // we shouldn't play an animation on loading.
            if (!wasPreviouslySignedIn) {
                WinJS.Utilities.addClass(signedInElement, "hide");
                return;
            }

            // Set the states to animate from. This allows us to animate to an
            // ambient state, rather than a fixed known state.
            signedInElement.style.transform = "translateX(0)";
            signedOutElement.style.transform = "translateX(-100vw)";

            // Add the class that actually configures the animation
            WinJS.Utilities.addClass(signedInElement, "animateTransform");
            WinJS.Utilities.addClass(signedOutElement, "animateTransform");

            var handlersToCancel = Utilities.addEventListeners(signedOutElement, {
                transitionend: (e: TransitionEvent) => {
                    if (e.target != signedOutElement) {
                        return;
                    }

                    handlersToCancel.cancel();

                    WinJS.Utilities.removeClass(signedInElement, "animateTransform");
                    WinJS.Utilities.removeClass(signedOutElement, "animateTransform");

                    signedInElement.style.transform = "";
                    signedOutElement.style.transform = "";

                    WinJS.Utilities.addClass(signedInElement, "hide");
                }
            });

            // Bounce through the dispatcher to give the DOM a moment to layout
            // and then actually apply the transform to initial positions
            WinJS.Promise.timeout(1).done(() => {
                signedInElement.style.transform = "translateX(100vw)";
                signedOutElement.style.transform = "translateX(0)";
            });
        }

        public signedIn(credentials: OAuth.ClientInformation, usingSavedCredentials: boolean): WinJS.Promise<void> {
            var signedInElement = <HTMLElement>document.body.firstElementChild;

            if (!this._signedInViewModel) {
                this._signedInViewModel = this.getSignedInViewModel(this);
                (<Codevoid.UICore.WwaExperienceHost>Codevoid.UICore.Experiences.currentHost).createExperienceWithModel(signedInElement, this._signedInViewModel);
            }

            var signedInResult = this._signedInViewModel.signedIn(usingSavedCredentials);
            WinJS.Utilities.removeClass(signedInElement, "hide");

            // If we're using saved credentials, it means we're in
            // a startup flow, and thus no need to play an entrance
            // animation
            if (usingSavedCredentials) {
                return signedInResult;
            }
            // Assume the sibling element ot signed in is "signed out".
            var signedOutElement = <HTMLElement>signedInElement.nextElementSibling;

            // Set the states to animate from. This allows us to animate to an
            // ambient state, rather than a fixed known state.
            signedInElement.style.transform = "translateX(100vw)";
            signedOutElement.style.transform = "translateX(0)";

            // Add the class that actually configures the animation
            WinJS.Utilities.addClass(signedInElement, "animateTransform");
            WinJS.Utilities.addClass(signedOutElement, "animateTransform");

            // Handler & Handler cleanup for the completion of the
            // entrance animation
            var handlersToCancel = Utilities.addEventListeners(signedInElement, {
                transitionend: (e: TransitionEvent) => {
                    // We'll see other bubbling events from other transitions
                    // make sure we're only handling the one WE started.
                    if (e.target != signedInElement) {
                        return;
                    }
                    
                    // Make sure we don't get hit again
                    handlersToCancel.cancel();

                    // Remove the the animation classes
                    WinJS.Utilities.removeClass(signedInElement, "animateTransform");
                    WinJS.Utilities.removeClass(signedOutElement, "animateTransform");

                    // Allow the ambient state of CSS apply at this point
                    signedInElement.style.transform = "";
                    signedOutElement.style.transform = "";

                    // If we'd actually seen an signedOutViewmodel, clean it up.
                    // This is what actually remove UI for signed out state from the DOM.
                    if (this._signedOutViewModel) {
                        Codevoid.UICore.Experiences.currentHost.removeExperienceForModel(this._signedOutViewModel);
                        this._signedOutViewModel = null;
                    }
                }
            });

            signedInResult.done(() => {

                // Bounce through the dispatcher to give the DOM a moment to layout
                // and then actually apply the transform to initial positions
                WinJS.Promise.timeout(1).done(() => {
                    signedInElement.style.transform = "translateX(0)";
                    signedOutElement.style.transform = "translateX(-100vw)";
                });
            });

            return signedInResult;
        }

        protected get signedInViewModel(): ISignedInViewModel {
            return this._signedInViewModel;
        }

        protected getSignedInViewModel(app: IAppWithAbilityToSignIn): ISignedInViewModel {
            throw new Error("Must implement this method to support signing in");
        }
    }
}