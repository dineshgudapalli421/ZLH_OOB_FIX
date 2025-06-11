sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "com/sap/lh/mr/zlhoobfix/model/formatter",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageBox, formatter, MessageToast) => {
    "use strict";
    var oController, oDataModel;
    return Controller.extend("com.sap.lh.mr.zlhoobfix.controller.OOBFix", {
        formatter: formatter,
        onInit: function () {
            oController = this;
            this.bus = this.getOwnerComponent().getEventBus();
            oDataModel = oController.getOwnerComponent().getModel();
            //oController._modelInit();

            // Get the route pattern match and parameter values
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            
            var sRouteName = oEvent.getParameter("name");
            var oArguments = oEvent.getParameter("arguments");
            oController.sInvoiceNumber = oArguments.invoice;
            oController.sAccountNumber = oArguments.contractAccount;
            oController.Released = oArguments.Release; // oController.Released
            oController._modelInit();
            // oController._getSummaryItems();
            oController._getSummaryItems().then(() => {
                return oController._getServices(oController.sInvoiceNumber, oController.sAccountNumber);
            }).catch((error) => {
                MessageBox.error("Error occurred: " + error.message);
            });
            // oController._getServices(oController.sInvoiceNumber, oController.sAccountNumber);
            // SummaryItemDDSet
        },
        _getSummaryItems: function () {
            return new Promise((resolve, reject) => {
                debugger;
                var oModel = oController.getView().getModel("OOBFixModel");
                var sPath = `/SummaryItemDDSet`;
                oDataModel.read(sPath, {
                    success: (oData) => {
                        if (oData.results.length) {
                            oData.results.forEach(item => {
                                item.IsbEnable = item.FIELD_ID !== "OU" && item.FIELD_ID !== "HS";
                            });
                            oModel.setProperty("/aSummaryItemsList", oData.results);
                            resolve();
                        }
                    },
                    error: (oError) => {
                        MessageBox.error("Failed to fetch summary items.");
                        reject(oError);
                    }
                });
            });
        },
        _modelInit: function () {
            var oModel = new JSONModel({
                oView: {
                },
                BBPPlan: {},
                MISC: [],
                SummCharges: [],
                sLongText: '',
                IsReleased: oController.Released,
                bIsSuppressMail: false,
                aSummaryItemsList: []
            })
            oController.getView().setModel(oModel, "OOBFixModel");
        },
        _getServices: function (sInvNumber, sAccNumber, bIsReload, IsReversed) {
            var sInvoiceNumber = sInvNumber;//
            var sAccountNumber = sAccNumber//'5810959'; //sAccNumber;//
            var oModel = oController.getView().getModel("OOBFixModel");
            var oBinding = oController.getView().getBinding();
            var aSummaryList = oModel.getProperty("/aSummaryItemsList");
            var sPath = `/InvoiceHeaderSet(InvoiceNumber='${sInvoiceNumber}',Vkonto='${sAccountNumber}')`;
            var sUrlParameters = {
                '$expand': "InvoiceItem,MESSAGE,MISCELLANEOUS_CHG"
            }
            oDataModel.read(sPath, {
                urlParameters: sUrlParameters,
                success: function (oData) {
                    if (oData) {

                        var oModel = oController.getView().getModel("OOBFixModel");
                        var Misce = oData.InvoiceItem.results.filter(function (item) {
                            return item.ChargeType === "MISC";
                        });
                        var SummCharges = oData.InvoiceItem.results.filter(function (item) {
                            return item.ChargeType === "SUMM";
                        }).map(function (item) {
                            return { ...item, Editable: false };
                        });

                        SummCharges.forEach(item => {
                            if (item.FieldId === 'HS') {
                                // Find and override the SCREEN_FIELD in aSummaryList
                                aSummaryList.forEach(summaryItem => {
                                    if (summaryItem.FIELD_ID === 'HS') {
                                        summaryItem.SCREEN_FIELD = item.ScreenField;
                                    }
                                });
                            }
                        });
                        oModel.setProperty("/aSummaryList", aSummaryList);
                        oModel.setProperty("/Message", oData.MESSAGE.results);
                        oModel.setProperty("/MISC", Misce);
                        oModel.setProperty("/SummCharges", SummCharges);
                        oModel.setProperty("/BBPPlan", oData.BbpPlan);
                        oModel.setProperty("/sLongText", oData.MsgTxt);
                        oModel.setProperty("/oView/InvoiceNumber", "Invoice# : " + oData.InvoiceNumber);
                        oModel.setProperty("/oView/InvoiceTotal", "Invoice Total(Head) : " + oData.InvoiceTotal);
                        oModel.setProperty("/oView/InvoiceTotalCalc", "Invoice Total(Calc) : " + oData.InvoiceTotalCalc);
                        if (bIsReload) {
                            MessageToast.show("Page is Reloaded Succesfully");
                        }
                        if (IsReversed) {
                            MessageToast.show("Reverse Validation Succesfully");
                        }
                    }
                },
                error: function () {
                    var oMessage;
                    if (oError.responseText.startsWith("<")) {
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(oError.responseText, "text/xml");
                        oMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
                    } else {
                        var oResponseText = oError.responseText;
                        var sParsedResponse = JSON.parse(oResponseText);
                        oMessage = sParsedResponse.error.message.value;
                    }
                    MessageBox.error(oMessage);
                }
            })
        },
        onPressAddSummaryItems: function () {
            var oTable = oController.getView().byId("idTableSummaryItems");
            var oModel = oController.getView().getModel("OOBFixModel");
            var selectedIndex = oTable.getSelectedIndex();
            if (selectedIndex !== -1) {
                var aCurrentItems = oModel.getProperty("/SummCharges");
                var selectedRow = aCurrentItems[selectedIndex];
                var newSequence = parseInt(selectedRow.Sequence) + 1;
                aCurrentItems.forEach((item, index) => {
                    if (index > selectedIndex) {
                        item.Sequence = (parseInt(item.Sequence) + 1).toString();
                    }
                });
                var newRow = {
                    "AddField": false,
                    "ChargeType": "SUMM",
                    "ContractAccountId": "5810959",
                    "Sequence": newSequence.toString(),
                    "Remove": false,
                    "ScreenField": "",
                    "Amount": "0.00"
                };
                aCurrentItems.splice(selectedIndex + 1, 0, newRow);
                oModel.setProperty("/SummCharges", aCurrentItems);
                oTable.getModel().refresh();
            };
            // var aSummaryItemsList = oModel.getProperty("/aSummaryItemsList");
            // var filteredItems = aSummaryItemsList.filter(item => item.FIELD_ID !== "OU" && item.FIELD_ID !== "HS");
            // oModel.setProperty("/aSummaryItemsList", filteredItems);

        },
        onPressRemoveSummaryItems: function () {
            var oTable = oController.getView().byId("idTableSummaryItems");
            var oModel = oController.getView().getModel("OOBFixModel");
            // var aSelectedIndices = oTable.getSelectedIndices();
            var aCurrentItems = oModel.getProperty("/SummCharges");
            var iSelectedIndex = oTable.getSelectedIndex();
            if (iSelectedIndex !== -1) {
                var SectionName = 'Summary Items';
                if (aCurrentItems[iSelectedIndex].FieldId === 'T6') {
                    MessageBox.confirm("Misc. Charges will be Deleted.Proceed ahead to delete?", {
                        onClose: (oAction) => {
                            if (oAction === MessageBox.Action.OK) {
                                oController._fnCreatelog(SectionName, aCurrentItems[iSelectedIndex].FieldId, "Remove", aCurrentItems[iSelectedIndex].ScreenField, aCurrentItems[iSelectedIndex].Amount);
                                aCurrentItems.splice(iSelectedIndex, 1);
                                oModel.setProperty("/MISC", []);
                                aCurrentItems.forEach((item, index) => {
                                    item.Sequence = (index + 1).toString();
                                });
                                oModel.setProperty("/SummCharges", aCurrentItems);
                                oModel.refresh(true);
                            }
                        }
                    });
                } else {
                    oController._fnCreatelog(SectionName, aCurrentItems[iSelectedIndex].FieldId, "Remove", aCurrentItems[iSelectedIndex].ScreenField, aCurrentItems[iSelectedIndex].Amount);
                    aCurrentItems.splice(iSelectedIndex, 1);
                    aCurrentItems.forEach((item, index) => {
                        item.Sequence = (index + 1).toString();
                    });
                    oModel.setProperty("/SummCharges", aCurrentItems);
                    oModel.refresh(true);
                }
            }
        },
        onPressAddMiscellenous: function () {
            var oTable = oController.getView().byId("idMiscChargeTable");
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentItems = oModel.getProperty("/MISC");
            var highestSequence = aCurrentItems.reduce((max, item) => Math.max(max, parseInt(item.Sequence)), 0);
            var newSequence = (highestSequence + 1).toString();

            // Check if the last added item has any values
            var lastItem = aCurrentItems[aCurrentItems.length - 1];
            if (lastItem !== undefined && lastItem.Amount === "0.00" && lastItem.FieldId === "" && lastItem.ScreenField === "") {
                // Do not add a new item if the last item has no values
                return;
            }

            var aItems = {
                "AddField": Boolean(false),
                "FieldId": "",
                "ChargeType": "Misc",
                "ContractAccountId": "5810959",
                "Sequence": newSequence,
                "Remove": Boolean(false),
                "ScreenField": "",
                "Amount": "0.00"
            };
            aCurrentItems.push(aItems);
            oModel.setProperty("/MISC", aCurrentItems);
            oTable.getModel().refresh();
        },
        onPressRemoveMiscellenous: function () {
            var oTable = oController.getView().byId("idMiscChargeTable");
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentItems = oModel.getProperty("/MISC");
            var iSelectedIndex = oTable.getSelectedIndex();
            var SectionName = 'Misc. Charges';
            oController._fnCreatelog(SectionName, aCurrentItems[iSelectedIndex].FieldId, "Remove", aCurrentItems[iSelectedIndex].ScreenField, aCurrentItems[iSelectedIndex].Amount);
            if (iSelectedIndex !== -1) {
                var aCurrentItems = oModel.getProperty("/MISC");
                aCurrentItems.splice(iSelectedIndex, 1);
                oModel.setProperty("/MISC", aCurrentItems);
            }
            oController._fnUpdateTotalMisc(sAmount, "Remove");
            // oController._fnCreatelog(SectionName, aCurrentItem.FieldId, "Added", aCurrentItem.ScreenField, aCurrentItem.Amount);
        },
        onPressRemoveMessage: function () {
            var oTable = oController.getView().byId("idMessageTable");
            var oModel = oController.getView().getModel("OOBFixModel");
            var aMessages = oModel.getProperty("/Message");
            var iSelectedIndex = oTable.getSelectedIndex();
            if (iSelectedIndex !== -1) {
                aMessages.splice(iSelectedIndex, 1);
                oModel.setProperty("/Message", aMessages);
            }
        },
        onChangePrices: function (oEvent) {
            oController._fnReturnNaturalNumber(oEvent);
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("OOBFixModel");
            var SectionName = "Misc. Charges", Action = "Added";
            var sAmount = oEvent.getParameter('value');
            oController._fnUpdateTotalMisc(sAmount, "Add");
            var oSelectedObj = oContext.getObject();
            oController._fnCreatelog(SectionName, oSelectedObj.ContractAccountId, Action, oSelectedObj.ScreenField
                , oSelectedObj.Amount);
        },
        onChangeSummaryPrices: function (oEvent) {
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("OOBFixModel");
            var oSelectedObj = oContext.getObject();
            var SectionName = "Summary Item"
            var oModel = oController.getView().getModel("OOBFixModel");
            var oSelectedObj = oModel.getProperty(oContext.getPath());
            oSelectedObj.Amount = oInput.getValue(); // Update the ScreenField value
            oModel.setProperty(oContext.getPath(), oSelectedObj); // Update the model
            var aCurrentItem = oModel.getProperty(oContext.getPath());
            oController._fnCreatelog(SectionName, aCurrentItem.FieldId, "Added", aCurrentItem.ScreenField, aCurrentItem.Amount);
        },
        _fnUpdateTotalMisc: function (sAmount, sAction) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var aSummCharges = oModel.getProperty("/SummCharges");
            var t6Item = aSummCharges.find(item => item.FieldId === 'T6');
            if (sAction === "Add") {
                if (t6Item) {
                    debugger;
                    t6Item.Amount = (parseFloat(t6Item.Amount) + parseFloat(sAmount)).toFixed(2);
                    if (parseFloat(t6Item.Amount) < 0) {
                        t6Item.Amount = "0.00"; // Set to zero if the amount goes negative
                    }
                } else {
                    var highestSequence = aSummCharges.reduce((max, item) => Math.max(max, parseInt(item.Sequence)), 0);
                    var newSequence = (highestSequence + 1).toString();
                    var secondLastSequence = highestSequence - 2;
                    aSummCharges.splice(secondLastSequence, 0, {
                        "AddField": Boolean(false),
                        "FieldId": "T6",
                        "ChargeType": "SUMM",
                        "ContractAccountId": "",
                        "Sequence": secondLastSequence.toString(),
                        "Remove": Boolean(false),
                        "ScreenField": "Total Miscellaneous Charges",
                        "Amount": sAmount,
                        "Editable": Boolean(false)
                    });
                }
            } else if (sAction === "Remove") {
                if (t6Item) {
                    t6Item.Amount = (parseFloat(t6Item.Amount) - parseFloat(sAmount)).toFixed(2);
                    if (parseFloat(t6Item.Amount) <= 0) {
                        aSummCharges = aSummCharges.filter(item => item.FieldId !== 'T6');
                    }
                }
            }
            aSummCharges.forEach((item, index) => {
                item.Sequence = (index + 1).toString();
            });
            oModel.setProperty("/SummCharges", aSummCharges);
        },
        onChangeMiscCharg: function (oEvent) {
            var oSelect = oEvent.getSource();
            var selectedValue = oSelect.getSelectedKey();
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentMiscItems = oModel.getProperty("/MISC");
            debugger;
            var existingItem = aCurrentMiscItems.find(item => item.FieldId === selectedValue && item !== oModel.getProperty(oSelect.getBindingContext("OOBFixModel").getPath()));
            if (existingItem) {
                MessageBox.error("Selected value is already added to the table. Please select a different value.");
                // Deselect the item in the Select control
                oSelect.setSelectedKey("");
            } else {
                var oSelectedObj = oModel.getProperty(oSelect.getBindingContext("OOBFixModel").getPath());
                oSelectedObj.ScreenField = oSelect.getSelectedItem().getText(); // Update the ScreenField value
                oModel.setProperty(oSelect.getBindingContext("OOBFixModel").getPath(), oSelectedObj); // Update the model
            }
        },
        onChangePropPricesBBPAmnt: function (oEvent) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var oInput = oEvent.getSource();
            var inputValue = oInput.getValue();
            var updatedValue = formatter.ReturnNaturalNumber(inputValue);
            oModel.setProperty("/BBPPlan/BbpAmount", updatedValue);
        },
        onChangePropPricesBBTODate: function (oEvent) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var oInput = oEvent.getSource();
            var inputValue = oInput.getValue();
            var updatedValue = formatter.ReturnNaturalNumber(inputValue);
            oModel.setProperty("/BBPPlan/BbToDate", updatedValue);
        },
        onChangePropPricesActCostDt: function (oEvent) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var oInput = oEvent.getSource();
            var inputValue = oInput.getValue();
            var updatedValue = formatter.ReturnNaturalNumber(inputValue);
            oModel.setProperty("/BBPPlan/ActualCostDt", updatedValue);
        },
        onChangePropPricesBugBal: function (oEvent) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var oInput = oEvent.getSource();
            var inputValue = oInput.getValue();
            var updatedValue = formatter.ReturnNaturalNumber(inputValue);
            oModel.setProperty("/BBPPlan/UnbilBudgetBal", updatedValue);
        },
        _fnReturnNaturalNumber: function (oEvent) {
            var oInput = oEvent.getSource();
            var oModel = oController.getView().getModel("OOBFixModel");
            var sPath = oInput.getBindingContext("OOBFixModel").getPath();
            var sValue = oEvent.getParameter('value');
            var updatedValue = formatter.ReturnNaturalNumber(sValue);
            oInput.setValue(updatedValue);
            oModel.setProperty(sPath + "/Amount", updatedValue);
        },
        _fnCreatelog: function (SectionName, sKey, Action, ItemDescription, Amount, OldAmount) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var logEntry = {
                ID: new Date().getTime(),
                Key: sKey,
                SectionName: SectionName,
                Action: Action,
                ItemDescription: ItemDescription,
                Amount: Amount
            };
            var aLogEntries = oModel.getProperty("/LogEntries") || [];
            var existingEntryIndex = aLogEntries.findIndex(entry => entry.Key === sKey && entry.SectionName === SectionName);
            if (existingEntryIndex !== -1) {
                aLogEntries[existingEntryIndex] = logEntry;
            } else {
                aLogEntries.push(logEntry);
            }
            oModel.setProperty("/LogEntries", aLogEntries);
            var sTextArea = oController.getView().byId("idActionLogLongText");
            var logText = `${SectionName} - ${Action}: ${ItemDescription} - Amount: ${Amount}`;
            if (sTextArea.getValue()) {
                var textAreaValue = sTextArea.getValue();
                if (textAreaValue.includes(logText)) {
                    textAreaValue = textAreaValue.replace(logText, logText);
                } else {
                    textAreaValue += `\n${logText}`;
                }
                sTextArea.setValue(textAreaValue);
            } else {
                sTextArea.setValue(logText);
            }
        },
        onChangeSummaryItem: function (oEvent) {
            // oModel.getProperty("/SummCharges");
            var oSelect = oEvent.getSource();
            var selectedValue = oSelect.getSelectedKey();
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentSummaryItems = oModel.getProperty("/SummCharges");
            debugger;
            var existingItem = aCurrentSummaryItems.find(item => item.FieldId === selectedValue && item !== oModel.getProperty(oSelect.getBindingContext("OOBFixModel").getPath()));
            if (existingItem) {
                MessageBox.error("Selected value is already added to the table. Please select a different value.");
                oSelect.setSelectedKey("");
            } else {
                var oSelectedObj = oModel.getProperty(oSelect.getBindingContext("OOBFixModel").getPath());
                oSelectedObj.ScreenField = oSelect.getSelectedItem().getText(); // Update the ScreenField value
                oModel.setProperty(oSelect.getBindingContext("OOBFixModel").getPath(), oSelectedObj); // Update the model
            }
        },
        onPressValidate: function () {
            oController._fnCreateCall("V");
        },
        onPressSave: function () {
            oController._fnCreateCall("S");
        },
        onPressReverseValidate: function () {
            oController._fnCreateCall("U");
        },
        onPressRealod: function () {
            oController._getServices(oController.sInvoiceNumber, oController.sAccountNumber, true);
        },
        _fnCreateCall: function (sUserAction) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var payload = oController._getPayload(sUserAction);
            var aSummaryList = oModel.getProperty("/aSummaryItemsList");
            oDataModel.create("/InvoiceHeaderSet", payload, {
                success: function (oData) {

                    var Misce = oData.InvoiceItem.results.filter(function (item) {
                        return item.ChargeType === "MISC";
                    });
                    var SummCharges = oData.InvoiceItem.results.filter(function (item) {
                        return item.ChargeType === "SUMM";
                    }).map(function (item) {
                        return { ...item, Editable: false };
                    });

                    SummCharges.forEach(item => {
                        if (item.FieldId === 'HS') {
                            // Find and override the SCREEN_FIELD in aSummaryList
                            aSummaryList.forEach(summaryItem => {
                                if (summaryItem.FIELD_ID === 'HS') {
                                    summaryItem.SCREEN_FIELD = item.ScreenField;
                                }
                            });
                        }
                    });
                    oModel.setProperty("/aSummaryList", aSummaryList);
                    oModel.setProperty("/Message", oData.MESSAGE.results);
                    oModel.setProperty("/MISC", Misce);
                    oModel.setProperty("/SummCharges", SummCharges);
                    oModel.setProperty("/BBPPlan", oData.BbpPlan);
                    // oModel.setProperty("/sLongText", oData.MsgTxt);
                    oModel.setProperty("/oView/InvoiceNumber", "Invoice# : " + oData.InvoiceNumber);
                    oModel.setProperty("/oView/InvoiceTotal", "Invoice Total(Head) : " + oData.InvoiceTotal);
                    oModel.setProperty("/oView/InvoiceTotalCalc", "Invoice Total(Calc) : " + oData.InvoiceTotalCalc);
                    MessageBox.success(oData.MsgTxt
                        , {
                            onClose: function () {
                                if (sUserAction !== 'V' && sUserAction !== 'S') {
                                    oController._getServices(oController.sInvoiceNumber, oController.sAccountNumber, true);
                                }
                            }
                        });
                },
                error: function (oError) {
                    var oMessage;
                    if (oError.responseText.startsWith("<")) {
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(oError.responseText, "text/xml");
                        oMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
                    } else {
                        var oResponseText = oError.responseText;
                        var sParsedResponse = JSON.parse(oResponseText);
                        oMessage = sParsedResponse.error.message.value;
                    }
                    MessageBox.error(oMessage);
                }
            });
        },
        _getPayload: function (sUserAction) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var invoiceItems = oModel.getProperty("/oView/InvoiceItem");
            var messages = oModel.getProperty("/oView/MESSAGE");
            var Misc = oModel.getProperty("/MISC").map(item => ({
                ...item,
                AddField: Boolean(item.AddField)
            }));
            var SummCharges = oModel.getProperty("/SummCharges").map(item => {
                const { Editable, ...rest } = item;
                return {
                    ...rest,
                    AddField: Boolean(rest.AddField)
                };
            });
            debugger;
            const oInvoiceTotal= oController.getView().byId("idInvoiceTotal").getText().split(": ")[1].trim();
            const oInvoiceTotalCalc= oController.getView().byId("idInvoiceTotalCalc").getText().split(": ")[1].trim();
            
            var BBPPlan = oModel.getProperty("/BBPPlan");
            var sLongText = oModel.getProperty("/sLongText");
            var SupressMail = oModel.getProperty("/bIsSuppressMail");
            var payload = {
                InvoiceTotal: oInvoiceTotal,
                InvoiceTotalCalc : oInvoiceTotalCalc,
                Vkonto: oController.sAccountNumber,//"5810959",
                InvoiceNumber: oController.sInvoiceNumber,//oModel.getProperty("/oView/InvoiceNumber").invoiceNumber.split(": ")[1],//"100003395",
                UserAction: sUserAction,
                MsgTxt: sLongText,
                BbpPlan: BBPPlan,
                SupressMail: SupressMail,
                InvoiceItem: { results: Misc.concat(SummCharges) },//invoiceItems,
                MESSAGE: messages
            };
            return payload;
        }
    });
});