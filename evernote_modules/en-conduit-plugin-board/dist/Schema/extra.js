"use strict";
/*
 * Copyright 2021 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extraFeatureVersionOne = void 0;
const en_home_data_model_1 = require("en-home-data-model");
exports.extraFeatureVersionOne = {
    widgetTypeGenerator: () => {
        const extraWidgets = new Array(en_home_data_model_1.BoardSchema.MaxExtraWidgets);
        extraWidgets.fill(en_home_data_model_1.WidgetType.Extra);
        return extraWidgets;
    },
    schemeUpgradeConverter: async () => {
        return {};
    },
};
//# sourceMappingURL=extra.js.map