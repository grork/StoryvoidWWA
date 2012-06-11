(function () {
    "use strict";

    function oneParamEncodes() {
        var input = [{ key: "a", value: "b" }];
        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);

        
        strictEqual(result, "a=b", "result was not correctly encoded");
    }

    function twoParametersEncodeInCorrectOrder() {
        var input = [{ key: "b", value: "c%jkt" },
                     { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);
        strictEqual(result, "a=b&b=c%25jkt", "result was not correctly encoded");
    }

    function customDelimeterRespected() {
        var input = [{ key: "b", value: "c" },
                     { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder({ delimeter: "," });

        var result = encoder.getEncodedStringForData(input);
        strictEqual(result, "a=b,b=c", "result was not correctly encoded");
    }

    function valuesAreQuotedWhenOptionSet() {
        var input = [{ key: "b", value: "c" },
                     { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder({ shouldQuoteValues: true });

        var result = encoder.getEncodedStringForData(input);
        strictEqual(result, "a=\"b\"&b=\"c\"", "result was not correctly encoded");
    }

    function rfcEncodesAreCorrectlyEncoded() {
        var input = [{ key: "!'()*", value: "*)('!" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);
        strictEqual(result, "%21%27%28%29%2A=%2A%29%28%27%21", "result was not correctly encoded");
    }
    module("parameterEncoder");
    test("oneParamEncodes", oneParamEncodes);
    test("twoParametersEncodeInCorrectOrder", twoParametersEncodeInCorrectOrder);
    test("customDelimeterRespected", customDelimeterRespected);
    test("valuesAreQuotedWhenOptionSet", valuesAreQuotedWhenOptionSet);
    test("rfcEncodesAreCorrectlyEncoded", rfcEncodesAreCorrectlyEncoded);
})();