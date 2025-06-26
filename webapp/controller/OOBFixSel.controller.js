sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "com/sap/lh/mr/zlhoobfix/model/formatter",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, Filter, FilterOperator, formatter, MessageBox, MessageToast) => {
    "use strict";
    var oController, oRouter, oDataModel;
    return Controller.extend("com.sap.lh.mr.zlhoobfix.controller.OOBFixSel", {
        formatter: formatter,
        onInit() {
            debugger;
            oController = this;
            oRouter = oController.getOwnerComponent().getRouter();
            oDataModel = oController.getOwnerComponent().getModel();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
            oDataModel.attachBatchRequestCompleted(function () {
                var oTable = oController.getView().byId("idTableInvoices");
                var oModel = oController.getView().getModel("SelectionModel");
                var oBinding = oTable.getBinding("rows");
                var aItems = oBinding.getContexts().map(context => context.getObject());
                var bAllUpdated = aItems.every(item => item.Updated);
                var bAllValidated = aItems.every(item => item.Validated);
                var bAllReversed = aItems.every(item => item.Reversed);
                var bAllReleased = aItems.every(item => item.Released);
                var oReleaseButton = oController.getView().byId("idReleaseBatchButton");
                var oPullList = oController.getView().byId("idPullListButton");
                if (oReleaseButton) {
                    // if((bAllUpdated && bAllValidated) || bAllReversed)
                    // {
                    //     oModel.setProperty("/bReleaseBatchBtn", true);
                    // }
                    // else{
                    //     oModel.setProperty("/bReleaseBatchBtn", false);
                    // }
                    oModel.setProperty("/bReleaseBatchBtn", ((bAllUpdated && bAllValidated) || bAllReversed));
                    //.setProperty("/bReleaseBatchBtn", !bAllReleased);
                }

                if (oPullList) {
                    oModel.setProperty("/bPullListBtn", bAllReleased);
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
            oController._fndefaultBatch();
        },
        _fndefaultBatch: function () {
            var oModel = oController.getView().getModel("SelectionModel");
            oDataModel.read("/Default_BatchId", {
                success: function (oData) {
                    oModel.setProperty("/sBatchId", oData.BatchId.trim());
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
            var oTable = this.getView().byId("idTableInvoices");
            var oValue = oEvent.getParameter("query");
            var oBinding = oTable.getBinding();
            var oModel = oController.getView().getModel("SelectionModel");
            oController._refreshList();
        },
        onPressNavigate: function () {
            var oTable = this.getView().byId("idTableInvoices");
            var sSelectedIndex = oTable.getSelectedIndex();
            if (sSelectedIndex !== -1) {
                var oContexts = oTable.getBinding('rows').getContexts();
                var sPath = oContexts[sSelectedIndex].getPath();
                var oData = oContexts[sSelectedIndex].getModel().getProperty(sPath);
                debugger;
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
        onSubmitBatchUpdate: function () {

        },
        onReleaseBatch: function (sInvNumber, sAccNumber) {
            var oTable = this.getView().byId("idTableInvoices");
            var oContexts = oTable.getBinding('rows').getContexts();
            if (oContexts.length > 0) {
                var sPath = oContexts[0].getPath();
                var oData = oContexts[0].getModel().getProperty(sPath);

                // Display BatchId information before proceeding
                var sBatchId = oData.BatchId;
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
            var oTable = this.getView().byId("idTableInvoices");
            var oContexts = oTable.getBinding('rows').getContexts();
            if (oContexts.length > 0) {
                var sPath = oContexts[0].getPath();
                var oData = oContexts[0].getModel().getProperty(sPath);

                // Display BatchId information before proceeding
                // var sBatchId = oData.BatchId;
                var sBatchID = oData.BatchId;//'15'; //oData.BatchId //
                oDataModel.read("/Pull_listSet", {
                    filters: [new Filter("BatchId", FilterOperator.EQ, sBatchID)],
                    success: function (oData) {
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
            var oModel = oController.getView().getModel("SelectionModel")
            var aPullList = oModel.getProperty("/aPullList");
            // var myArray = [/* your array containing pull_listSet objects */];
            var oPayload = {
                "BatchId": "42_UR",
                "Pull_listSet": aPullList.map(item => ({
                    "BatchId": item.BatchId,
                    "InputCheck": item.InputCheck,
                    "InvoiceNo": item.InvoiceNo,
                    "ContractAcc": item.ContractAcc
                }))
            };
            oDataModel.create("/Dummy_pull_list_mailSet", oPayload, {
                success: function (oData) {
                    // Handle success response
                    MessageBox.success(oData.MSG_TXT);
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
            var oBatchIdInput = this.getView().byId("idBatchIdInput");
            var oDateInput = this.getView().byId("idDateInput");
            if (!oBatchIdInput.getValue() && !oDateInput.getValue()) {
                MessageBox.error("Please enter Batch ID or Date");
            }
            oController._refreshList();

        },
        _refreshList: function () {
            var oSelectionModel = oController.getView().getModel("SelectionModel");
            var sDate = oSelectionModel.getProperty("/oInvoiceDate");
            var sBatchId = oSelectionModel.getProperty("/sBatchId");
            var oTable = this.getView().byId("idTableInvoices");
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
                oFilter.push(new Filter("BatchId", FilterOperator.EQ, sBatchId));
            }
            if (sDate) {
                // var formattedDate = new Date(sDate).toISOString().split('T')[0] + "T00:00:00";
                oFilter.push(new Filter("PRINT_DATE", FilterOperator.EQ, Dateformatter(sDate)));
            }
            oBinding.filter(oFilter);
            oBinding.refresh(true);

        }
    });
});