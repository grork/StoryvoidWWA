#include "pch.h"
#include "WebViewNotifier.h"

using namespace CodevoidN::Utilities;
using namespace Platform;
using namespace Windows::UI::Core;

WebViewNotifier::WebViewNotifier()
{
    // Get the dispatcher for the thread that we're constructed on.
    // This is important as it's the place where we'd like the events
    // raised on the otherside of the airlock to actually be handled.
    // E.g. We can't capture the dispatcher at the time we raise the
    // event, because that'll be the dispatcher for the other thread
    this->_ownersDispatcher = CoreWindow::GetForCurrentThread()->Dispatcher;
}

void WebViewNotifier::Notify(_In_ String^ payload)
{
    WeakReference wr(this);

    // Bounce onto the dispatcher we captured earlier.
    this->_ownersDispatcher->RunAsync(CoreDispatcherPriority::Normal, ref new DispatchedHandler([wr, payload]() {
        WebViewNotifier^ self = wr.Resolve<WebViewNotifier>();

        if (self == nullptr)
        {
            return;
        }

        self->MSWebViewScriptNotify(payload);
    }));
}
