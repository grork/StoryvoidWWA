(function () {
    "use strict";

    QUnit.module("parameterEncoder");

    QUnit.test("oneParamEncodes", function oneParamEncodes(assert) {
        var input = [{ key: "a", value: "b" }];
        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);


        assert.strictEqual(result, "a=b", "result was not correctly encoded");
    });

    QUnit.test("twoParametersEncodeInCorrectOrder", function twoParametersEncodeInCorrectOrder(assert) {
        var input = [{ key: "b", value: "c%jkt" },
        { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);
        assert.strictEqual(result, "a=b&b=c%25jkt", "result was not correctly encoded");
    });

    QUnit.test("customDelimeterRespected", function customDelimeterRespected(assert) {
        var input = [{ key: "b", value: "c" },
        { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder({ delimeter: "," });

        var result = encoder.getEncodedStringForData(input);
        assert.strictEqual(result, "a=b,b=c", "result was not correctly encoded");
    });

    QUnit.test("valuesAreQuotedWhenOptionSet", function valuesAreQuotedWhenOptionSet(assert) {
        var input = [{ key: "b", value: "c" },
        { key: "a", value: "b" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder({ shouldQuoteValues: true });

        var result = encoder.getEncodedStringForData(input);
        assert.strictEqual(result, "a=\"b\"&b=\"c\"", "result was not correctly encoded");
    });

    QUnit.test("rfcEncodesAreCorrectlyEncoded", function rfcEncodesAreCorrectlyEncoded(assert) {
        var input = [{ key: "!'()*", value: "*)('!" }];

        var encoder = new Codevoid.OAuth.ParameterEncoder();

        var result = encoder.getEncodedStringForData(input);
        assert.strictEqual(result, "%21%27%28%29%2A=%2A%29%28%27%21", "result was not correctly encoded");
    });
})();