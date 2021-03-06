"use strict";
/*
 * Copyright 2021 Evernote Corporation. All rights reserved.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerScheduledNotificationCachedFields = void 0;
const en_data_model_1 = require("en-data-model");
const SimplyImmutable = __importStar(require("simply-immutable"));
const Migrations_1 = require("../SyncFunctions/Migrations");
function registerScheduledNotificationCachedFields() {
    // conduit v2 - auto save nsync data on write without validation.
    // Move local fields inside ScheduledNotification into CachedFields.
    Migrations_1.registerMigrationFunctionByName('SN-field-2-cached-1.29', async (trc, params) => {
        await params.syncEngine.transact(trc, 'SchemaMigration: SN-field-2-cached-1.29', async (tx) => {
            const oldNodes = await tx.getGraphNodesByType(trc, null, en_data_model_1.EntityTypes.ScheduledNotification);
            for (const node of oldNodes) {
                if (node.NodeFields.dataSourceUpdatedAt === undefined && node.NodeFields.schedulingUpdatedAt === undefined) {
                    continue;
                }
                const syncContext = node.syncContexts[0];
                if (syncContext === undefined) {
                    continue;
                }
                await tx.setNodeCachedField(trc, node, 'dataSourceUpdatedAt', node.NodeFields.dataSourceUpdatedAt, {});
                await tx.setNodeCachedField(trc, node, 'schedulingUpdatedAt', node.NodeFields.schedulingUpdatedAt, {});
                let newNode = SimplyImmutable.deleteImmutable(node, ['NodeFields', 'dataSourceUpdatedAt']);
                newNode = SimplyImmutable.deleteImmutable(node, ['NodeFields', 'schedulingUpdatedAt']);
                await tx.replaceNode(trc, syncContext, newNode);
            }
        });
    });
    // conduit v2 - match conduit field name with nsync field name
    Migrations_1.registerMigrationFunctionByName('SN-data-2-payload-1.34', async (trc, params) => {
        await params.syncEngine.transact(trc, 'SchemaMigration: SN-data-2-payload-1.34', async (tx) => {
            const oldNodes = await tx.getGraphNodesByType(trc, null, en_data_model_1.EntityTypes.ScheduledNotification);
            for (const node of oldNodes) {
                if ('payload' in node.NodeFields) {
                    continue;
                }
                const syncContext = node.syncContexts[0];
                await tx.replaceNode(trc, syncContext, SimplyImmutable.replaceImmutable(node, ['NodeFields', 'payload'], node.NodeFields.data));
            }
        });
    });
}
exports.registerScheduledNotificationCachedFields = registerScheduledNotificationCachedFields;
//# sourceMappingURL=ScheduledNotificationCachedFields.js.map