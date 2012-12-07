(function () {
    "use strict";
    var property = Codevoid.Utilities.property;

    var clientID = "PLACEHOLDER";
    var clientSecret = "PLACEHOLDER";

    var tokenInformationSettingName = "usertokens";
    var tokenSettingName = "token";
    var tokenSecretSettingName = "secret";

    WinJS.Namespace.define("Codevoid.ArticleVoid.Authenticator", {
        _tokenSettingInformation: {
            root: tokenInformationSettingName,
            token: tokenSettingName,
            secret: tokenSecretSettingName,
        },
        getClientInformation: function getClientInformation(overrideCredentials) {
            var store = Windows.Storage.ApplicationData.current.roamingSettings;
            var tokens = store.values[tokenInformationSettingName];
            
            if (tokens
                && tokens.hasKey(tokenSettingName)
                && tokens.hasKey(tokenSecretSettingName)) {
                return WinJS.Promise.as(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
            }

            var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret));

            var credentialPromise = WinJS.Promise.as(overrideCredentials);

            if (!overrideCredentials) {
                throw new Error("Credentials need to be supplied currently");
            }

            return credentialPromise.then(function(credentials) {
                return accounts.getAccessToken(credentials.user, credentials.password);
            }).then(function (result) {
                var userTokens = new Windows.Storage.ApplicationDataCompositeValue();
                userTokens[tokenSettingName] = result.oauth_token;
                userTokens[tokenSecretSettingName] = result.oauth_token_secret;
                store.values[tokenInformationSettingName] = userTokens;

                return new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, userTokens[tokenSettingName], userTokens[tokenSecretSettingName]);
            });
        },
        clearClientInformation: function clearClientInformation() {
            var storage = Windows.Storage.ApplicationData.current.roamingSettings;
            storage.values.remove(tokenInformationSettingName);
        },


        AuthenticatorViewModel: WinJS.Class.mix(WinJS.Class.define(function () {
            this._evaluateCanAuthenticate = this._evaluateCanAuthenticate.bind(this);
            this.addEventListener("usernameChanged", this._evaluateCanAuthenticate);
        }, {
            username: property("username", null),
            password: property("password", null),
            canAuthenticate: property("canAuthenticate", false),
            allowPasswordEntry: property("allowPasswordEntry", false),
            _evaluateCanAuthenticate: function () {
                if (this.username && (typeof this.username === "string")) {
                    this.canAuthenticate = true;
                    this.allowPasswordEntry = true;
                } else {
                    this.canAuthenticate = false;
                    this.allowPasswordEntry = false;
                }
            },
        }), WinJS.Utilities.eventMixin),
    });
})();