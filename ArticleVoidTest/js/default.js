// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.ArticleVoid.Tests", {
        runSpecificTest: function runSpecificTest() {
            var testToRun = document.getElementById("specificTestToRun").value;
            window.location.href = "/tests.html?filter=" + testToRun;
        },
    });


    WinJS.Utilities.ready().then(function () {
        var authenticateTestButton = document.getElementById("authenticateButton");
        authenticateTestButton.addEventListener("click", Codevoid.ArticleVoid.UI.Authenticator.showAuthenticator);

        var runSpecificTestButton = document.getElementById("runSpecificTestButton");
        runSpecificTestButton.addEventListener("click", Codevoid.ArticleVoid.Tests.runSpecificTest);
    });
})();