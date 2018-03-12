#pragma once

namespace Codevoid::Utilities
{
    public delegate void ScriptNotifyHandler(::Platform::String^ payload);

    /// <summary>
    /// Allows a single object to notify across threads with a string payload.
    ///
    /// Primarily this is intended to replace window.external.notify in the case
    /// of a WebView element (x-ms-webview) hosting content loaded from ms-appdata.
    ///
    /// e.g. instead of code calling window.external.notify(data), you would now
    /// use -instance of this class-.notify(data).
    ///
    /// This is needed because for some unclear reason, ms-appdata:// content
    /// can't call window.external.notify... However, we can inject a native
    /// WinRT component...
    /// </summary>
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class WebViewNotifier sealed
    {
    public:
        WebViewNotifier();
        
        /// <summary>
        /// Notify any listeners with the supplied string payload
        /// </summary>
        void Notify(_In_ ::Platform::String^ payload);
        event ScriptNotifyHandler^ MSWebViewScriptNotify;

    private:
        Windows::UI::Core::CoreDispatcher^ _ownersDispatcher;
    };
}
