// "Default" js file for the tests pages.
// This is needed because Edge does not allow inline script
(function () {
    mocha.setup({
        ui: 'bdd',
        timeout: 20000,
        slow: 5000,
    });

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
                window.location.reload();
            });
        }

        mocha.run();
    });
})();