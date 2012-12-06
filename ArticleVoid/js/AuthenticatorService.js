(function () {
    "use strict";

    var clientID = "Uzf6U3vHqc7vcMUKSj7JpYvungTSjQVEoyfyJtYtHdX6wWQ05J";
    var clientSecret = "z4KurzIZ21NFJgFopHRqObIjNEHe5uFECBzpjQ809oFNbxi0lm";

    var tokenInformationSettingName = "usertokens";
    var tokenSettingName = "token";
    var tokenSecretSettingName = "secret";

    WinJS.Namespace.define("Codevoid.ArticleVoid.Authenticator", {
        _tokenSettingInformation: {
            root: tokenInformationSettingName,
            token: tokenSettingName,
            secret: tokenSecretSettingName,
        },
        getClientInformation: function getClientInformation() {
            var store = Windows.Storage.ApplicationData.current.roamingSettings;
            var tokens = store.values[tokenInformationSettingName];
            
            if (tokens
                && tokens.hasKey(tokenSettingName)
                && tokens.hasKey(tokenSecretSettingName)) {
                return WinJS.Promise.as(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret, tokens[tokenSettingName], tokens[tokenSecretSettingName]));
            }

            var accounts = new Codevoid.ArticleVoid.InstapaperApi.Accounts(new Codevoid.OAuth.ClientInfomation(clientID, clientSecret));

            return accounts.getAccessToken("test@codevoid.net", "TestPassword").then(function (result) {
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
    });
})();