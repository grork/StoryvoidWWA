#pragma once

namespace Codevoid::Utilities {
    /// <summary>
    /// Exposes APIs to WWAs that are normally hidden or inaccessible to allow
    /// advanced operating system interactions.
    /// </summary>
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class HiddenApiHelper sealed
    {
    public:
        /// <summary>
        /// Extends the rendering area of the application into the titlebar
        /// using the `ExtendViewIntoTitleBar` API (https://docs.microsoft.com/en-us/uwp/api/windows.applicationmodel.core.coreapplicationviewtitlebar.extendviewintotitlebar)
        ///
        /// Given that it is *not* supported for use in WWAs, this comes with
        /// the restriction that you cannot change the traggable element, and
        /// because of this you can't place any interactive elements under the
        /// title bar area -- they won't be clickable.
        /// </summary>
        static void ExtendIntoTitleBar();
        
        /// <summary>
        /// Stops the rendering area from extending in to the title bar. See
        /// `ExtendIntoTitleBar()` for more information.
        /// </summary>
        static void DontExtendIntoTitleBar();

        /// <summary>
        /// Returns if this instance of the application is running as an
        /// internal user. This is performed by checking for a file named
        /// `Internal.user` in the application  directory. This is to help
        /// ensure that when telemetry is sent, it's easy to identify it as
        /// an internal user.
        ///
        /// This was added here, because file existence is an async operation
        /// normally, and we didn't want to have to deal with that in normal
        /// app startup flows. There *is* a C API (`GetFileAttributes`) that
        /// lets you do this in a synchronous way.
        /// </summary>
        static bool IsInternalUser();
    };

    /// <summary>
    /// Helper class to mirror hidden events &amp; properties from the
    /// `CoreApplicationViewTitleBar` API (https://docs.microsoft.com/en-us/uwp/api/Windows.ApplicationModel.Core.CoreApplicationViewTitleBar?view=winrt-19041)
    /// so they can be used from a WWA (They are technically unsupported, and
    /// are hidden by the OS from WWAs)
    /// </summary>
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class TitleBarVisibilityHelper sealed {
    public:
        TitleBarVisibilityHelper();
        virtual ~TitleBarVisibilityHelper();
        bool IsTitleBarVisible();
        event Windows::Foundation::EventHandler<bool>^ TitleBarVisibilityChanged;

    private:
        void OnIsVisibleChanged(Windows::ApplicationModel::Core::CoreApplicationViewTitleBar^ sender, Platform::Object^ args);
        Platform::Agile<Windows::ApplicationModel::Core::CoreApplicationViewTitleBar^> m_titleBar;
        Windows::Foundation::EventRegistrationToken m_eventToken;
    };
}

