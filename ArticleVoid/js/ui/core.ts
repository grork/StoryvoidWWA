/// <reference path="..\..\tsc\libs\winjs.d.ts" static="true" />
/// <reference path="..\..\tsc\libs\codevoid.d.ts" static="true" />

module Codevoid.UICore {
    export class Control {
        element: HTMLElement;
        constructor(element: HTMLElement, options: any) {
            this.element = element;
            WinJS.UI.setOptions(this, options);
        }
    }
    export var currentViewType: string = "unittest";
    export function getViewForModel(model: any): any {
        if (!model.view) {
            throw new Error("Can't get a view for a model that doesn't have a view");
        }

        var view: string = model.view[Codevoid.UICore.currentViewType];
        if (!view) {
            throw new Error("Can't get view for current view type");
        }

        var ctor = WinJS.Utilities.getMember(view);
        return ctor;
    }
}