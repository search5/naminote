"use strict";
/*
 * Copyright 2020 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNote = exports.noteIndexConfig = exports.noteTypeDef = exports.DEFAULT_NOTE_CONTENT = exports.NOTE_CONTENT_LOOKASIDE_THRESHOLD = void 0;
const conduit_core_1 = require("conduit-core");
const conduit_storage_1 = require("conduit-storage");
const conduit_utils_1 = require("conduit-utils");
const en_data_model_1 = require("en-data-model");
const EntityConstants_1 = require("../EntityConstants");
const Blob_1 = require("./Blob");
const DEFAULT_CACHE_TIMEOUT = 30 * conduit_utils_1.MILLIS_IN_ONE_SECOND;
exports.NOTE_CONTENT_LOOKASIDE_THRESHOLD = 256;
exports.DEFAULT_NOTE_CONTENT = '<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note><div><br /></div></en-note>';
/* The following regexes are created using https://mothereff.in/regexpu#input=/%5Cp%7BLetter%7D/u&unicodePropertyEscape=1
 * and use the regexs defined in the thrift calls to transpile to a ES2015 format */
// eslint-disable-next-line max-len
const NOTE_LABEL_REGEX = /^[!-~\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\u{10FFFF}]([ -~\xA0-\u2027\u202A-\u{10FFFF}]{0,253}[!-~\xA1-\u167F\u1681-\u1FFF\u200B-\u2027\u202A-\u202E\u2030-\u205E\u2060-\u2FFF\u3001-\u{10FFFF}])?$/u;
exports.noteTypeDef = {
    name: EntityConstants_1.CoreEntityTypes.Note,
    syncSource: conduit_storage_1.SyncSource.THRIFT,
    fieldValidation: {
        label: {
            regex: NOTE_LABEL_REGEX,
            min: 1,
            max: 255,
        },
    },
    schema: {
        isMetadata: 'boolean',
        isUntitled: 'boolean',
        created: 'timestamp',
        updated: 'timestamp',
        deleted: conduit_utils_1.NullableTimestamp,
        isExternal: 'boolean',
        content: Blob_1.BlobBaseSchema,
        thumbnailUrl: conduit_utils_1.NullableUrl,
        shareUrlPlaceholder: 'url',
        contentDownloaded: conduit_utils_1.NullableBoolean,
        Attributes: conduit_utils_1.Struct({
            subjectDate: conduit_utils_1.NullableTimestamp,
            contentClass: conduit_utils_1.NullableString,
            Location: conduit_utils_1.Struct({
                latitude: conduit_utils_1.NullableNumber,
                longitude: conduit_utils_1.NullableNumber,
                altitude: conduit_utils_1.NullableNumber,
                placeName: conduit_utils_1.NullableString,
            }),
            Reminder: conduit_utils_1.Struct({
                reminderOrder: conduit_utils_1.NullableTimestamp,
                reminderDoneTime: conduit_utils_1.NullableTimestamp,
                reminderTime: conduit_utils_1.NullableTimestamp,
            }),
            Share: conduit_utils_1.Struct({
                shareDate: conduit_utils_1.NullableTimestamp,
                sharedWithBusiness: conduit_utils_1.NullableBoolean,
            }),
            Editor: conduit_utils_1.Struct({
                author: conduit_utils_1.NullableString,
                lastEditedBy: conduit_utils_1.NullableString,
            }),
            Source: conduit_utils_1.Struct({
                source: conduit_utils_1.NullableString,
                sourceURL: conduit_utils_1.NullableUrl,
                sourceApplication: conduit_utils_1.NullableString,
            }),
        }),
        // note limitations.
        noteResourceCountMax: conduit_utils_1.NullableNumber,
        uploadLimit: conduit_utils_1.NullableNumber,
        resourceSizeMax: conduit_utils_1.NullableNumber,
        noteSizeMax: conduit_utils_1.NullableNumber,
        uploaded: conduit_utils_1.NullableNumber,
        internal_shareCountProfiles: conduit_utils_1.MapOf('number'),
    },
    cache: Object.assign(Object.assign({}, Blob_1.BlobCache('content', exports.NOTE_CONTENT_LOOKASIDE_THRESHOLD)), { ['content.editSequenceNumber']: {
            type: 'int',
            allowStale: false,
        }, snippet: {
            type: conduit_utils_1.NullableString,
            allowStale: true,
            dependentFields: ['updated'],
            cacheTimeout: conduit_utils_1.MILLIS_IN_ONE_DAY,
        }, shareUrl: {
            type: conduit_utils_1.NullableUrl,
            allowStale: false,
            dependentFields: ['Attributes.Share.shareDate'],
        }, internal_membershipsAcceptStatus: {
            type: conduit_utils_1.MapOf('boolean'),
            allowStale: true,
            cacheTimeout: DEFAULT_CACHE_TIMEOUT,
        } }),
    hasMemberships: {
        constraint: conduit_storage_1.EdgeConstraint.MANY,
        type: conduit_storage_1.EdgeType.MEMBERSHIP,
        to: EntityConstants_1.CoreEntityTypes.Membership,
    },
    edges: {
        parent: {
            constraint: conduit_storage_1.EdgeConstraint.OPTIONAL,
            type: conduit_storage_1.EdgeType.ANCESTRY,
            from: {
                type: [EntityConstants_1.CoreEntityTypes.Workspace, EntityConstants_1.CoreEntityTypes.Notebook],
                constraint: conduit_storage_1.EdgeConstraint.MANY,
                denormalize: ['children', 'childrenInTrash'],
            },
        },
        sourceNote: {
            constraint: conduit_storage_1.EdgeConstraint.OPTIONAL,
            type: conduit_storage_1.EdgeType.LINK,
            from: EntityConstants_1.CoreEntityTypes.Note,
        },
        creator: {
            constraint: conduit_storage_1.EdgeConstraint.REQUIRED,
            type: conduit_storage_1.EdgeType.LINK,
            to: EntityConstants_1.CoreEntityTypes.Profile,
        },
        lastEditor: {
            constraint: conduit_storage_1.EdgeConstraint.REQUIRED,
            type: conduit_storage_1.EdgeType.LINK,
            to: EntityConstants_1.CoreEntityTypes.Profile,
        },
        tags: {
            constraint: conduit_storage_1.EdgeConstraint.MANY,
            type: conduit_storage_1.EdgeType.VIEW,
            to: {
                type: EntityConstants_1.CoreEntityTypes.Tag,
                constraint: conduit_storage_1.EdgeConstraint.MANY,
                denormalize: ['refs', 'refsInTrash'],
            },
        },
    },
};
function getParentNodeRef(node) {
    const parentNodeEdge = conduit_utils_1.firstStashEntry(node.inputs.parent);
    if (parentNodeEdge) {
        return { id: parentNodeEdge.srcID, type: parentNodeEdge.srcType };
    }
    return null;
}
exports.noteIndexConfig = conduit_storage_1.buildNodeIndexConfiguration(exports.noteTypeDef, {
    priority: conduit_storage_1.IndexPriority.LOW,
    indexResolvers: {
        created: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'created']),
        updated: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'updated']),
        label: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['label']),
        reminderOrder: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'Attributes', 'Reminder', 'reminderOrder']),
        reminderTime: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'Attributes', 'Reminder', 'reminderTime']),
        reminderDoneTime: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'Attributes', 'Reminder', 'reminderDoneTime']),
        source: conduit_storage_1.getIndexByResolverForPrimitives(exports.noteTypeDef, ['NodeFields', 'Attributes', 'Source', 'source']),
        sourceNote: conduit_storage_1.getIndexByResolverForEdge(exports.noteTypeDef, ['edges', 'sourceNote']),
        parent: conduit_storage_1.getIndexByResolverForEdge(exports.noteTypeDef, ['edges', 'parent']),
        inTrash: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [node.NodeFields.deleted !== null];
            },
            graphqlPath: ['inTrash'],
            isUnSyncedField: true,
        },
        hasReminder: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [node.NodeFields.Attributes.Reminder.reminderOrder !== null];
            },
            graphqlPath: ['hasReminder'],
            isUnSyncedField: true,
        },
        reminderIsDone: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [Boolean(node.NodeFields.Attributes.Reminder.reminderDoneTime)];
            },
            graphqlPath: ['reminderIsDone'],
            isUnSyncedField: true,
        },
        hasSource: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [Boolean(node.NodeFields.Attributes.Source.source)];
            },
            graphqlPath: ['hasSource'],
            isUnSyncedField: true,
        },
        workspace: {
            schemaType: conduit_utils_1.NullableID,
            entityRefTypes: [EntityConstants_1.CoreEntityTypes.Workspace],
            resolver: async (trc, node, nodeFieldLookup) => {
                const parentRef = getParentNodeRef(node);
                if (parentRef) {
                    switch (parentRef.type) {
                        case EntityConstants_1.CoreEntityTypes.Workspace:
                            return [parentRef.id];
                        case EntityConstants_1.CoreEntityTypes.Notebook:
                            const res = await nodeFieldLookup(trc, parentRef, 'parent');
                            return [res !== null && res !== void 0 ? res : null];
                        default:
                            return [null];
                    }
                }
                // This could happen in optimistic node creation processs. Conduit creates node first and than create edges.
                return [null];
            },
            graphqlPath: ['workspace'],
            isUnSyncedField: true,
            propagatedFrom: {
                srcType: EntityConstants_1.CoreEntityTypes.Notebook,
                srcField: 'parent',
                traversalToDst: [{ edge: ['outputs', 'children'], type: EntityConstants_1.CoreEntityTypes.Note }],
            },
        },
        stack: {
            schemaType: conduit_utils_1.NullableID,
            entityRefTypes: [EntityConstants_1.CoreEntityTypes.Stack],
            resolver: async (trc, node, nodeFieldLookup) => {
                const parentRef = getParentNodeRef(node);
                if (parentRef && parentRef.type === EntityConstants_1.CoreEntityTypes.Notebook) {
                    const res = await nodeFieldLookup(trc, parentRef, 'stack');
                    return [res !== null && res !== void 0 ? res : null];
                }
                // This could happen in optimistic node creation processs. Conduit creates node first and than create edges.
                return [null];
            },
            graphqlPath: ['stack'],
            isUnSyncedField: true,
            propagatedFrom: {
                srcType: EntityConstants_1.CoreEntityTypes.Notebook,
                srcField: 'stack',
                traversalToDst: [{ edge: ['outputs', 'children'], type: EntityConstants_1.CoreEntityTypes.Note }],
            },
        },
        isShared: {
            schemaType: 'boolean',
            resolver: async (trc, node, nodeFieldLookup) => {
                const creatorEdge = conduit_utils_1.firstStashEntry(node.outputs.creator);
                if (!creatorEdge) {
                    return [false];
                }
                if (node.NodeFields.isExternal) {
                    return [true];
                }
                const userProfileID = await nodeFieldLookup(trc, { id: conduit_core_1.PERSONAL_USER_ID, type: EntityConstants_1.CoreEntityTypes.User }, 'profile');
                return [node.owner ? creatorEdge.dstID !== userProfileID && node.owner !== userProfileID : creatorEdge.dstID !== userProfileID];
            },
            graphqlPath: ['isShared'],
            isUnSyncedField: true,
        },
        isDefaultTaskNote: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [!conduit_utils_1.isStashEmpty(node.inputs.taskUserSettingsForDefaultNote)];
            },
            graphqlPath: ['isDefaultTaskNote'],
            isUnSyncedField: true,
        },
        tasksCount: {
            schemaType: 'int',
            resolver: async (trc, node, _) => {
                var _a;
                return [Object.keys((_a = node.outputs.tasks) !== null && _a !== void 0 ? _a : {}).length];
            },
            graphqlPath: ['tasksCount'],
            isUnSyncedField: true,
        },
        inBusinessAccount: {
            schemaType: 'boolean',
            resolver: async (trc, node, _) => {
                return [node.syncContexts.includes(conduit_core_1.VAULT_USER_CONTEXT)];
            },
            graphqlPath: ['inBusinessAccount'],
            isUnSyncedField: true,
        },
        hasTaskGroup: {
            schemaType: 'boolean',
            resolver: async (trc, node, nodeFieldLookup, dependentFieldValues) => {
                const noteContentInfoEdge = conduit_utils_1.firstStashEntry(node.outputs.noteContentInfo);
                if (!noteContentInfoEdge) {
                    return [false];
                }
                const hasTaskGroup = Boolean(await nodeFieldLookup(trc, { id: noteContentInfoEdge.dstID, type: noteContentInfoEdge.dstType }, 'hasTaskGroup'));
                if (hasTaskGroup) {
                    return [true];
                }
                const [isDefaultTaskNote] = dependentFieldValues.isDefaultTaskNote;
                return [isDefaultTaskNote];
            },
            dependencies: ['isDefaultTaskNote'],
            graphqlPath: ['hasTaskGroup'],
            isUnSyncedField: true,
            propagatedFrom: {
                srcType: en_data_model_1.EntityTypes.NoteContentInfo,
                srcField: 'hasTaskGroup',
                traversalToDst: [{ edge: ['inputs', 'parent'], type: EntityConstants_1.CoreEntityTypes.Note }],
            },
        },
        hasCompletedAllTasks: {
            schemaType: 'boolean',
            resolver: async (trc, node, nodeFieldLookup) => {
                var _a;
                const tasks = (_a = node.outputs.tasks) !== null && _a !== void 0 ? _a : {};
                if (conduit_utils_1.isStashEmpty(tasks)) {
                    return [false];
                }
                for (const edge of Object.values(tasks)) {
                    const ref = { id: edge.dstID, type: edge.dstType };
                    const status = await nodeFieldLookup(trc, ref, 'status');
                    if (status === 'open') {
                        return [false];
                    }
                }
                return [true];
            },
            graphqlPath: ['hasCompletedAllTasks'],
            isUnSyncedField: true,
        },
    },
    indexes: {
        allNotesLabel: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesCreated: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesUpdated: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesWithReminders: {
            index: [
                { field: 'reminderTime', order: 'DESC', isMatchField: false },
                { field: 'reminderOrder', order: 'DESC', isMatchField: false },
                { field: 'reminderDoneTime', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasReminder',
                    value: true,
                }],
        },
        allNotesWithDoneReminders: {
            index: [
                { field: 'reminderIsDone', order: 'ASC', isMatchField: true },
                { field: 'reminderTime', order: 'DESC', isMatchField: false },
                { field: 'reminderOrder', order: 'DESC', isMatchField: false },
                { field: 'reminderDoneTime', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'parent', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasReminder',
                    value: true,
                }],
        },
        allNotesForParentLabel: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'parent', order: 'ASC', isMatchField: true },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesForParentCreated: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'parent', order: 'ASC', isMatchField: true },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesForParentUpdated: {
            index: [
                { field: 'inTrash', order: 'ASC', isMatchField: true },
                { field: 'parent', order: 'ASC', isMatchField: true },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
        },
        allNotesForParentWithReminders: {
            index: [
                { field: 'parent', order: 'ASC', isMatchField: true },
                { field: 'reminderTime', order: 'DESC', isMatchField: false },
                { field: 'reminderOrder', order: 'DESC', isMatchField: false },
                { field: 'reminderDoneTime', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasReminder',
                    value: true,
                }],
        },
        allNotesForParentWithDoneReminders: {
            index: [
                { field: 'parent', order: 'ASC', isMatchField: true },
                { field: 'reminderIsDone', order: 'ASC', isMatchField: true },
                { field: 'reminderTime', order: 'DESC', isMatchField: false },
                { field: 'reminderOrder', order: 'DESC', isMatchField: false },
                { field: 'reminderDoneTime', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasReminder',
                    value: true,
                }],
        },
        workspaceID: {
            index: [
                { field: 'workspace', order: 'ASC', isMatchField: true },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'parent', order: 'ASC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    ignoreForFiltering: true,
                    field: 'inBusinessAccount',
                    value: true,
                }, {
                    field: 'inTrash',
                    value: false,
                }],
        },
        stackID: {
            index: [
                { field: 'stack', order: 'ASC', isMatchField: true },
                { field: 'label', order: 'ASC', isMatchField: false },
                { field: 'updated', order: 'DESC', isMatchField: false },
                { field: 'created', order: 'DESC', isMatchField: false },
                { field: 'parent', order: 'ASC', isMatchField: false },
                { field: 'hasReminder', order: 'ASC', isMatchField: false },
            ],
            indexCondition: [{
                    field: 'inTrash',
                    value: false,
                }],
        },
    },
    lookups: ['created'],
    queries: {
        NotesInParent: {
            traversalName: 'childNotes',
            params: {
                parent: {
                    match: { field: 'parent' },
                },
                inTrash: {
                    match: { field: 'inTrash' },
                    defaultValue: false,
                },
                orderBy: {
                    sort: {
                        label: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
                        created: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }],
                        updated: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'created', order: 'DESC' }],
                    },
                },
            },
            includeFields: ['hasReminder'],
        },
        NotesNotInTrash: {
            filter: [{
                    field: 'inTrash',
                    value: false,
                }],
            params: {
                orderBy: {
                    sort: {
                        label: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
                        created: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }],
                        updated: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'created', order: 'DESC' }],
                    },
                },
            },
            includeFields: ['hasReminder'],
        },
        TaskNotesNotInTrash: {
            filter: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasTaskGroup',
                    value: true,
                }],
            params: {
                hasCompletedAllTasks: {
                    optional: true,
                    match: { field: 'hasCompletedAllTasks' },
                },
                isShared: {
                    optional: true,
                    match: { field: 'isShared' },
                },
                orderBy: {
                    sort: {
                        label: [
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        labelCompletedAtBottom: [
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        labelDTNPinned: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        labelDTNPinnedCompletedAtBottom: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        created: [
                            { field: 'created', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                        ],
                        createdCompletedAtBottom: [
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                        ],
                        createdDTNPinned: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'created', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                        ],
                        createdDTNPinnedCompletedAtBottom: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                        ],
                        updated: [
                            { field: 'updated', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        updatedCompletedAtBottom: [
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        updatedDTNPinned: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                        ],
                        updatedDTNPinnedCompletedAtBottom: [
                            { field: 'isDefaultTaskNote', order: 'DESC' },
                            { field: 'hasCompletedAllTasks', order: 'ASC' },
                            { field: 'updated', order: 'DESC' },
                            { field: 'label', order: 'ASC' },
                            { field: 'created', order: 'DESC' },
                        ],
                    },
                },
            },
            includeFields: ['hasCompletedAllTasks', 'isDefaultTaskNote', 'isShared', 'tasksCount'],
        },
        TaskNotesCompletedInSession: {
            filter: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasTaskGroup',
                    value: true,
                }, {
                    field: 'hasCompletedAllTasks',
                    value: true,
                }],
            sort: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }],
            params: {
                updated: {
                    range: { field: 'updated' },
                },
            },
            includeFields: ['isShared'],
        },
        NotesWithReminders: {
            traversalName: 'reminderNotes',
            filter: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasReminder',
                    value: true,
                }],
            params: {
                parent: {
                    optional: true,
                    match: { field: 'parent' },
                },
                doneReminders: {
                    defaultValue: false,
                    match: { field: 'reminderIsDone' },
                },
                reminderTimeRange: {
                    optional: true,
                    range: { field: 'reminderTime' },
                },
                orderBy: {
                    defaultValue: 'reminderTime',
                    sort: {
                        reminderTime: [{ field: 'reminderTime', order: 'DESC' }, { field: 'reminderOrder', order: 'DESC' }, { field: 'reminderDoneTime', order: 'DESC' }],
                        label: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
                        created: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }],
                        updated: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'created', order: 'DESC' }],
                    },
                },
            },
            includeFields: ['created', 'updated', 'label', 'reminderTime', 'reminderOrder', 'reminderDoneTime', 'parent'],
        },
        NotesInTrash: {
            filter: [{
                    field: 'inTrash',
                    value: true,
                }],
            params: {
                orderBy: {
                    sort: {
                        label: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
                        created: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }],
                        updated: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'created', order: 'DESC' }],
                    },
                },
            },
            includeFields: ['hasReminder'],
        },
        NotesInWorkspace: {
            traversalName: 'descendentNotes',
            filter: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    ignoreForFiltering: true,
                    field: 'inBusinessAccount',
                    value: true,
                }],
            params: {
                orderBy: {
                    defaultValue: 'updated',
                    sort: {
                        updated: [{ field: 'updated', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'created', order: 'DESC' }],
                        label: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
                        created: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }],
                    },
                },
                workspace: {
                    match: { field: 'workspace' },
                },
            },
            includeFields: ['parent', 'hasReminder'],
        },
        NotesInStack: {
            traversalName: 'descendentNotes',
            filter: [{
                    field: 'inTrash',
                    value: false,
                }],
            sort: [{ field: 'label', order: 'ASC' }, { field: 'updated', order: 'DESC' }, { field: 'created', order: 'DESC' }],
            params: {
                stack: {
                    match: { field: 'stack' },
                },
            },
            includeFields: ['parent', 'hasReminder'],
        },
        NotesParents: {
            cacheInMemory: true,
            params: {},
            includeFields: ['parent', 'id'],
        },
        NotesWithSource: {
            filter: [{
                    field: 'inTrash',
                    value: false,
                }, {
                    field: 'hasSource',
                    value: true,
                }],
            sort: [{ field: 'created', order: 'DESC' }, { field: 'label', order: 'ASC' }],
            params: {
                source: {
                    match: { field: 'source' },
                },
            },
            includeFields: ['created'],
        },
        NoteConflicts: {
            traversalName: 'conflictBackups',
            sort: [{ field: 'created', order: 'DESC' }],
            params: {
                note: {
                    match: { field: 'sourceNote' },
                },
                inTrash: {
                    match: { field: 'inTrash' },
                    defaultValue: false,
                },
            },
            includeFields: ['label'],
        },
    },
});
function isNote(node) {
    return node.type === EntityConstants_1.CoreEntityTypes.Note;
}
exports.isNote = isNote;
//# sourceMappingURL=Note.js.map