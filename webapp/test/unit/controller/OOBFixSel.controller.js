/*global QUnit*/

sap.ui.define([
	"comsaplhmr/zlh_oob_fix/controller/OOBFixSel.controller"
], function (Controller) {
	"use strict";

	QUnit.module("OOBFixSel Controller");

	QUnit.test("I should test the OOBFixSel controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
