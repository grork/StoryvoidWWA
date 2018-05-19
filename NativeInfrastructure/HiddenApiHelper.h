#pragma once

namespace Codevoid::Utilities {
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class HiddenApiHelper sealed
    {
    public:
        static void ExtendIntoTitleBar();
        static void DontExtendIntoTitleBar();
    };

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

