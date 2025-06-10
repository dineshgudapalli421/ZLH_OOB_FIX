/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"comsaplhmr/zlh_oob_fix/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
