// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.Storyvoid.Tests", {
        runSpecificTest: function runSpecificTest() {
            var testToRun = document.getElementById("specificTestToRun").value;
            window.location.href = "/tests.html?filter=" + testToRun;
        },
    });


    WinJS.Utilities.ready().then(function () {
        Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));
        var authenticateTestButton = document.getElementById("authenticateButton");
        authenticateTestButton.addEventListener("click", Codevoid.Storyvoid.UI.Authenticator.showAuthenticator);

        var runSpecificTestButton = document.getElementById("runSpecificTestButton");
        runSpecificTestButton.addEventListener("click", Codevoid.Storyvoid.Tests.runSpecificTest);
    });
})();