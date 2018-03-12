#pragma once
namespace Codevoid::Utilities {
    [Windows::Foundation::Metadata::AllowForWebAttribute]
    public ref class GuidHelper sealed
    {
    public:
        static Platform::String^ GenerateGuidAsString();
    };
}

