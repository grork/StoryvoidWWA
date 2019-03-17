namespace Codevoid.Storyvoid.Tests {
    function runSpecificTest() {
        const testToRun = (<HTMLInputElement>document.getElementById("specificTestToRun")).value;
        window.location.href = "/tests_mocha.html?fgrep=" + testToRun;
    }

    document.addEventListener("DOMContentLoaded", () => {
        var runSpecificTestButton = document.getElementById("runSpecificTestButton");
        runSpecificTestButton.addEventListener("click", runSpecificTest);

        document.getElementById("specificTestToRun").addEventListener("keydown", (e) => {
            if (e.keyCode !== 13 /* enter */) {
                return;
            }

            runSpecificTest();
        });
    });
}