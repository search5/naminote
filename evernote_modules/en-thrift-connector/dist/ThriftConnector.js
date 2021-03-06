"use strict";
/*
 * Copyright 2020 Evernote Corporation. All rights reserved.
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
exports.init = void 0;
const conduit_core_1 = require("conduit-core");
const conduit_storage_1 = require("conduit-storage");
const conduit_utils_1 = require("conduit-utils");
const conduit_view_types_1 = require("conduit-view-types");
const en_conduit_sync_types_1 = require("en-conduit-sync-types");
const en_core_entity_types_1 = require("en-core-entity-types");
const en_nsync_connector_1 = require("en-nsync-connector");
const Auth = __importStar(require("./Auth"));
const AccountLimitsConverter_1 = require("./Converters/AccountLimitsConverter");
const NotebookConverter_1 = require("./Converters/NotebookConverter");
const WorkspaceConverter_1 = require("./Converters/WorkspaceConverter");
const Helpers_1 = require("./Helpers");
const ApplicationDataPlugin_1 = require("./Plugins/ApplicationDataPlugin");
const AuthPlugin_1 = require("./Plugins/AuthPlugin");
const MockQueryPlugin_1 = require("./Plugins/MockQueryPlugin");
const PluginHelpers_1 = require("./Plugins/PluginHelpers");
const PreferencesPlugin_1 = require("./Plugins/PreferencesPlugin");
const ThriftPlugin_1 = require("./Plugins/ThriftPlugin");
const UrlPlugin_1 = require("./Plugins/UrlPlugin");
const QuasarConnector_1 = require("./QuasarConnector");
const AccountLimitsResolver_1 = require("./Resolvers/AccountLimitsResolver");
const BlobResolver_1 = require("./Resolvers/BlobResolver");
const FileResolver_1 = require("./Resolvers/FileResolver");
const FolderResolver_1 = require("./Resolvers/FolderResolver");
const MembershipResolver_1 = require("./Resolvers/MembershipResolver");
const NoteDataResolver_1 = require("./Resolvers/NoteDataResolver");
const NoteFieldResolver_1 = require("./Resolvers/NoteFieldResolver");
const PermissionResolver_1 = require("./Resolvers/PermissionResolver");
const ShareAllowanceResolver_1 = require("./Resolvers/ShareAllowanceResolver");
const ShareCountResolver_1 = require("./Resolvers/ShareCountResolver");
const UrlResolver_1 = require("./Resolvers/UrlResolver");
const WorkspacePinnedContentsResolver_1 = require("./Resolvers/WorkspacePinnedContentsResolver");
const WorkspaceUIPreferencesResolver_1 = require("./Resolvers/WorkspaceUIPreferencesResolver");
const SchemaMigrations_1 = require("./SchemaMigrations");
const Thrift_1 = require("./Thrift");
const ThriftRemoteMutationExecutor_1 = require("./ThriftRemoteMutationExecutor");
const ThriftRpc_1 = require("./ThriftRpc");
const ThriftStagedBlobManager_1 = require("./ThriftStagedBlobManager");
const ThriftSyncEngine_1 = require("./ThriftSyncEngine");
const UrlCacheEncoder = __importStar(require("./UrlCacheEncoder"));
let gAuthTokenCacheLifetime = conduit_utils_1.registerDebugSetting('AuthTokenCacheLifetime', 30000, v => gAuthTokenCacheLifetime = v);
const HOST_RESOLVER_URL = 'https://update.evernote.com/enclients/hostResolver.json';
function init(di, configs) {
    var _a, _b, _c, _d;
    ThriftRpc_1.updateThriftBackoffManager((_a = configs.maxBackoffTimeout) !== null && _a !== void 0 ? _a : 16000);
    const thriftComm = new Thrift_1.ThriftComm(di);
    const hostResolver = new conduit_core_1.HostResolver(di.hostDefaults, di.hostResolverUrl || HOST_RESOLVER_URL, di.getHttpTransport);
    const offlineContentStrategy = di.getOfflineContentStrategy ? di.getOfflineContentStrategy() : conduit_view_types_1.OfflineContentStrategy.NONE;
    let urlEncoder = null;
    const proxyType = di.getResourceProxyType ? di.getResourceProxyType() : en_conduit_sync_types_1.ResourceProxyType.None;
    switch (proxyType) {
        case en_conduit_sync_types_1.ResourceProxyType.None:
            break;
        case en_conduit_sync_types_1.ResourceProxyType.CookieAuth:
            break;
        case en_conduit_sync_types_1.ResourceProxyType.NativeLayerCache:
            urlEncoder = UrlCacheEncoder.urlToNativeCache;
            break;
        default: {
            throw conduit_utils_1.absurd(proxyType, 'proxyType');
        }
    }
    const resourceManager = di.ResourceManager({
        getCurrentUserID: di.getCurrentUserID,
        urlEncoder,
        getFileServiceHost: (host) => {
            const fileSerivce = hostResolver.getServiceHostSkipCache(host, 'File');
            if (!fileSerivce) {
                throw new Error('Missing file service URL');
            }
            return fileSerivce;
        },
    });
    const nSyncEventManager = new en_nsync_connector_1.NSyncEventManager(Object.assign(Object.assign({}, di), { featureVersion: conduit_view_types_1.FEATURE_VERSION }), hostResolver);
    function refreshAuthToken(trc, oldAuthData) {
        if (!di.getHttpTransport) {
            throw new Error('Unable to refresh auth token because HttpTransport is missing!');
        }
        return Auth.refreshAuthToken(trc, oldAuthData, di.getHttpTransport());
    }
    // When requesting NAP to refresh the same old token 1+ times, only the first request succeeds. NAP's responses for the rest are "token expired."
    // We often issue one request but clients can issue multiple before us. Conduit sync code relies on the success response to update user's auth token internally.
    // The memoization mainly limits us to issue only one request every X seconds and reuse the response rather than just optimizing performance.
    // X is an arbitrary number that is most likely smaller than any realistic auth token lifetime.
    const [refreshNAPAuthToken] = conduit_utils_1.memoize('refreshAuthToken', refreshAuthToken, (_, oldAuth) => `${oldAuth.token}:${oldAuth.userID}`, gAuthTokenCacheLifetime);
    const quasarConnector = new QuasarConnector_1.QuasarConnectorAndExecutor(di, hostResolver, nSyncEventManager);
    const setupSyncEventStorage = (storage) => {
        nSyncEventManager.setupStorage(storage);
    };
    const initSyncEventManager = async (trc, host, token, jwt, clientID, fromPrebuilt) => {
        await nSyncEventManager.init(trc, host, token, jwt, clientID, resourceManager, fromPrebuilt);
        return nSyncEventManager;
    };
    const pluginTokenRefreshManager = new PluginHelpers_1.PluginTokenRefreshManager({ refreshAuthToken: refreshNAPAuthToken }, (_b = configs.maxBackoffTimeout) !== null && _b !== void 0 ? _b : 16000);
    const coreEntityPlugin = {
        name: 'CoreEntities',
        defineQueries: () => (Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, AccountLimitsResolver_1.AccountLimitsResolver()), BlobResolver_1.BlobResolver(urlEncoder)), FolderResolver_1.LastUpdatedResolver()), MembershipResolver_1.MembershipResolver()), NoteFieldResolver_1.NoteFieldResolver()), PermissionResolver_1.PermissionResolver()), ShareAllowanceResolver_1.ShareAllowanceResolver()), ShareCountResolver_1.ShareCountResolver()), UrlResolver_1.UrlResolver(urlEncoder)), WorkspacePinnedContentsResolver_1.WorkspacePinnedContentsResolver()), WorkspaceUIPreferencesResolver_1.WorkspaceUIPreferencesResolver())),
        entityTypes: () => {
            const result = Object.assign({}, en_core_entity_types_1.CoreEntityTypeDefs);
            // inject Thrift-specific functions
            result.Note.dataResolver = NoteDataResolver_1.getNoteDataResolver(di.getSearchShareAcceptMetadata);
            result.Note.deleteHook = NotebookConverter_1.deletePendingOfflineNoteSyncState;
            result.Workspace.deleteHook = WorkspaceConverter_1.WorkspaceConverter.onDelete;
            result.Notebook.deleteHook = async (trc, tx, notebookID) => {
                await NotebookConverter_1.NotebookConverter.onDelete(trc, tx, di.getLocalSettings(), notebookID);
            };
            // inject nsync converters
            for (const type in en_nsync_connector_1.CoreEntityNSyncConverters) {
                result[type].nsyncConverters = en_nsync_connector_1.CoreEntityNSyncConverters[type];
            }
            return result;
        },
        mutationRules: () => {
            return en_core_entity_types_1.CoreMutationRules;
        },
        mutatorDefs: () => {
            return en_core_entity_types_1.CoreMutatorDefs;
        },
    };
    function createMutationEngine(sendMutationMetrics) {
        return new conduit_core_1.MutationEngine({
            sendMutationMetrics,
            nodeTypeDefs: di.getNodeTypeDefs(),
            mutationRules: di.getMutationRules(),
            mutatorDefs: di.getMutatorDefs(),
            generateCustomID: ThriftRemoteMutationExecutor_1.generateCustomID,
            recordEvent: conduit_utils_1.recordEvent,
            md5: conduit_utils_1.md5,
            guidGenerator: conduit_core_1.GuidGenerator,
            userRef: { id: conduit_core_1.PERSONAL_USER_ID, type: en_core_entity_types_1.CoreEntityTypes.User },
            vaultRef: { id: conduit_core_1.VAULT_USER_ID, type: en_core_entity_types_1.CoreEntityTypes.User },
        });
    }
    return {
        di: {
            // persisted personal/vault sync context metadata do not have auth tokens because the tokens can only be stored inside secure storage.
            // Therefore we amend the metadata when read.
            amendSyncContextMetadataBeforeRead: ThriftSyncEngine_1.fillSyncContextMetadataToken,
            amendSyncContextMetadataBeforeWrite: ThriftSyncEngine_1.sanitizeSyncContextMetadata,
            offlineContentStrategy,
            countUpdater: AccountLimitsConverter_1.updateNodeTypeCount,
            getBestSyncContextForNode: Helpers_1.getBestSyncContextForNode,
            MutationEngine: createMutationEngine,
            RemoteMutationExecutor: (graphStorage, sendMutationMetrics, localSettings, stagedBlobManager, syncEngine) => {
                const thriftConnector = new ThriftRemoteMutationExecutor_1.ThriftRemoteMutationExecutor(Object.assign(Object.assign({}, di), { MutationEngine: createMutationEngine }), graphStorage, thriftComm, sendMutationMetrics, localSettings, offlineContentStrategy, stagedBlobManager, syncEngine, quasarConnector.dispatchCustomCommand);
                return {
                    [conduit_core_1.MutatorRemoteExecutorType.Thrift]: thriftConnector,
                    [conduit_core_1.MutatorRemoteExecutorType.CommandService]: quasarConnector,
                    [conduit_core_1.MutatorRemoteExecutorType.Local]: thriftConnector,
                };
            },
            SyncEngine: (graphStorage, ephemeralState, localSettings) => {
                const engine = new ThriftSyncEngine_1.ThriftSyncEngine(Object.assign(Object.assign({}, di), { initSyncEventManager,
                    setupSyncEventStorage, refreshAuthToken: refreshNAPAuthToken, getOfflineContentStrategy: () => di.getOfflineContentStrategy ? di.getOfflineContentStrategy() : conduit_view_types_1.OfflineContentStrategy.NONE }), graphStorage, ephemeralState, thriftComm, localSettings, resourceManager, offlineContentStrategy, di.clientCredentials);
                return engine;
            },
            StagedBlobManager: (graphStorage, blobStorage, localSettings) => {
                return new ThriftStagedBlobManager_1.ThriftStagedBlobManager(graphStorage, blobStorage, resourceManager, thriftComm, localSettings, offlineContentStrategy, quasarConnector);
            },
            getResourceManager: () => {
                return resourceManager;
            },
            emitEvent: (event, data) => {
                di.emitEvent && di.emitEvent(event, data);
            },
            urlEncoder,
            uuid: di.uuid,
            invalidateAuthToken: async (trc, tokenAndState) => {
                var _a, _b;
                if (tokenAndState.state === conduit_view_types_1.AuthState.Authorized && tokenAndState.token) {
                    await Auth.invalidateAuthToken(trc, tokenAndState.token, thriftComm, (_a = (di.getHttpTransport && di.getHttpTransport())) !== null && _a !== void 0 ? _a : null, (_b = di.clientCredentials) !== null && _b !== void 0 ? _b : null);
                }
            },
            hostResolver,
            fileResolver: FileResolver_1.FileResolverDI(hostResolver, urlEncoder, di.overrideFileServiceUrl),
            Indexer: (nodeTypes, indexConfig) => {
                var _a;
                return new conduit_storage_1.EvernoteIndexer(indexConfig, nodeTypes, (_a = configs.doValidation) !== null && _a !== void 0 ? _a : false);
            },
            extendContext: () => {
                return {
                    thriftComm,
                    offlineContentStrategy,
                    makeQueryRequest: quasarConnector.makeQueryRequestFromGraphQL,
                };
            },
            getHttpTransport: di.getHttpTransport,
            getMutationServiceLastProcessingTime: async (newTrc, graphStorage) => {
                const timeReturn = await graphStorage.getSyncState(newTrc, null, [en_nsync_connector_1.LAST_NSYNC_SYNC_STATE_PATH]) || 0;
                if (typeof (timeReturn) !== 'number') {
                    return 0;
                }
                return timeReturn;
            },
        },
        plugins: [
            ApplicationDataPlugin_1.getApplicationDataPlugin(),
            AuthPlugin_1.getAuthPlugin((_c = (di.getHttpTransport && di.getHttpTransport())) !== null && _c !== void 0 ? _c : null, pluginTokenRefreshManager, (_d = di.clientCredentials) === null || _d === void 0 ? void 0 : _d.deviceIdentifier),
            MockQueryPlugin_1.getMockQueryPlugin(),
            PreferencesPlugin_1.getPreferencePlugin(),
            ThriftPlugin_1.getThriftPlugin(resourceManager, offlineContentStrategy),
            nSyncEventManager.getPlugin(),
            UrlPlugin_1.getUrlPlugin(pluginTokenRefreshManager),
            coreEntityPlugin,
        ],
        offlineContentStrategy,
        syncContextIndexExcludes: [/^User:/],
        thriftComm,
        loginWithCookies: async (context, defaultServiceHost, userSlotFromInit) => {
            var _a;
            await AuthPlugin_1.loginWithCookies(context, thriftComm, defaultServiceHost, userSlotFromInit, (_a = di.clientCredentials) === null || _a === void 0 ? void 0 : _a.deviceIdentifier);
        },
        loginWithAuthInQueue: async (context, existingAuth, noSync, deviceIdentifier) => {
            const auth = await Auth.loginWithAuthInQueue(context.trc, thriftComm, existingAuth);
            if (auth) {
                await AuthPlugin_1.setLoginAuthData(thriftComm, context, auth, deviceIdentifier, { cookieAuth: false, noSync });
            }
        },
    };
}
exports.init = init;
SchemaMigrations_1.registerSchemaMigrations();
//# sourceMappingURL=ThriftConnector.js.map