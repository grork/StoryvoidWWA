module Codevoid.Storyvoid {
    export class ShareTargetApp extends UI.AppThatCanSignIn {
        private static _appInstance: ShareTargetApp;

        // Waits for activation to start the initialization of the
        // app. This is because lots of information comes through the
        // activation handler, but also if you don't attach in time,
        // you'll miss the event.
        public static listenForActivation(): void {
            Windows.UI.WebUI.WebUIApplication.addEventListener("activated", (args) => {
                // We really need to yield to the browser before we go lala on getting
                // data and potentially doing any more operations, so bounce around a timeout.
                WinJS.Promise.join([
                    WinJS.Promise.timeout(),
                    telemetryInit
                ]).done(() => {
                    ShareTargetApp._appInstance = new ShareTargetApp();
                    ShareTargetApp._appInstance.initializeWithShareInformation(<Windows.ApplicationModel.Activation.IShareTargetActivatedEventArgs>(args.detail[0]));
                });
            });
        }

        private _shareOperation: Windows.ApplicationModel.DataTransfer.ShareTarget.ShareOperation;
        public initializeWithShareInformation(shareArgs: Windows.ApplicationModel.Activation.IShareTargetActivatedEventArgs): void {
            if (shareArgs.kind !== Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
                return;
            }

            super.initialize();
            const deviceFamily = Windows.System.Profile.AnalyticsInfo.versionInfo.deviceFamily;
            Telemetry.trackAppLaunched("shareTarget");

            var viewModel = <UI.ShareTargetSignedInViewModel>this.signedInViewModel;
            var shareOperation = shareArgs.shareOperation;
            if (viewModel) {
                viewModel.shareDetailsAvailabile(shareOperation);
            } else {
                this._shareOperation = shareOperation;
            }
        }

        protected getSignedInViewModel(): UI.ISignedInViewModel {
            var newViewModel = new UI.ShareTargetSignedInViewModel(this);

            if (this._shareOperation) {
                newViewModel.shareDetailsAvailabile(this._shareOperation);
                this._shareOperation = null;
            }

            return newViewModel;
        }
    }

    // Note, theres no waiting on this to initialize here,
    // but it is waited on later when we get the activated event.
    var telemetryInit = Telemetry.initialize();

    WinJS.Utilities.ready().done(() => {
        ShareTargetApp.listenForActivation();
    });
}

module Codevoid.Storyvoid.UI {
    import DOM = Codevoid.Utilities.DOM;

    interface IArticleDetails {
        title: string;
        url: Windows.Foundation.Uri;
    }

    enum SharingState {
        NotStarted,
        Started,
        Complete,
        Error,
    }

    var QUICK_LINK_ID = "unread";

    export class ShareTargetSignedInViewModel implements ISignedInViewModel {
        public experience = { wwa: "Codevoid.Storyvoid.UI.ShareTargetSignedInExperience" };
        private _app: ShareTargetApp;
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _eventSource: Utilities.EventSource;
        private _articleDetails: IArticleDetails;
        private _shareOperation: Windows.ApplicationModel.DataTransfer.ShareTarget.ShareOperation;
        private _savingToService: boolean = false;
        private _reportedStarted: boolean = false;
        private _reportedError: boolean = false;
        private _reportedCompleted: boolean = false;

        constructor(app: IAppWithAbilityToSignIn) {
            this._app = <ShareTargetApp>app;
            this._eventSource = new Utilities.EventSource();
        }

        private _updateArticleDetails(details: IArticleDetails): void {
            this._articleDetails = details;
            this._eventSource.dispatchEvent("detailschanged", details);

            // Automatically save to instapaper, no waiting
            // for the user to click save with the RS2+ sharing
            // model.
            this.saveToInstapaper();
        }

        public signedIn(usingSavedCredentials: boolean): WinJS.Promise<any> {
            this._clientInformation = Codevoid.Storyvoid.Authenticator.getStoredCredentials();

            Telemetry.instance.track("SignedIn", toPropertySet({
                usedSavedCredentials: usingSavedCredentials,
                appType: "shareTarget",
            }));

            return WinJS.Promise.as();
        }

        public signInCompleted(): void { /* No op in this situation */ }

        public saveToInstapaper(): void {
            var bookmarks = new Codevoid.Storyvoid.InstapaperApi.Bookmarks(this._clientInformation);
            this._savingToService = true;

            this._eventSource.dispatchEvent("sharingstatechanged", SharingState.Started);

            if (!this._reportedStarted) {
                this._shareOperation.reportStarted();
                this._reportedStarted = true;
            }

            WinJS.Promise.join({
                operation: bookmarks.add({
                    title: this._articleDetails.title,
                    url: this._articleDetails.url.absoluteUri
                }),
                delay: WinJS.Promise.timeout(1000), // Let the user see the spinner for a second minimum
            }).then(() => {
                this._eventSource.dispatchEvent("sharingstatechanged", SharingState.Complete);

                var executingPackage = Windows.ApplicationModel.Package.current;
                return WinJS.Promise.join({
                    timeout: WinJS.Promise.timeout(1000),
                    // Because the quick link might need an image, we should start loading it
                    // while the timeout above is showing the user "All Done" to make out lives
                    // simpler.
                    image: executingPackage.installedLocation.getFileAsync("Images\\Square44x44Logo.scale-200.png").then((iconFile: Windows.Storage.StorageFile) => {
                        return Windows.Storage.Streams.RandomAccessStreamReference.createFromFile(iconFile);
                    }),
                });
            }).done((result: { image: Windows.Storage.Streams.RandomAccessStreamReference }) => {
                Telemetry.instance.track("SharedSuccessfully", null);
                Telemetry.instance.updateProfile(Utilities.Mixpanel.UserProfileOperation.add, toPropertySet({
                    sharedArticles: 1,
                }));

                if (this._shareOperation) {
                    // We successfully saved the article, so give the customer
                    // a chance to quickly save it to the same location next time.
                    var quickLink = new Windows.ApplicationModel.DataTransfer.ShareTarget.QuickLink();
                    quickLink.id = QUICK_LINK_ID;
                    quickLink.supportedDataFormats.replaceAll([Windows.ApplicationModel.DataTransfer.StandardDataFormats.uri]);
                    quickLink.title = "Add to Instapaper";
                    quickLink.thumbnail = result.image;

                    this._shareOperation.reportCompleted(quickLink);
                }
            }, (e: any) => {
                Telemetry.instance.track("ShareFailed", null);

                if (!this._reportedError) {
                    this._shareOperation.reportError("Unable to share!");
                    this._reportedError = true;
                }
                this._eventSource.dispatchEvent("sharingstatechanged", SharingState.Error);
            });
        }

        public completeSharingDueToClosing(): void {
            // if we don't have an operation, or, more importantly
            // if we're actually saving the data to the service, don't
            // complete the operation or bad things will happen.
            if (!this._shareOperation || this._savingToService) {
                return;
            }

            // This will throw exceptions if the customer has hit cancel
            // but we also need to call it to complete our usage of the operation
            if (this._reportedStarted && !this._reportedCompleted) {
                this._shareOperation.reportCompleted();
                this._reportedCompleted = true;
            }
        }

        public shareDetailsAvailabile(shareDetails: Windows.ApplicationModel.DataTransfer.ShareTarget.ShareOperation): void {
            this._shareOperation = shareDetails;

            WinJS.Promise.join({
                title: shareDetails.data.properties.title,
                url: shareDetails.data.getUriAsync(),
            }).done((details: IArticleDetails) => {
                if (!details.title) {
                    details.title = details.url.absoluteUri;
                }

                this._updateArticleDetails(details);
            });
        }

        public __test__setArticleDeatils(details: IArticleDetails) {
            this._updateArticleDetails(details);
        }

        public get events(): Utilities.EventSource {
            return this._eventSource;
        }

        public get articleDetails(): IArticleDetails {
            return this._articleDetails;
        }
    }

    export class ShareTargetSignedInExperience extends UICore.Control {
        private _handlersToCleanup: Codevoid.Utilities.ICancellable[] = [];
        private articleTitle: HTMLSpanElement;
        private articleUrl: HTMLDivElement;
        private informationLabel: HTMLDivElement;
        private saveButton: HTMLButtonElement;
        private completingContainer: HTMLDivElement;
        private successMessage: HTMLDivElement;
        private progressRing: HTMLProgressElement;
        private details: HTMLDivElement;
        private viewModel: ShareTargetSignedInViewModel;
        private _hasArticleDetails: boolean = false;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.Storyvoid.UI.ShareTargetSignedInExperience");

            WinJS.UI.processAll(element).done(() => {
                this._initialize();
            });

            this._handlersToCleanup.push(Utilities.addEventListeners(this.viewModel.events, {
                detailschanged: (e: any) => {
                    this._handleArticleDetailsChanged(e.detail);
                },
                sharingstatechanged: (e: any) => {
                    this._handleSharingStateChanged(e.detail);
                }
            }));

            this._handlersToCleanup.push(Utilities.addEventListeners(document, {
                visibilitychange: () => {
                    if (!document.hidden) {
                        return;
                    }

                    this.viewModel.completeSharingDueToClosing();
                }
            }));
        }

        private _initialize(): void {
            this._handlersToCleanup.push(DOM.marryEventsToHandlers(this.element, this));
            DOM.marryPartsToControl(this.element, this);

            if (this._hasArticleDetails) {
                this._handleArticleDetailsChanged(this.viewModel.articleDetails);
            }
        }

        private _handleArticleDetailsChanged(articleDetails: IArticleDetails): void {
            this._hasArticleDetails = true;
            WinJS.Utilities.removeClass(this.details, "hide");
            this.articleTitle.textContent = articleDetails.title;
            this.articleUrl.textContent = articleDetails.url.absoluteUri;            
        }

        private _handleSharingStateChanged(state: SharingState): void {
            switch (state) {
                case SharingState.Started:
                    WinJS.Utilities.addClass(this.informationLabel, "hide");
                    WinJS.Utilities.addClass(this.saveButton, "hide");
                    WinJS.Utilities.removeClass(this.progressRing, "hide");
                    WinJS.Utilities.removeClass(this.completingContainer, "hide");
                    break;

                case SharingState.Complete:
                    WinJS.Utilities.addClass(this.progressRing, "hide");
                    WinJS.Utilities.removeClass(this.successMessage, "hide");
                    break;

                case SharingState.Error:
                    WinJS.Utilities.addClass(this.completingContainer, "hide");
                    WinJS.Utilities.addClass(this.progressRing, "hide");
                    WinJS.Utilities.removeClass(this.informationLabel, "hide");
                    this.informationLabel.innerText = "We couldn't save the article to Instapaper. You can click save again to retry."
                    WinJS.Utilities.removeClass(this.saveButton, "hide");
                    this.saveButton.innerText = "Retry";
                    break;

                default:
                    debugger; // unknown state
                    break;
            }
        }

        public saveClicked(e: UIEvent): void {
            this.viewModel.saveToInstapaper();
        }
    }

    WinJS.Utilities.markSupportedForProcessing(ShareTargetSignedInExperience);
    WinJS.Utilities.markSupportedForProcessing(ShareTargetSignedInExperience.prototype.saveClicked);
}