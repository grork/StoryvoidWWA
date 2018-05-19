#include "pch.h"
#include "HiddenApiHelper.h"

using namespace Codevoid::Utilities;
using namespace Windows::ApplicationModel::Core;
using namespace Windows::Foundation;

void HiddenApiHelper::ExtendIntoTitleBar()
{
    CoreApplication::GetCurrentView()->TitleBar->ExtendViewIntoTitleBar = true;
}

void HiddenApiHelper::DontExtendIntoTitleBar()
{
    CoreApplication::GetCurrentView()->TitleBar->ExtendViewIntoTitleBar = false;
}

TitleBarVisibilityHelper::TitleBarVisibilityHelper()
{
    m_titleBar = CoreApplication::GetCurrentView()->TitleBar;
    m_titleBar->IsVisibleChanged += ref new TypedEventHandler<CoreApplicationViewTitleBar^, Object^>(this, &TitleBarVisibilityHelper::OnIsVisibleChanged);
}

TitleBarVisibilityHelper::~TitleBarVisibilityHelper()
{
    if (m_eventToken.Value != 0)
    {
        m_titleBar->IsVisibleChanged -= m_eventToken;
        m_eventToken.Value = 0;
    }
}

bool TitleBarVisibilityHelper::IsTitleBarVisible()
{
    return m_titleBar->IsVisible;
}

void TitleBarVisibilityHelper::OnIsVisibleChanged(CoreApplicationViewTitleBar^ sender, Object^)
{
    this->TitleBarVisibilityChanged(this, sender->IsVisible);
}

