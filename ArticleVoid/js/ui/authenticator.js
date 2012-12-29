(function () {
    "use strict";
    WinJS.Namespace.define("Codevoid.ArticleVoid.UI", {
        Authenticator: Codevoid.Utilities.derive(Codevoid.UICore.Control, function (element, options) {
            element = element || document.createElement("div");
            this.base(element, options);

            Codevoid.Utilities.DOM.loadTemplate("/HtmlTemplates.html", "authenticatorCredentials").then(function (template) {
                return template.render(null, element);
            }).done(function () {
                // Make sure we set the attribute after, since when we render
                // the template on our own element, it'll process the win-control
                // attribute and create two of them. This would be bad, mmmkay?
                if (!element.hasAttribute("data-win-control")) {
                    element.setAttribute("data-win-control", "Codevoid.ArticleVoid.UI.Authenticator");
                }
            });
        }, {
            
        }, {
            showAuthenticator: function () {
                Codevoid.UICore.Experiences.initializeHost(new Codevoid.UICore.WwaExperienceHost(document.body));
                var vm = new Codevoid.ArticleVoid.Authenticator.AuthenticatorViewModel();
                vm.promptForCredentials();
            },
        }),
    });
})();