(function () {
    "use strict";
    WinJS.Namespace.define("Codevoid.ArticleVoid.UI", {
        Authenticator: Codevoid.Utilities.derive(Codevoid.UICore.Control, function (element, options) {
            this.base(element, options);
            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "authenticatorCredentials").then(function (template) {
                template.render(null, element);
            });
        }, {
            
        }, {
            showAuthenticator: function () {
                var container = document.createElement("div");
                WinJS.Utilities.addClass(container, "dialog");
                var controlElement = document.createElement("div");

                controlElement.setAttribute("data-win-control", "Codevoid.ArticleVoid.UI.Authenticator");

                container.appendChild(controlElement);
                WinJS.UI.processAll(container);

                document.body.appendChild(container);
            },
        }),
    });
})();