module Codevoid.ArticleVoid {
    export class App {
        constructor() {
        }

        public initialize(): void {
            WinJS.Utilities.ready().done(() => {
                console.log("Done");
            });
        }
    }

    var app = (<any>window).__appObject = new App();
    app.initialize();
}