#pragma once

namespace Codevoid::Utilities {
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class HiddenApiHelper sealed
    {
    public:
        static void ExtendIntoTitleBar();
        static void DontExtendIntoTitleBar();
    };
}

