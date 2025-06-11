sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/NumberFormat"
],
    function (JSONModel, NumberFormat) {
        "use strict";

        return {
            Dateformate: function () {
                return oModel;
            },
            Currency: function (oValue) {
                var oCurrencyFormat = NumberFormat.getCurrencyInstance({
                    currencyCode: false,
                    minusSign: "-",
                    decimals: 2
                });
                return oCurrencyFormat.format(oValue);
            },
            ReturnNaturalNumber: function (oValue) {
                var numberRegex = /[^\d.-]+/g;
                var sUpdatedValue;
                sUpdatedValue = oValue.replace(numberRegex, '');
                sUpdatedValue = parseFloat(sUpdatedValue).toFixed(2);
                return sUpdatedValue;
            },
            CheckBoxValidation: function (Boolean) {
                debugger;
                return Boolean(true);
            }
        };
    });