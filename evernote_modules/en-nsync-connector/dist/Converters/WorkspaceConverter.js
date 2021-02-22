"use strict";
/*!
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceNodesAndEdges = void 0;
const conduit_utils_1 = require("conduit-utils");
const en_data_model_1 = require("en-data-model");
const NSyncTypes_1 = require("../NSyncTypes");
const BaseConverter_1 = require("./BaseConverter");
const getWorkspaceNodesAndEdges = async (trc, instance, context) => {
    var _a, _b, _c;
    const id = instance.ref.id;
    if (!id) {
        throw new Error('Missing workspace id');
    }
    const oldNode = await context.tx.getNode(trc, null, { id, type: en_data_model_1.CoreEntityTypes.Workspace });
    const viewed = (_a = oldNode === null || oldNode === void 0 ? void 0 : oldNode.NodeFields.viewed) !== null && _a !== void 0 ? _a : false;
    const shareCountProfiles = (_b = oldNode === null || oldNode === void 0 ? void 0 : oldNode.NodeFields.internal_shareCountProfiles) !== null && _b !== void 0 ? _b : {};
    const initial = BaseConverter_1.createInitialNode(instance);
    if (!initial) {
        conduit_utils_1.logger.error('Missing initial values');
        return null;
    }
    const workspaceType = NSyncTypes_1.NSyncWorkspaceTypeMap[instance.workspaceType];
    if (!workspaceType) {
        throw new Error(`Missing workspace type: ${instance.workspaceType}`);
    }
    let defaultRole = null;
    if (instance.defaultRole) {
        defaultRole = (_c = NSyncTypes_1.NSyncPrivilegeMap[instance.defaultRole]) !== null && _c !== void 0 ? _c : null;
        if (!defaultRole) {
            conduit_utils_1.logger.warn(`Missing defaultRole in map: ${instance.defaultRole}`);
        }
    }
    const node = Object.assign(Object.assign({}, initial), { type: en_data_model_1.CoreEntityTypes.Workspace, NodeFields: {
            accessStatus: en_data_model_1.WorkspaceAccessStatusEnum.OPEN,
            created: NSyncTypes_1.convertLong(instance.created || 0),
            updated: NSyncTypes_1.convertLong(instance.updated || 0),
            description: instance.description || '',
            defaultRole,
            isSample: instance.isSample,
            notesCount: 0,
            notebooksCount: 0,
            workspaceType,
            viewed,
            internal_shareCountProfiles: shareCountProfiles,
        }, inputs: {}, outputs: {
            children: {},
            childrenInTrash: {},
            memberships: {},
            shortcut: {},
            // pinnedContents: {}, // TODO v2: put back in
            manager: {},
        }, CacheFields: undefined });
    // TODO v2: Add edge to instance manager
    // manager: Number(instance.manager) as UserID,
    return { nodes: { nodesToUpsert: [node], nodesToDelete: [] } };
};
exports.getWorkspaceNodesAndEdges = getWorkspaceNodesAndEdges;
//# sourceMappingURL=WorkspaceConverter.js.map