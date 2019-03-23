module Codevoid.Storyvoid.UI {
    import ua = Windows.ApplicationModel.UserActivities;

    function getAdaptiveCard(bookmark: IBookmark): Windows.UI.Shell.IAdaptiveCard {
        const data = {
            "type": "AdaptiveCard",
            "backgroundImage": bookmark.firstImageOriginalUrl,
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Medium",
                    "weight": "Bolder",
                    "text": bookmark.title,
                    "wrap": true,
                    "maxLines": 2
                },
                {
                    "type": "TextBlock",
                    "text": bookmark.extractedDescription,
                    "wrap": true
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.0"
        };

        return Windows.UI.Shell.AdaptiveCardBuilder.createAdaptiveCardFromJson(JSON.stringify(data));
    }

    export class Activity {
        private _activity: ua.UserActivity;
        private _session: ua.UserActivitySession;
        private _started: boolean = false;
        private _requestEvents: Utilities.ICancellable;

        constructor(private _bookmark: IBookmark) {
        }

        public async start(): Promise<void> {
            if (this._started) {
                return;
            }

            let channel = ua.UserActivityChannel.getDefault();
            const activity = await channel.getOrCreateUserActivityAsync(`article:${this._bookmark.bookmark_id}`);
            this._started = true;
            this._activity = activity;

            // Activation URI is what the OS will invoke to reopen the activity
            activity.activationUri = new Windows.Foundation.Uri(Deeplinking.getUriForBookmark(this._bookmark));
            activity.contentType = "text/html"; // OS Knows what it _kinda_ points to
            activity.contentUri = new Windows.Foundation.Uri(this._bookmark.url); // When the customer doesn't have the app, they can open this
            activity.visualElements.displayText = this._bookmark.title; // fallback display text
            activity.visualElements.description = this._bookmark.extractedDescription; // Fallback description
            activity.visualElements.content = getAdaptiveCard(this._bookmark); // The real content that is visible in the card

            await activity.saveAsync();
            this._session = this._activity.createSession(); // What causes it to start being visible in the timeline

            // Shoulder Tap API, although not able to validate since I can't find an entry point into it
            let requestManager = ua.UserActivityRequestManager.getForCurrentView();
            this._requestEvents = Utilities.addEventListeners(requestManager, {
                userActivityRequested: (args: Utilities.EventObject<ua.UserActivityRequestedEventArgs>) => {
                    args.detail.request.setUserActivity(this._activity);
                }
            });
        }

        public end(): void {
            if (!this._started || !this._activity) {
                return;
            }

            this._requestEvents.cancel();
            this._requestEvents = null;
            this._session.close();
            this._session = null;
            this._activity = null;
            this._started = false;
        }
    }
}