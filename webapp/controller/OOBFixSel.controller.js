sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "com/sap/lh/mr/zlhoobfix/model/formatter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    'sap/ui/model/Sorter',
    'sap/ui/core/Fragment',
    "sap/ui/core/library"
], (Controller, Filter, FilterOperator, formatter, MessageBox, MessageToast, Spreadsheet, Sorter, Fragment, CoreLibrary) => {
    "use strict";
    var oController, oRouter, oDataModel, oBatchId = '', bAllReleased;
    var objSelectedIndex, oSelectedInvoice;
    const SortOrder = CoreLibrary.SortOrder;
    return Controller.extend("com.sap.lh.mr.zlhoobfix.controller.OOBFixSel", {
        formatter: formatter,
        onInit() {
            oController = this;
            oRouter = oController.getOwnerComponent().getRouter();
            oDataModel = oController.getOwnerComponent().getModel();

            //oRouter.attachRouteMatched(this._onRouteMatched, this);
            oDataModel.attachBatchRequestCompleted(function () {
                //debugger;
                var oTable = oController.getView().byId("idTableInvoices");
                var oModel = oController.getView().getModel("SelectionModel");
                var oBinding = oTable.getBinding("rows");
                // var oSorter = new sap.ui.model.Sorter("PRINTDOC", false);
                // oBinding.sort(oSorter);
                var iLength = oBinding.getLength();
                //var oContexts = oBinding.getContexts(0, iLength);
                var aItems = oBinding.getContexts(0, iLength).map(context => context.getObject());
                if (aItems.length === 0) {
                    var oSmartTable = oController.getView().byId("oobSmartTable");
                    oSmartTable.setHeader("OOB Invoices");
                    oModel.setProperty("/bReleaseBatchBtn", false);
                    oModel.setProperty("/bPullListBtn", false);
                }
                else if (aItems.length > 0) {
                    var oSmartTable = oController.getView().byId("oobSmartTable");
                    var oInnerTable = oSmartTable.getTable();
                    var oBinding = oInnerTable.getBinding("items") || oInnerTable.getBinding("rows");
                    if (oBinding) {
                        var iTotalItems = oBinding.getLength();
                        oSmartTable.setHeader("OOB Invoices(" + iTotalItems + ")");
                    }

                    bAllReleased = aItems.every(item => item.Released);
                    var Count = 0, pulllistCount = 0;
                    for (var i = 0; i < aItems.length; i++) {
                        if ((aItems[i].Updated === true && aItems[i].Validated === true) || aItems[i].Reversed === true) {
                            Count = Count + 0;
                        } else {
                            Count = Count + 1;
                        }
                        if (aItems[i].Reversed === true || aItems[i].Released === true) {
                            pulllistCount = pulllistCount + 0;
                        }
                        else {
                            pulllistCount = pulllistCount + 1;
                        }
                    }
                    var oReleaseButton = oController.getView().byId("idReleaseBatchButton");
                    var oPullList = oController.getView().byId("idPullListButton");
                    if (oReleaseButton) {
                        // oModel.setProperty("/bReleaseBatchBtn", ((bAllUpdated && bAllValidated) || bAllReversed));
                        // ******************added on 08-May-2026 by Dinesh ********************
                        if (Count === 0) {
                            oModel.setProperty("/bReleaseBatchBtn", true);
                        } else {
                            oModel.setProperty("/bReleaseBatchBtn", false);
                        }
                        //****************************************** */
                    }
                    if (oPullList) {
                        oController.PulllistCount = pulllistCount;
                        if (pulllistCount === 0) {
                            oModel.setProperty("/bPullListBtn", true);
                        }
                        else {
                            oModel.setProperty("/bPullListBtn", false);
                        }
                        oController._refreshFooter(pulllistCount);
                        //oModel.setProperty("/bPullListBtn", bAllReleased);
                    }
                    if (oSelectedInvoice !== '') {
                        for (var j = 0; j < aItems.length; j++) {
                            var aSelectedInvoice = aItems[j].PRINTDOC;

                            // Change "ColumnPropertyName" to your actual OData/JSON property name
                            if (aSelectedInvoice === oSelectedInvoice) {
                                oTable.setSelectedIndex(j);
                                oTable.setFirstVisibleRow(j);
                            }
                        }
                    } else if (oSelectedInvoice === '') {
                        oTable.clearSelection();
                    }
                }
            });
            oDataModel.attachBatchRequestFailed(function (oError) {
            });

            var oSelectionModel = new sap.ui.model.json.JSONModel({
                sBatchId: '',
                oInvoiceDate: '', //new Date()
                aPullList: [],
                bReleaseBatchBtn: false,
                bPullListBtn: false,
                InputCheck: false
            });
            oController.getView().setModel(oSelectionModel, "SelectionModel");
            oController._mViewSettingsDialogs = {};
            oController._fndefaultBatch();
        },

        onBeforeRebindTable: function (oEvent) {
            //debugger;
            var oSmartTable = this.byId("oobSmartTable");
            var oInnerTable = oSmartTable.getTable();
            if (oSmartTable) {
                oSmartTable.rebindTable(true);
            }
        },
        _restoreSelection: function (oEvent) {
            if (!this._sSelectedKey) {
                return; // Nothing was selected previously
            }

            var oTable = this.getView().byId("idTableInvoices");
            var oBinding = oTable.getBinding("rows");
            var aContexts = oBinding.getContexts(0, oBinding.getLength()); // Get all current contexts

            // Find the new index matching your saved unique key
            var iNewIndex = aContexts.findIndex(function (oContext) {
                return oContext && oContext.getProperty("PRINTDOC") === this._sSelectedKey;
            }.bind(this));

            if (iNewIndex !== -1) {
                // Apply selection to the new correct index position
                oTable.setSelectedIndex(iNewIndex);
            } else {
                oTable.clearSelection(); // Clear if old item no longer exists post-refresh
            }

            // Clear the stored token so it doesn't fire on unexpected data changes
            this._sSelectedKey = null;
        },
        _fndefaultBatch: function () {
            //debugger;
            var oModel = oController.getView().getModel("SelectionModel");
            oDataModel.read("/Default_BatchId", {
                success: function (oData) {
                    oModel.setProperty("/sBatchId", oData.BatchId.trim());
                    //oController.getView().byId("application-ZLH_OOB_FIX-manage-component---OOBFixSel--idBatchIdInput-search").focus();
                    oController.getView().byId("application-ZLH_OOB_FIX-manage-component---OOBFixSel--filterbar-btnGo").firePress();
                },
                error: function (oError) {
                    MessageBox.error("Failed to retrieve Default Batch ID");
                }
            });
        },
        _onRouteMatched: function (oEvent) {
            oController._refreshList();
        },
        onSubmitBatchId: function (oEvent) {
            oSelectedInvoice = '';
            oController._refreshList();
            oController._modelInit();
        },
        onPressNavigate: function () {
            var oTable = this.getView().byId("idTableInvoices");
            var sSelectedIndex = oTable.getSelectedIndex();
            if (sSelectedIndex !== -1) {
                var oBinding = oTable.getBinding("rows");
                var iLength = oBinding.getLength();
                var oContexts = oBinding.getContexts(0, iLength);
                //var oContexts = oTable.getBinding('rows').getContexts();
                var sPath = oContexts[sSelectedIndex].getPath();
                var oData = oContexts[sSelectedIndex].getModel().getProperty(sPath);
                //debugger;
                if (oData.Reversed) {
                    MessageToast.show("Inoivce is already Reversed");
                    return;
                }
                if (oData) {
                    oRouter.navTo("OOBFix", {
                        invoice: oData.PRINTDOC,
                        contractAccount: oData.VKONTO,
                        Release: oData.Released
                    });
                }
            } else {
                MessageToast.show("Please Select Line Item");
            }

        },
        // ******************** Added By Dinesh as on 12-05-2026 ********************
        onRowSelect: function (oEvent) {
            var oTable = this.getView().byId("idTableInvoices");
            var oSelectedIndex = oEvent.getParameter("rowIndex");
            if (oSelectedIndex !== -1) {
                var oBinding = oTable.getBinding("rows");
                var iLength = oBinding.getLength();
                var oContexts = oBinding.getContexts(0, iLength);
                var sPath = oContexts[oSelectedIndex].getPath();
                var oData = oContexts[oSelectedIndex].getModel().getProperty(sPath);

                if (oData.Reversed) {
                    MessageToast.show("Invoice is already Reversed");
                    return;
                }
                if (oData) {
                    oSelectedInvoice = oData.PRINTDOC;
                    // oController._oInvoiceNumber = oData.PRINTDOC;
                    // oController._oAccountNumber = oData.VKONTO;
                    // oController._modelInit();
                    // oController._getSummaryItems().then(() => {
                    //     return oController._getServices(oData.PRINTDOC, oData.VKONTO);
                    // }).catch((error) => {
                    //     MessageBox.error("Error occurred: " + error.message);
                    // });
                }
            }
        },
        onPressNavigate1: function () {
            //debugger;
            var oTable = this.getView().byId("idTableInvoices");
            var sSelectedIndex = oTable.getSelectedIndex();
            if (sSelectedIndex !== -1) {
                var oBinding = oTable.getBinding("rows");
                var iLength = oBinding.getLength();
                var oContexts = oBinding.getContexts(0, iLength);
                //var oContexts = oTable.getBinding('rows').getContexts();
                var sPath = oContexts[sSelectedIndex].getPath();
                var oData = oContexts[sSelectedIndex].getModel().getProperty(sPath);
                //debugger;
                if (oData.Reversed) {
                    MessageToast.show("Invoice is already Reversed");
                    return;
                }
                if (oData) {
                    //debugger;
                    oController._oInvoiceNumber = oData.PRINTDOC;
                    oController._oAccountNumber = oData.VKONTO;
                    oController._modelInit();
                    oController._getSummaryItems().then(() => {
                        return oController._getServices(oData.PRINTDOC, oData.VKONTO);
                    }).catch((error) => {
                        MessageBox.error("Error occurred: " + error.message);
                    });
                    // oRouter.navTo("OOBFix", {
                    //     invoice: oData.PRINTDOC,
                    //     contractAccount: oData.VKONTO,
                    //     Release: oData.Released
                    // });
                }
            } else {
                MessageToast.show("Please Select Line Item");
            }

        },
        _modelInit: function () {
            var oModel = new sap.ui.model.json.JSONModel({
                oView: {
                },
                BBPPlan: {},
                MISC: [],
                SummCharges: [],
                sLongText: '',
                IsReleased: !bAllReleased,//oController.Released,
                bIsSuppressMail: false,
                aSummaryItemsList: []
            })
            oController.getView().setModel(oModel, "OOBFixModel");
        },
        _getSummaryItems: function () {
            return new Promise((resolve, reject) => {
                //debugger;
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
        _getServices: function (sInvNumber, sAccNumber, bIsReload, IsReversed) {
            //debugger;
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
                            return item.ChargeType === "Misc";
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
                        oModel.setProperty("/oView/ContractAccount", "Contract Account : " + sAccountNumber);
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
        },
        onPressRemoveSummaryItems: function () {
            var oTable = oController.getView().byId("idTableSummaryItems");
            var oModel = oController.getView().getModel("OOBFixModel");
            // var aSelectedIndices = oTable.getSelectedIndices();
            var aCurrentItems = oModel.getProperty("/SummCharges");
            var iSelectedIndex = oTable.getSelectedIndex();
            if (iSelectedIndex !== -1) {
                var SectionName = 'Summary Item';
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
        _fnUpdateTotalMisc: function (sAmount, sAction) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var aSummCharges = oModel.getProperty("/SummCharges");
            var t6Item = aSummCharges.find(item => item.FieldId === 'T6');
            if (sAction === "Add") {
                if (t6Item) {
                    //debugger;
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
        _fngetIsReleased: function () {
            //debugger;
            this._sSelectedKey = null;
            var oTable = this.getView().byId("idTableInvoices");
            var sSelectedIndex = oTable.getSelectedIndex();
            if (sSelectedIndex === -1) {
                // return MessageBox.error("Please select any one of the row and proceed...");
                return "Please select any one of the row and proceed...";
            }
            if (sSelectedIndex !== -1) {
                var oContext = oTable.getContextByIndex(sSelectedIndex);
                if (oContext) {
                    // Replace 'ID' with your model's actual unique identifier field
                    this._sSelectedKey = oContext.getProperty("PRINTDOC");
                }
                objSelectedIndex = sSelectedIndex;
                oSelectedInvoice = oTable.getContextByIndex(sSelectedIndex).getProperty("PRINTDOC");
                var oBinding = oTable.getBinding("rows");
                var iLength = oBinding.getLength();
                var oContexts = oBinding.getContexts(0, iLength);
                //var oContexts = oTable.getBinding('rows').getContexts();
                var sPath = oContexts[sSelectedIndex].getPath();
                var oData = oContexts[sSelectedIndex].getModel().getProperty(sPath);
                //debugger;
                if (oData.Reversed || oData.Released) {
                    // return MessageBox.error("Invoice is already Reversed or Released");
                    return "Invoice is already Reversed or Released";
                }
                else {
                    return "";
                }
            } else {
                return "";
            }
        },
        _fngetSelectedInvoice: function () {
            //debugger;
            var oTable = this.getView().byId("idTableInvoices");
            var oBinding = oTable.getBinding("rows").aLastContexts;
            var iLength = oBinding.length;
            //var oContexts = oBinding.getContexts(0, iLength);
            for (var i = 0; i < oBinding.length; i++) {
                var oRowData = oBinding[i].sPath

                // Change "ColumnPropertyName" to your actual OData/JSON property name
                if (oRowData.includes(oSelectedInvoice)) {
                    oTable.setSelectedIndex(i);
                    oTable.setFirstVisibleRow(i);
                    //oTable.scrollToIndex(i); // Optional: Scroll to it
                    //break;
                }
            }
        },
        onPressValidate: function () {
            //debugger;
            var oMessage = oController._fngetIsReleased();
            if (oMessage === '') {
                oController._fnCreateCall("V");
            }
            else if (oMessage !== '') {
                MessageBox.error(oMessage);
            }
            // oController._refreshList();
            //oController._fngetSelectedInvoice();
            // var oTable = this.getView().byId("idTableInvoices");
            // oTable.setSelectedIndex(objSelectedIndex);
            // oTable.setFirstVisibleRow(objSelectedIndex);
        },
        onPressSave: function () {
            var oMessage = oController._fngetIsReleased();
            if (oMessage === '') {
                oController._fnCreateCall("S");
            }
            else if (oMessage !== '') {
                MessageBox.error(oMessage);
            }
            // oController._fngetIsReleased();
            // oController._fnCreateCall("S");
            // oController._refreshList();
            //oController._fngetSelectedInvoice();
            // var oTable = this.getView().byId("idTableInvoices");
            // oTable.setSelectedIndex(objSelectedIndex);
            // oTable.setFirstVisibleRow(objSelectedIndex);            
        },
        onPressReverseValidate: function () {
            var oMessage = oController._fngetIsReleased();
            if (oMessage === '') {
                oController._fnCreateCall("U");
            }
            else if (oMessage !== '') {
                MessageBox.error(oMessage);
            }
            // oController._fngetIsReleased();
            // oController._fnCreateCall("U");
            // oController._refreshList();

        },
        onPressRealod: function () {
            oController._fngetIsReleased();
            oController._getServices(oController._oInvoiceNumber, oController._oAccountNumber, true);
        },
        _fnCreateCall: function (sUserAction) {
            var oModel = oController.getView().getModel("OOBFixModel");
            if (oController.getView().byId("idSelInvoiceTotal").getText() === '') {
                return MessageBox.error("Please select row and proceed...");
            }
            if (oController._oInvoiceNumber !== oSelectedInvoice) {
                return MessageBox.error("Selected Row and below proceed Invoice are different");
            }
            var payload = oController._getPayload(sUserAction);
            var aSummaryList = oModel.getProperty("/aSummaryItemsList");
            oDataModel.create("/InvoiceHeaderSet", payload, {
                success: function (oData) {

                    var Misce = oData.InvoiceItem.results.filter(function (item) {
                        return item.ChargeType === "Misc";
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
                    oModel.setProperty("/oView/ContractAccount", "Contract Account : " + oController._oAccountNumber);
                    oModel.setProperty("/oView/InvoiceNumber", "Invoice# : " + oData.InvoiceNumber);
                    oModel.setProperty("/oView/InvoiceTotal", "Invoice Total(Head) : " + oData.InvoiceTotal);
                    oModel.setProperty("/oView/InvoiceTotalCalc", "Invoice Total(Calc) : " + oData.InvoiceTotalCalc);

                    //debugger;
                    MessageBox.success(oData.MsgTxt
                        , {
                            onClose: function () {
                                oController._refreshList();
                                oController._fngetSelectedInvoice();
                                if (sUserAction !== 'V' && sUserAction !== 'S') {
                                    oController._getServices(oController._oInvoiceNumber, oController._oAccountNumber, true);
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
            //debugger;
            var oModel = oController.getView().getModel("OOBFixModel");
            var invoiceItems = oModel.getProperty("/oView/InvoiceItem");
            var messages = oModel.getProperty("/oView/MESSAGE");
            var Misc = oModel.getProperty("/MISC").map(item => ({
                ...item,
                AddField: Boolean(item.AddField)
            }));
            var SummCharges = oModel.getProperty("/SummCharges").map(item => {
                item.Amount = item.Amount === '' ? '0.00' : parseFloat(item.Amount).toString();

                const { Editable, ...rest } = item;
                return {
                    ...rest,
                    AddField: Boolean(rest.AddField)
                };
            });

            const oInvoiceTotal = oController.getView().byId("idSelInvoiceTotal").getText().split(": ")[1].trim();
            const oInvoiceTotalCalc = oController.getView().byId("idSelInvoiceTotalCalc").getText().split(": ")[1].trim();

            var BBPPlan = oModel.getProperty("/BBPPlan");
            var sLongText = oModel.getProperty("/sLongText");
            var SupressMail = oModel.getProperty("/bIsSuppressMail");
            var payload = {
                InvoiceTotal: oInvoiceTotal,
                InvoiceTotalCalc: oInvoiceTotalCalc,
                Vkonto: oController._oAccountNumber,//"5810959",
                InvoiceNumber: oController._oInvoiceNumber,//oModel.getProperty("/oView/InvoiceNumber").invoiceNumber.split(": ")[1],//"100003395",
                UserAction: sUserAction,
                MsgTxt: sLongText,
                BbpPlan: BBPPlan,
                SupressMail: SupressMail,
                InvoiceItem: { results: Misc.concat(SummCharges) },//invoiceItems,
                MESSAGE: messages
            };
            return payload;
        },
        onChangeMiscCharg: function (oEvent) {
            var oSelect = oEvent.getSource();
            var selectedValue = oSelect.getSelectedKey();
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentMiscItems = oModel.getProperty("/MISC");
            //debugger;
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
        _fnReturnNaturalNumber: function (oEvent) {
            var oInput = oEvent.getSource();
            var oModel = oController.getView().getModel("OOBFixModel");
            var sPath = oInput.getBindingContext("OOBFixModel").getPath();
            var sValue = oEvent.getParameter('value');
            var updatedValue = formatter.ReturnNaturalNumber(sValue);
            oInput.setValue(updatedValue);
            oModel.setProperty(sPath + "/Amount", updatedValue);
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
        onChangeSummaryItem: function (oEvent) {
            // oModel.getProperty("/SummCharges");
            var oSelect = oEvent.getSource();
            var selectedValue = oSelect.getSelectedKey();
            var oModel = oController.getView().getModel("OOBFixModel");
            var aCurrentSummaryItems = oModel.getProperty("/SummCharges");
            //debugger;
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
        //************************************************** */
        onSubmitBatchUpdate: function () {

        },
        onReleaseBatch: function (sInvNumber, sAccNumber) {
            var oModel = oController.getView().getModel("OOBFixModel");
            var oTable = this.getView().byId("idTableInvoices");
            var oBinding = oTable.getBinding("rows");
            var iLength = oBinding.getLength();
            var oContexts = oBinding.getContexts(0, iLength);
            //var oContexts = oTable.getBinding('rows').getContexts();
            if (oContexts.length > 0) {
                var sPath = oContexts[0].getPath();
                var oData = oContexts[0].getModel().getProperty(sPath);
                if (oData.Released) {
                    MessageToast.show("Batch is already Released");
                    return;
                }
                // Display BatchId information before proceeding
                var sBatchId = oBatchId;// oData.BatchId;
                MessageBox.confirm("Batch ID: " + sBatchId + "\nDo you want to proceed with the release?", {
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            var sUrl = "/GetFixInvData?BatchId=" + sBatchId;
                            oDataModel.callFunction("/GetFixInvData",
                                {
                                    method: "GET",
                                    urlParameters: { "BatchId": sBatchId },
                                    success: function (oData, response) {
                                        MessageToast.show("Batch released successfully");
                                        oModel.setProperty("/IsReleased", false);
                                        oController._refreshList();
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
                        }
                    }
                });
            }
        },

        _onPullList: function () {
            var oSelectionModel = oController.getView().getModel("SelectionModel");
            var sDate = oSelectionModel.getProperty("/oInvoiceDate");
            var sBatchID = oSelectionModel.getProperty("/sBatchId");

            if (sBatchID) {
                oDataModel.read("/Pull_listSet", {
                    filters: [new Filter("BatchId", FilterOperator.EQ, sBatchID)],
                    success: function (oData) {
                        oController.getView().getModel("SelectionModel").setProperty("/oBatchId", sBatchID);
                        oController.getView().getModel("SelectionModel").setProperty("/aPullList", oData.results);
                        oController._fnOpenPullList();
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
            }

            // if (oContexts.length > 0) {
            //     var sPath = oContexts[0].getPath();
            //     var oData = oContexts[0].getModel().getProperty(sPath);

            //     // Display BatchId information before proceeding
            //     // var sBatchId = oData.BatchId;
            //     var sBatchID = oData.BatchId;//'15'; //oData.BatchId //
            //     oDataModel.read("/Pull_listSet", {
            //         filters: [new Filter("BatchId", FilterOperator.EQ, sBatchID)],
            //         success: function (oData) {
            //             oController.getView().getModel("SelectionModel").setProperty("/aPullList", oData.results);
            //             oController._fnOpenPullList();
            //         },
            //         error: function (oError) {
            //             var oMessage;
            //             if (oError.responseText.startsWith("<")) {
            //                 var parser = new DOMParser();
            //                 var xmlDoc = parser.parseFromString(oError.responseText, "text/xml");
            //                 oMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
            //             } else {
            //                 var oResponseText = oError.responseText;
            //                 var sParsedResponse = JSON.parse(oResponseText);
            //                 oMessage = sParsedResponse.error.message.value;
            //             }
            //             MessageBox.error(oMessage);
            //         }
            //     });
            // }
        },
        _fnOpenPullList: function () {
            var oView = this.getView();
            if (!oController.oPullListDialog) {
                oController.oPullListDialog = sap.ui.xmlfragment(oView.getId(), "com.sap.lh.mr.zlhoobfix.fragment.PullList", this);
                oView.addDependent(oController.oPullListDialog);
            }
            oController.oPullListDialog.open();
        },
        onClosePullList: function () {
            oController.oPullListDialog.close();
        },
        onSubmitPullList: function () {
            //debugger;
            var oModel = oController.getView().getModel("SelectionModel")
            var aPullList = oModel.getProperty("/aPullList");
            var sBatchId = oModel.getProperty("/sBatchId");
            // var myArray = [/* your array containing pull_listSet objects */];
            var oPayload = {};
            // var oPayload = {
            //     "BatchId": sBatchId,//"42_UR",
            //     "Pull_listSet": aPullList.map(item => ({
            //         "BatchId": sBatchId,//item.BatchId,
            //         "InputCheck": item.InputCheck,
            //         "InvoiceNo": item.InvoiceNo,
            //         "ContractAcc": item.ContractAcc
            //     }))
            // };
            if (aPullList.length > 0) {
                oPayload = {
                    "BatchId": sBatchId,
                    "Pull_listSet": aPullList.map(item => ({
                        "BatchId": sBatchId,//item.BatchId,
                        "InputCheck": item.InputCheck,
                        "InvoiceNo": item.InvoiceNo,
                        "ContractAcc": item.ContractAcc
                    }))
                };
            } else {
                oPayload = {
                    "BatchId": sBatchId,
                    "Pull_listSet": [{
                        "BatchId": sBatchId,//item.BatchId,
                        "InputCheck": false,
                        "InvoiceNo": '',
                        "ContractAcc": ''
                    }]
                };
            }
            oDataModel.create("/Dummy_pull_list_mailSet", oPayload, {
                success: function (oData) {
                    // Handle success response
                    MessageBox.success(oData.MSG_TXT);
                    oController.oPullListDialog.close();
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
            // oController._refreshList();
        },
        onSearch: function () {
            //debugger;
            oSelectedInvoice = '';
            var oBatchIdInput = this.getView().byId("idBatchIdInput");
            var oDateInput = this.getView().byId("idDateInput");
            if (!oBatchIdInput.getValue() && !oDateInput.getValue()) {
                MessageBox.error("Please enter Batch ID or Date");
            }
            oBatchId = oBatchIdInput.getValue();
            oController._refreshList();
            oController._modelInit();
            //oController._refreshFooter();           
        },
        _refreshFooter: function (Count) {
            //var oReleased = oController._fngetIsReleased();
            var oIdValidate = oController.getView().byId("idValidate");
            var oIdSave = oController.getView().byId("idSave");
            var oIdReload = oController.getView().byId("idReload");
            var oIdRevrseValidate = oController.getView().byId("idReverseValidate");
            if (Count === 0) {
                oIdValidate.setEnabled(false);
                oIdSave.setEnabled(false);
                oIdReload.setEnabled(false);
                oIdRevrseValidate.setEnabled(false);
            } else if (Count > 0) {
                oIdValidate.setEnabled(true);
                oIdSave.setEnabled(true);
                oIdReload.setEnabled(true);
                oIdRevrseValidate.setEnabled(true);
            }
        },
        _refreshList: function () {
            //debugger;
            var oSelectionModel = oController.getView().getModel("SelectionModel");
            var sDate = oSelectionModel.getProperty("/oInvoiceDate");
            var sBatchId = oSelectionModel.getProperty("/sBatchId");
            var oTable = this.getView().byId("idTableInvoices");
            //oTable.clearSelection();
            var oBinding = oTable.getBinding();
            var oFilter = [];
            var Dateformatter = (oMyDate) => {
                var oData;
                var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd"
                });
                oData = dateFormat.format(new Date(oMyDate), true);
                return oData = oData; //+ "T00:00:00";
            }

            if (sBatchId) {
                oBatchId = sBatchId;
                oFilter.push(new Filter("BatchId", FilterOperator.EQ, sBatchId));
            }
            if (sDate) {
                // var formattedDate = new Date(sDate).toISOString().split('T')[0] + "T00:00:00";
                oFilter.push(new Filter("PRINT_DATE", FilterOperator.EQ, Dateformatter(sDate)));
            }
            oBinding.filter(oFilter);
            oBinding.refresh(true);
            // var oSorter = new sap.ui.model.Sorter("PRINTDOC", false);
            // oBinding.sort(oSorter);
        },
        oInvoiceLinkPress: function (oEvent) {
            var oSource = oEvent.getSource();
            let oInvoiceNo = oSource.getText();
            if (oInvoiceNo) {
                var navigationService = sap.ushell.Container.getService("CrossApplicationNavigation");
                var hash = (navigationService && navigationService.hrefForExternal({
                    target: { semanticObject: "UtilitiesInvoicingDocument", action: "display" },
                    params: {
                        "erdk-opbel": oInvoiceNo,
                        "sap-app-origin-hint": '',
                        "sap-ui-tech-hint": "GUI",
                        "sap-ushell-navmode": "inplace"
                    }
                })) || "";

                var url = window.location.href.split('#')[0] + hash;
                // 3. Open in new tab
                sap.m.URLHelper.redirect(url, true);
            }
        },
        oContractAccountLinkPress: function (oEvent) {
            //debugger;
            var oSource = oEvent.getSource();
            let oContractAccount = oSource.getText();
            if (oContractAccount) {
                var navigationService = sap.ushell.Container.getService("CrossApplicationNavigation");
                var hash = (navigationService && navigationService.hrefForExternal({
                    target: { semanticObject: "ContractAccount", action: "display" },
                    params: {
                        "FKKVKP-VKONT": oContractAccount,
                        "sap-app-origin-hint": '',
                        "sap-ui-tech-hint": "GUI",
                        "sap-ushell-navmode": "inplace"
                    }
                })) || "";

                var url = window.location.href.split('#')[0] + hash;
                // 3. Open in new tab
                sap.m.URLHelper.redirect(url, true);
            }
        },
        onExport: function (oEvent) {
            //debugger;
            var oTable = this.getView().byId("idTableInvoices");
            var oRowBinding = oTable.getBinding("rows");
            var aColumns = oTable.getColumns();
            var aContexts = oRowBinding.getContexts(0, oRowBinding.getLength());
            var oLocalData = aContexts.map(function (oContext) {
                //debugger;
                var oRowData = Object.assign({}, oContext.getObject());
                oRowData.Updated = (oRowData.Updated === true || oRowData.Updated === 'true') ? 'X' : '';
                oRowData.Validated = (oRowData.Validated === true || oRowData.Validated === 'true') ? 'X' : '';
                oRowData.Reversed = (oRowData.Reversed === true || oRowData.Reversed === 'true') ? 'X' : '';
                oRowData.Released = (oRowData.Released === true || oRowData.Released === 'true') ? 'X' : '';
                return oRowData;
            });
            // 1. Define Column Configuration
            var aExportConfig = aColumns.map(function (oColumn) {
                var sLabel = oColumn.getLabel().getText();
                var sPath = "";

                // Get the binding path from the template (Text or Input)
                var oTemplate = oColumn.getTemplate();
                if (oTemplate && oTemplate.getBindingPath("text")) {
                    sPath = oTemplate.getBindingPath("text");
                }
                if (sLabel === 'Update' || sLabel === 'Validated' || sLabel === 'Reversed' || sLabel === 'Released') {
                    sPath = sLabel === 'Update' ? 'Updated' : sLabel;
                    return {
                        label: sLabel,
                        property: sPath,
                        type: "String"
                    };
                }
                else if (sLabel === 'Print dt') {
                    return {
                        label: sLabel,
                        property: sPath,
                        type: "Date" // or Date, Number, Boolean, etc.
                    };
                }
                else {
                    return {
                        label: sLabel,
                        property: sPath,
                        type: "String" // or Date, Number, Boolean, etc.
                    };
                }
            });

            // 2. Configure Settings
            var oSettings = {
                workbook: { columns: aExportConfig, sheetName: "Invoices" },
                dataSource: oLocalData, //oRowBinding, // Uses table's binding (supports filtering/sorting)
                fileName: "OOBInvoices.xlsx"
            };

            // 3. Trigger Download
            var oSpreadsheet = new Spreadsheet(oSettings);
            oSpreadsheet.build();
        },
        handleSortButtonPressed: function () {
            oController.getViewSettingsDialog("com.sap.lh.mr.zlhoobfix.fragment.Filters.SortDialog")
                .then(function (oViewSettingsDialog) {
                    oViewSettingsDialog.open();
                });
        },
        getViewSettingsDialog: function (sDialogFragmentName) {
            //debugger;
            var pDialog = oController._mViewSettingsDialogs[sDialogFragmentName];

            if (!pDialog) {
                pDialog = Fragment.load({
                    id: oController.getView().getId(),
                    name: sDialogFragmentName,
                    controller: oController
                }).then(function (oDialog) {
                    // if (Device.system.desktop) {
                    //   oDialog.addStyleClass("sapUiSizeCompact");
                    // }
                    return oDialog;
                });
                oController._mViewSettingsDialogs[sDialogFragmentName] = pDialog;
            }
            return pDialog;
        },
        handleSortDialogConfirm: function (oEvent) {
            //debugger;
            var oTable = oController.getView().byId("idTableInvoices"),
                mParams = oEvent.getParameters(),
                oBinding = oTable.getBinding("rows"),
                sPath,
                bDescending,
                aSorters = [];

            sPath = mParams.sortItem.getKey();
            bDescending = mParams.sortDescending;
            aSorters.push(new Sorter(sPath, bDescending));
            oBinding.sort(aSorters);
        },
        sortInvoices: function (oEvent) {
            const oView = this.getView();
            const oTable = oView.byId("idTableInvoices");
            const oInvoiceColumn = oView.byId("idInvoice");

            oTable.sort(oInvoiceColumn, this._bSortColumnDescending ? SortOrder.Descending : SortOrder.Ascending, /*extend existing sorting*/true);
            this._bSortColumnDescending = !this._bSortColumnDescending;
        },
        onSortTable: function (oEvent) {
            //debugger;
            var oColumn = oEvent.getParameter("column");
            var sSortProperty = oColumn.getSortProperty();
            var sSortOrder = oEvent.getParameter("sortOrder");
            if (sSortOrder === "Ascending") {

            }
        }
    });
});