(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.UICore", {
        Control: WinJS.Class.define(function (element, options) {
            this.element = element;
            WinJS.UI.setOptions(this, options);
        }, {
            element: null,
        }),
    });
})();