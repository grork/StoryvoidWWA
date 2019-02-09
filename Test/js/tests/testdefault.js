// "Default" js file for the tests pages.
// This is needed because Edge does not allow inline script
(function () {
    if (typeof(mocha) !== 'undefined' && typeof(qunit) === 'undefined') {
        // If mocha is available, but not qunit, lets init a qunit style interface for mocha
        mocha.setup({
            ignoreLeaks: false // Warn about global variable issues
        });
    }


    document.addEventListener("DOMContentLoaded", function () {
        let backButton = document.getElementById("goBackButton");
        backButton.addEventListener("click", function () {
            window.history.back();
        });

        let closeButton = document.getElementById("closeButton");
        closeButton.addEventListener("click", function () {
            window.close();
        });

        let runButton = document.getElementById("runButton");
        if (runButton) {
            runButton.addEventListener("click", () => {
                mocha.run();
            });
        }
    });
})();