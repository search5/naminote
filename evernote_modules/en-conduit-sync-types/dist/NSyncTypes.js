"use strict";
/*
 * Copyright 2020 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeTypeArrayToEntityFilterParam = exports.entityTypeAsNodeType = exports.PREFERENCE_SHORTCUTS_KEY = exports.NSyncAgentToRecipientMap = exports.NSyncPrivilegeMap = exports.NSyncWorkspaceTypeMap = void 0;
const conduit_utils_1 = require("conduit-utils");
const en_data_model_1 = require("en-data-model");
const MembershipTypes_1 = require("./MembershipTypes");
// possibly redundant, but if we ever change names, and it allows for better typing and an
// error if new type not handled or misspelling
exports.NSyncWorkspaceTypeMap = {
    INVITE_ONLY: MembershipTypes_1.WorkspaceType.INVITE_ONLY,
    DISCOVERABLE: MembershipTypes_1.WorkspaceType.DISCOVERABLE,
    OPEN: MembershipTypes_1.WorkspaceType.OPEN,
};
exports.NSyncPrivilegeMap = {
    [en_data_model_1.ClientNSyncTypes.Role.NULL]: MembershipTypes_1.MembershipPrivilege.READ,
    [en_data_model_1.ClientNSyncTypes.Role.VIEWER]: MembershipTypes_1.MembershipPrivilege.READ,
    [en_data_model_1.ClientNSyncTypes.Role.COMMENTER]: MembershipTypes_1.MembershipPrivilege.READ,
    [en_data_model_1.ClientNSyncTypes.Role.EDITOR]: MembershipTypes_1.MembershipPrivilege.EDIT,
    [en_data_model_1.ClientNSyncTypes.Role.EDITOR_SHARER]: MembershipTypes_1.MembershipPrivilege.EDIT,
    [en_data_model_1.ClientNSyncTypes.Role.ADMIN]: MembershipTypes_1.MembershipPrivilege.MANAGE,
    [en_data_model_1.ClientNSyncTypes.Role.OWNER]: MembershipTypes_1.MembershipPrivilege.MANAGE,
    [en_data_model_1.ClientNSyncTypes.Role.ACTIVITY_VIEWER]: MembershipTypes_1.MembershipPrivilege.READ,
    [en_data_model_1.ClientNSyncTypes.Role.COMPLETER]: MembershipTypes_1.MembershipPrivilege.COMPLETE,
};
exports.NSyncAgentToRecipientMap = {
    [en_data_model_1.ClientNSyncTypes.AgentType.USER]: MembershipTypes_1.MembershipRecipientType.USER,
    [en_data_model_1.ClientNSyncTypes.AgentType.IDENTITY]: MembershipTypes_1.MembershipRecipientType.IDENTITY,
    [en_data_model_1.ClientNSyncTypes.AgentType.BUSINESS]: MembershipTypes_1.MembershipRecipientType.BUSINESS,
};
exports.PREFERENCE_SHORTCUTS_KEY = 'evernote.shortcuts';
function entityTypeAsNodeType(dataModelProvider, entityType, defaultResult) {
    if (conduit_utils_1.isNullish(entityType)) {
        if (conduit_utils_1.isNullish(defaultResult)) {
            return null;
        }
        return defaultResult;
    }
    return dataModelProvider.convertNsyncTypeToNodeType(entityType);
}
exports.entityTypeAsNodeType = entityTypeAsNodeType;
function nodeTypeArrayToEntityFilterParam(eventManager, nodeTypes) {
    if (nodeTypes === null) {
        return '';
    }
    const entityFilterArray = [];
    for (const type of nodeTypes) {
        const nsyncType = eventManager.di.convertNodeTypeToNSyncType(type);
        if (!conduit_utils_1.isNullish(nsyncType)) {
            entityFilterArray.push(nsyncType);
        }
    }
    return '&entityFilter=' + conduit_utils_1.safeStringify(entityFilterArray);
}
exports.nodeTypeArrayToEntityFilterParam = nodeTypeArrayToEntityFilterParam;
//# sourceMappingURL=NSyncTypes.js.map