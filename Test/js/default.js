// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.Storyvoid.Tests", {
        runSpecificTest: function runSpecificTest() {
            var testToRun = document.getElementById("specificTestToRun").value;
            window.location.href = "/tests_mocha.html?fgrep=" + testToRun;
        },
    });


    WinJS.Utilities.ready().then(function () {
        var runSpecificTestButton = document.getElementById("runSpecificTestButton");
        runSpecificTestButton.addEventListener("click", Codevoid.Storyvoid.Tests.runSpecificTest);

        document.getElementById("specificTestToRun").addEventListener("keydown", function (e) {
            if (e.keyCode !== 13 /* enter */) {
                return;
            }

            Codevoid.Storyvoid.Tests.runSpecificTest();
        });
    });
})();