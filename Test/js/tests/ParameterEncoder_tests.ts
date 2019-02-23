namespace CodevoidTests {
    describe("parameterEncoder", function () {

        it("oneParamEncodes", function oneParamEncodes() {
            const input = [{ key: "a", value: "b" }];
            const encoder = new Codevoid.OAuth.ParameterEncoder();

            const result = encoder.getEncodedStringForData(input);
            assert.strictEqual(result, "a=b", "result was not correctly encoded");
        });

        it("twoParametersEncodeInCorrectOrder", function twoParametersEncodeInCorrectOrder() {
            const input = [
                { key: "b", value: "c%jkt" },
                { key: "a", value: "b" }
            ];
            const encoder = new Codevoid.OAuth.ParameterEncoder();

            const result = encoder.getEncodedStringForData(input);
            assert.strictEqual(result, "a=b&b=c%25jkt", "result was not correctly encoded");
        });

        it("customDelimeterRespected", function customDelimeterRespected() {
            const input = [
                { key: "b", value: "c" },
                { key: "a", value: "b" }
            ];
            const encoder = new Codevoid.OAuth.ParameterEncoder({ delimiter: "," });

            const result = encoder.getEncodedStringForData(input);
            assert.strictEqual(result, "a=b,b=c", "result was not correctly encoded");
        });

        it("valuesAreQuotedWhenOptionSet", function valuesAreQuotedWhenOptionSet() {
            const input = [
                { key: "b", value: "c" },
                { key: "a", value: "b" }
            ];
            const encoder = new Codevoid.OAuth.ParameterEncoder({ shouldQuoteValues: true });

            const result = encoder.getEncodedStringForData(input);
            assert.strictEqual(result, "a=\"b\"&b=\"c\"", "result was not correctly encoded");
        });

        it("rfcEncodesAreCorrectlyEncoded", function rfcEncodesAreCorrectlyEncoded() {
            const input = [{ key: "!'()*", value: "*)('!" }];
            const encoder = new Codevoid.OAuth.ParameterEncoder();

            const result = encoder.getEncodedStringForData(input);
            assert.strictEqual(result, "%21%27%28%29%2A=%2A%29%28%27%21", "result was not correctly encoded");
        });
    });
}