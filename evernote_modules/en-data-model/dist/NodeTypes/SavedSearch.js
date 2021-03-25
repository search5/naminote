"use strict";
/*
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedSearchIndexConfig = exports.savedSearchTypeDef = void 0;
const conduit_storage_1 = require("conduit-storage");
const EntityConstants_1 = require("../EntityConstants");
/*
  * `format` attribute is left out. It has two value and one is never supported.
  * `scope` attribute is left out temporarily because clients should never be aware of
  * it. Conduit search plugin should though.
  */
exports.savedSearchTypeDef = {
    name: EntityConstants_1.CoreEntityTypes.SavedSearch,
    syncSource: conduit_storage_1.SyncSource.THRIFT,
    schema: {
        query: 'string',
    },
};
exports.savedSearchIndexConfig = conduit_storage_1.buildNodeIndexConfiguration(exports.savedSearchTypeDef, {
    indexResolvers: {
        label: conduit_storage_1.getIndexByResolverForPrimitives(exports.savedSearchTypeDef, ['label']),
    },
    queries: {
        SavedSearches: {
            sort: [{ field: 'label', order: 'ASC' }],
            params: {},
        },
    },
});
//# sourceMappingURL=SavedSearch.js.map