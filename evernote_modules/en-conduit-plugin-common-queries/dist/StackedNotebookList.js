"use strict";
/*!
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStackedNotebookListPlugin = exports.stackedNotebookList = void 0;
const conduit_core_1 = require("conduit-core");
const conduit_utils_1 = require("conduit-utils");
const en_data_model_1 = require("en-data-model");
const graphql_1 = require("graphql");
function itemIsStack(item) {
    return item.type === en_data_model_1.CoreEntityTypes.Stack;
}
function buildArgs() {
    return {
        sort: {
            type: new graphql_1.GraphQLInputObjectType({
                name: `StackedNotebookSort`,
                fields: {
                    field: { type: conduit_core_1.schemaToGraphQLType(['label', 'created', 'updated'], 'StackedNotebookSortField', false) },
                    order: { type: conduit_core_1.IndexOrderType },
                },
            }),
        },
    };
}
async function resolveNotebookLastUpdated(context, tree, index, nbID, nbUpdated) {
    const noteFilters = [{
            field: 'inTrash',
            match: {
                boolean: false,
            },
        }, {
            field: 'parent',
            match: {
                node: {
                    id: nbID,
                    type: en_data_model_1.CoreEntityTypes.Notebook,
                },
            },
        }];
    const treeKey = context.indexer.keyForQuery(en_data_model_1.CoreEntityTypes.Note, 'ASC', index.index, noteFilters);
    if (!treeKey) {
        return nbUpdated;
    }
    const treeLeaf = await tree.findLeafAndIndex(context.trc, context.watcher, treeKey);
    if (!treeLeaf) {
        // No notes in account
        return nbUpdated;
    }
    const possibleNote = treeLeaf.leaf.data[treeLeaf.index];
    const sameNotebook = Array.isArray(possibleNote) && possibleNote[1].id === nbID;
    const noteUpdated = sameNotebook ? possibleNote[2] : 0;
    return Math.max(noteUpdated, nbUpdated);
}
async function resolveNotebook(context, indexItem, nbFields, noteIndexTree, noteIndex) {
    var _a;
    const notebook = {
        id: nbFields.id,
        type: en_data_model_1.CoreEntityTypes.Notebook,
        childrenCount: nbFields.childrenCount,
        label: nbFields.label,
        stackID: !((_a = nbFields.stack) === null || _a === void 0 ? void 0 : _a.id) ? null : nbFields.stack.id,
    };
    if (indexItem.key === 'stackByLabel') {
        notebook.label = nbFields.label;
    }
    else if (indexItem.key === 'stackByCreated') {
        notebook.created = nbFields.created;
    }
    else {
        if (!noteIndexTree || !noteIndex) {
            throw new conduit_utils_1.InternalError(`Expected an index tree for getting the children notes sorted by updated`);
        }
        notebook.lastUpdated = await resolveNotebookLastUpdated(context, noteIndexTree, noteIndex, notebook.id, nbFields.updated);
        notebook.updated = notebook.lastUpdated;
    }
    return notebook;
}
async function notebooksForQuery(context, indexItem, sort) {
    var e_1, _a;
    var _b;
    conduit_core_1.validateDB(context);
    const tree = await context.db.readonlyIndexingTreeForTypeAndIndex(context.trc, en_data_model_1.CoreEntityTypes.Notebook, indexItem);
    const notebooksIterator = (await context.indexer.getIterator(context.trc, context.watcher, tree, en_data_model_1.CoreEntityTypes.Notebook, indexItem, [], [sort], false, undefined));
    if (!notebooksIterator) {
        throw new Error('Could not create notebooks iterator');
    }
    const fieldStripper = context.indexer.indexedValuesFromKeyFactory(en_data_model_1.CoreEntityTypes.Notebook, indexItem, true);
    const stackedNotebooks = [];
    const unstackedNotebooks = [];
    const updatedComparator = (a, b) => {
        let res = context.indexer.compareWithSort('ASC', { useLocaleCompare: true }, a.stackID, b.stackID);
        if (res === 0) {
            res = context.indexer.compareWithSort(sort.order, { useLocaleCompare: true }, a[sort.field], b[sort.field]);
        }
        return res;
    };
    const noteIndex = context.indexer.indexesForType(en_data_model_1.CoreEntityTypes.Note).allNotesForParentUpdated;
    if (noteIndex.index[1].field !== 'parent' && noteIndex.index[2].field !== 'updated') {
        throw new conduit_utils_1.InternalError(`StackedNotebookList choset the wrong index`);
    }
    const noteTree = sort.field !== 'updated' ? null : await ((_b = context.db) === null || _b === void 0 ? void 0 : _b.readonlyIndexingTreeForTypeAndIndex(context.trc, en_data_model_1.CoreEntityTypes.Note, noteIndex)) || null;
    const notebookPromises = [];
    try {
        for (var notebooksIterator_1 = __asyncValues(notebooksIterator), notebooksIterator_1_1; notebooksIterator_1_1 = await notebooksIterator_1.next(), !notebooksIterator_1_1.done;) {
            const key = notebooksIterator_1_1.value;
            if (!key) {
                continue;
            }
            const nbFields = fieldStripper(key);
            notebookPromises.push(resolveNotebook(context, indexItem, nbFields, noteTree, noteIndex));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (notebooksIterator_1_1 && !notebooksIterator_1_1.done && (_a = notebooksIterator_1.return)) await _a.call(notebooksIterator_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const notebooks = await conduit_utils_1.allSettled(notebookPromises);
    for (const notebook of notebooks) {
        if (indexItem.key !== 'stackByUpdated') {
            if (!notebook.stackID) {
                unstackedNotebooks.push(notebook);
            }
            else {
                stackedNotebooks.push(notebook);
            }
        }
        else {
            // Insert notebooks with binary search
            if (!notebook.stackID) {
                const indexToInsert = conduit_utils_1.binarySearch(updatedComparator, unstackedNotebooks, notebook).index;
                unstackedNotebooks.splice(indexToInsert, 0, notebook);
            }
            else {
                const indexToInsert = conduit_utils_1.binarySearch(updatedComparator, stackedNotebooks, notebook).index;
                stackedNotebooks.splice(indexToInsert, 0, notebook);
            }
        }
    }
    return {
        stackedNotebooks,
        unstackedNotebooks,
    };
}
async function stacksForQuery(context, sort) {
    var e_2, _a;
    const stackIndex = context.indexer.indexForQuery(en_data_model_1.CoreEntityTypes.Stack, [], [sort], [], ['label']);
    if (!stackIndex) {
        throw new Error('Could not create stack index for query');
    }
    conduit_core_1.validateDB(context);
    const tree = await context.db.readonlyIndexingTreeForTypeAndIndex(context.trc, en_data_model_1.CoreEntityTypes.Stack, stackIndex);
    const stacksIterator = (await context.indexer.getIterator(context.trc, context.watcher, tree, en_data_model_1.CoreEntityTypes.Stack, stackIndex, [], [sort] || [], false, undefined));
    if (!stacksIterator) {
        throw new Error('Could not create stacks iterator');
    }
    const fieldStripper = context.indexer.indexedValuesFromKeyFactory(en_data_model_1.CoreEntityTypes.Stack, stackIndex, true);
    const stackLookup = {};
    const stacks = [];
    try {
        for (var stacksIterator_1 = __asyncValues(stacksIterator), stacksIterator_1_1; stacksIterator_1_1 = await stacksIterator_1.next(), !stacksIterator_1_1.done;) {
            const key = stacksIterator_1_1.value;
            if (!key) {
                continue;
            }
            const stackFields = fieldStripper(key);
            const stack = {
                id: stackFields.id,
                type: en_data_model_1.CoreEntityTypes.Stack,
                notebooks: [],
                notebooksCount: 0,
                label: stackFields.label,
            };
            stacks.push(stack);
            stackLookup[stack.id] = stack;
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (stacksIterator_1_1 && !stacksIterator_1_1.done && (_a = stacksIterator_1.return)) await _a.call(stacksIterator_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return {
        stacks,
        stackLookup,
    };
}
function buildListFromLookup(unstackedNotebooks, stacks, stackedNotebooks, stackLookup, sort, comparator) {
    // Add the notebooks
    for (const notebook of stackedNotebooks) {
        const stack = stackLookup[notebook.stackID];
        stack.notebooks.push(notebook);
        // Assign the stack's created/updated value as the first notebook in the stack
        if (sort.field === 'updated' && !stack.lastUpdated) {
            stack.lastUpdated = notebook.lastUpdated;
            stack.updated = stack.lastUpdated;
        }
        else if (sort.field === 'created' && !stack.created) {
            stack.created = notebook.created;
        }
    }
    // Insert the stacks
    for (const stack of stacks) {
        const indexToInsert = conduit_utils_1.binarySearch(comparator, unstackedNotebooks, stack).index;
        unstackedNotebooks.splice(indexToInsert, 0, stackLookup[stack.id]);
    }
    // Expand the stacks
    for (let i = 0; i < unstackedNotebooks.length; i++) {
        const item = unstackedNotebooks[i];
        if (itemIsStack(item)) {
            unstackedNotebooks.splice(i + 1, 0, ...item.notebooks);
            item.notebooksCount = item.notebooks.length;
        }
    }
    return unstackedNotebooks;
}
async function stackedNotebookList(parent, args, context, info) {
    const perfStart = Date.now();
    conduit_core_1.validateDB(context, 'Invalid DB in stackedNotebookList');
    const fieldSelection = info ? conduit_core_1.getFieldsForResolver(context.querySelectionFields, info.path) : {};
    const sort = args.sort || { field: 'label', order: 'ASC' };
    const notebookIndex = context.indexer.indexForQuery(en_data_model_1.CoreEntityTypes.Notebook, [], [sort], [], ['stack']);
    if (!notebookIndex) {
        throw new Error('Could not create notebook index for query');
    }
    const usingIndexPaths = conduit_core_1.graphqlPathForIndexComponents(context.indexer.config.Notebook, notebookIndex.index);
    const { unIndexedPaths } = conduit_core_1.resolveUnindexedPaths(usingIndexPaths, fieldSelection, context.indexer.doValidation, [{ resolverField: 'notebooksCount', graphqlPath: ['notebooksCount'] }], {
        notebooks: 'Should not query notebooks off the stack in this query',
        stack: 'Should not query stack off the notebooks in this query',
    });
    const comparator = (a, b) => {
        let cmp = context.indexer.compareWithSort(sort.order, { useLocaleCompare: true }, a[sort.field], b[sort.field]);
        if (sort.field !== 'label' && cmp === 0) {
            cmp = context.indexer.compareWithSort(sort.order, { useLocaleCompare: true }, a.label, b.label);
        }
        return cmp;
    };
    const stacksPromise = stacksForQuery(context, sort);
    const notebooksPromise = notebooksForQuery(context, notebookIndex, sort);
    const res = await conduit_utils_1.allSettled([stacksPromise, notebooksPromise]);
    let stacks = res[0].stacks;
    const stackLookup = res[0].stackLookup;
    let unstackedNotebooks = res[1].unstackedNotebooks;
    let stackedNotebooks = res[1].stackedNotebooks;
    const isUnIndexedQuery = Boolean(unIndexedPaths.length);
    if (isUnIndexedQuery) {
        unstackedNotebooks = await conduit_core_1.resolveNodesFromList(unstackedNotebooks, context, [], [], info);
        stackedNotebooks = await conduit_core_1.resolveNodesFromList(stackedNotebooks, context, [], [], info);
        stacks = await conduit_core_1.resolveNodesFromList(stacks, context, [], [], info);
        for (const stack of stacks) {
            stackLookup[stack.id] = stack;
        }
    }
    const list = buildListFromLookup(unstackedNotebooks, stacks, stackedNotebooks, stackLookup, sort, comparator);
    const perfElapsed = Date.now() - perfStart;
    if (isUnIndexedQuery) {
        conduit_utils_1.logger.perf(`You are querying un-indexed fields`, { queryName: info === null || info === void 0 ? void 0 : info.fieldName, unIndexedPaths, timeElapsed: perfElapsed });
    }
    if (perfElapsed >= 2000) {
        const message = `Unperformant resolver detected. Query name: ${info === null || info === void 0 ? void 0 : info.fieldName}. Un-indexed fields: ${unIndexedPaths}. Time elapsed: ${perfElapsed}.`;
        conduit_utils_1.logger.debug(`WHOOPS ${message}`);
        conduit_utils_1.recordException({ message }).catch(e => conduit_utils_1.logger.error(e));
    }
    return {
        count: list.length,
        list,
    };
}
exports.stackedNotebookList = stackedNotebookList;
function getStackedNotebookListPlugin() {
    return (autoResolverData) => {
        return {
            args: buildArgs(),
            resolve: stackedNotebookList,
            type: new graphql_1.GraphQLNonNull(new graphql_1.GraphQLObjectType({
                name: 'StackedNotebookList',
                fields: {
                    count: { type: conduit_core_1.schemaToGraphQLType('number') },
                    list: {
                        type: new graphql_1.GraphQLNonNull(new graphql_1.GraphQLList(new graphql_1.GraphQLNonNull(new graphql_1.GraphQLUnionType({
                            name: 'StackedNotebookListResult',
                            types: [autoResolverData.NodeGraphQLTypes.Stack, autoResolverData.NodeGraphQLTypes.Notebook],
                            resolveType: (value) => {
                                return value.type === en_data_model_1.CoreEntityTypes.Notebook ? autoResolverData.NodeGraphQLTypes.Notebook : autoResolverData.NodeGraphQLTypes.Stack;
                            },
                        })))),
                    },
                },
            })),
        };
    };
}
exports.getStackedNotebookListPlugin = getStackedNotebookListPlugin;
//# sourceMappingURL=StackedNotebookList.js.map