(function () {
    "use strict";

    WinJS.Namespace.define("Codevoid.UICore", {
        Control: WinJS.Class.define(function (element, options) {
            this.element = element;
            WinJS.UI.setOptions(this, options);
        }, {
            element: null,
        }),
        currentViewType: "unittest",
        getViewForModel: function (model) {
            if (!model.view) {
                throw new Error("Can't get a view for a model that doesn't have a view");
            }

            var view = model.view[Codevoid.UICore.currentViewType];
            if (!view) {
                throw new Error("Can't get view for the current view type");
            }

            var constructor = WinJS.Utilities.getMember(view);
            return constructor;
        },
    });
})();