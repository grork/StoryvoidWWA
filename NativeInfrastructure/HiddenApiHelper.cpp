#include "pch.h"
#include "HiddenApiHelper.h"

using namespace Codevoid::Utilities;
using namespace Windows::ApplicationModel::Core;

void HiddenApiHelper::ExtendIntoTitleBar()
{
    CoreApplication::GetCurrentView()->TitleBar->ExtendViewIntoTitleBar = true;
}

void HiddenApiHelper::DontExtendIntoTitleBar()
{
    CoreApplication::GetCurrentView()->TitleBar->ExtendViewIntoTitleBar = false;
}

