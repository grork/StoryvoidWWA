// "Default" js file for the tests pages.
// This is needed because Edge does not allow inline script
(function () {
    document.addEventListener("DOMContentLoaded", function () {
        var backButton = document.getElementById("goBackButton");
        backButton.addEventListener("click", function () {
            window.history.back();
        });

        var closeButton = document.getElementById("closeButton");
        closeButton.addEventListener("click", function () {
            window.close();
        });
    });
})();