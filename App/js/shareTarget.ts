module Codevoid.ArticleVoid {
    export class ShareTargetApp extends UI.AppThatCanSignIn {
        public initialize(): void {
            super.initialize();

            Windows.UI.WebUI.WebUIApplication.addEventListener("activated", (args) => {
                var shareArgs = <Windows.ApplicationModel.Activation.IShareTargetActivatedEventArgs>args;
                var viewModel = <UI.ShareTargetSignedInViewModel>this.signedInViewModel;

                if (shareArgs.kind === Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {
                    // We really need to yield to the browser before we go lala on getting
                    // data and potentially doing any more operations, so bounce around a timeout.
                    WinJS.Promise.timeout().done(() => {
                        viewModel.shareDetailsAvailabile(shareArgs.shareOperation);
                    });
                } else {
                    // We're testing since we shouldn't see this activation kind
                    // in the real world, so fake some data.
                    viewModel.__test__setArticleDeatils({ title: "Excellent title master. A wise choice that will make you most enlightened", url: new Windows.Foundation.Uri("http://www.bing.com")});
                }
            });
        }

        protected getSignedInViewModel(): UI.ISignedInViewModel {
            return new UI.ShareTargetSignedInViewModel(this);
        }
    }

    WinJS.Utilities.ready().done(() => {
        var app = new ShareTargetApp();
        app.initialize();
    });
}

module Codevoid.ArticleVoid.UI {
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
        public experience = { wwa: "Codevoid.ArticleVoid.UI.ShareTargetSignedInExperience" };
        private _app: ShareTargetApp;
        private _clientInformation: Codevoid.OAuth.ClientInformation;
        private _eventSource: Utilities.EventSource;
        private _articleDetails: IArticleDetails;
        private _shareOperation: Windows.ApplicationModel.DataTransfer.ShareTarget.IShareOperation;
        private _savingToService: boolean = false;

        constructor(app: IAppWithAbilityToSignIn) {
            this._app = <ShareTargetApp>app;
            this._eventSource = new Utilities.EventSource();
        }

        private _updateArticleDetails(details: IArticleDetails): void {
            this._articleDetails = details;
            this._eventSource.dispatchEvent("detailschanged", details);

            if (this._shareOperation && this._shareOperation.quickLinkId === QUICK_LINK_ID) {
                this.saveToInstapaper();
            }
        }

        public signedIn(usingSavedCredentials: boolean): void {
            this._clientInformation = Codevoid.ArticleVoid.Authenticator.getStoredCredentials();
        }

        public saveToInstapaper(): void {
            var bookmarks = new Codevoid.ArticleVoid.InstapaperApi.Bookmarks(this._clientInformation);
            this._savingToService = true;

            this._eventSource.dispatchEvent("sharingstatechanged", SharingState.Started);
    
            this._shareOperation.reportStarted();

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
            },
            (e: any) => {
                this._shareOperation.reportError("Unable to share!");
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

            this._shareOperation.reportCompleted();
        }

        public shareDetailsAvailabile(shareDetails: Windows.ApplicationModel.DataTransfer.ShareTarget.IShareOperation): void {
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
        private successMessage: HTMLDivElement;
        private progressRing: HTMLProgressElement;
        private details: HTMLDivElement;
        private viewModel: ShareTargetSignedInViewModel;
        private _hasArticleDetails: boolean = false;

        constructor(element: HTMLElement, options: any) {
            super(element, options);

            DOM.setControlAttribute(element, "Codevoid.ArticleVoid.UI.ShareTargetSignedInExperience");

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
                    WinJS.Utilities.addClass(this.details, "hide");
                    WinJS.Utilities.removeClass(this.progressRing, "hide");
                    break;

                case SharingState.Complete:
                    WinJS.Utilities.addClass(this.progressRing, "hide");
                    WinJS.Utilities.removeClass(this.successMessage, "hide");
                    break;

                case SharingState.Error:
                    WinJS.Utilities.addClass(this.progressRing, "hide");
                    WinJS.Utilities.removeClass(this.details, "hide");
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