#include "pch.h"
#include <objbase.h>
#include "GuidHelper.h"

using namespace Platform;

using namespace Codevoid::Utilities;

String^ GuidHelper::GenerateGuidAsString()
{
    GUID newGuid;
    wchar_t guidAsString[MAX_PATH];
    CoCreateGuid(&newGuid);
    StringFromGUID2(newGuid, guidAsString, ARRAYSIZE(guidAsString));

    return ref new String(guidAsString);
}
