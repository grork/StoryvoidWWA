(function () {
    Codevoid.Utilities.WebViewMessenger_Client.Instance.addHandlerForMessage("gettest", (payload, completion) => {
        completion(42);
    });
})();