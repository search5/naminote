"use strict";
/*
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementalSyncActivityHydrator = exports.IncrementalSyncActivity = exports.IncrementalSyncBaseActivity = void 0;
const conduit_utils_1 = require("conduit-utils");
const conduit_view_types_1 = require("conduit-view-types");
const en_conduit_sync_types_1 = require("en-conduit-sync-types");
const Auth_1 = require("../Auth");
const LinkedNotebookSync_1 = require("../SyncFunctions/LinkedNotebookSync");
const MessageSync_1 = require("../SyncFunctions/MessageSync");
const NoteStoreSync_1 = require("../SyncFunctions/NoteStoreSync");
const NSyncSync_1 = require("../SyncFunctions/NSyncSync");
const SharedNoteSync_1 = require("../SyncFunctions/SharedNoteSync");
const SyncHelpers_1 = require("../SyncFunctions/SyncHelpers");
const CatchupSyncActivity_1 = require("./CatchupSyncActivity");
const ENSyncActivity_1 = require("./ENSyncActivity");
const CHUNK_TIMEBOX = 200;
const MESSAGE_SUBBUCKET_SIZE = 0.2; // for incremenatal progress
const NSYNC_SUBBUCKET_SIZE = 0.05; // for incremental progress
const NOTES_SUBBUCKET_SIZE = 0.35; // for incremental progress
const SHAREDNOTES_SUBUCKET_SIZE = 0.2; // for incremental progress
const SHAREDNOTEBOOKS_SUBUCKET_SIZE = 0.2; // for incremental progress
class IncrementalSyncBaseActivity extends ENSyncActivity_1.ENSyncActivity {
    constructor(ibaseDI, context, params, options) {
        super(ibaseDI, context, params, options);
        this.ibaseDI = ibaseDI;
    }
    async syncMessages(trc, subBucketSize, offset) {
        const syncParams = this.initParams('personal', 'messages', CHUNK_TIMEBOX, subBucketSize, offset);
        await MessageSync_1.syncMessages(trc, syncParams);
    }
    async syncNSync(trc, syncEventManager, subBucketSize, offset) {
        const syncParams = this.initParams('personal', 'nsync', CHUNK_TIMEBOX, subBucketSize, offset);
        await NSyncSync_1.syncNSync(trc, syncEventManager, syncParams);
    }
    async syncNotestore(trc, isVault, subBucketSize, offset) {
        const syncParams = this.initParams(isVault ? 'vault' : 'personal', 'notestore', CHUNK_TIMEBOX, subBucketSize, offset);
        await NoteStoreSync_1.syncForward(trc, syncParams);
        const catchupSyncState = await SyncHelpers_1.getCatchupSyncState(trc, syncParams);
        if (catchupSyncState.guids.notebooks.length || catchupSyncState.guids.workspaces.length) {
            await this.context.syncManager.addActivity(trc, new CatchupSyncActivity_1.CatchupSyncActivity(this.ibaseDI, this.context, isVault, subBucketSize, offset));
        }
    }
    async syncSharedNotebook(trc, shareGuid) {
        const shareState = await this.context.syncEngine.graphStorage.getSyncState(trc, null, ['sharing', 'sharedNotebooks', shareGuid]);
        if (!shareState) {
            return;
        }
        const linkedNotebook = shareState.linkedNotebook;
        if (!linkedNotebook.guid || !shareState.authStr) {
            return;
        }
        const syncContext = LinkedNotebookSync_1.linkedNotebookSyncContext(linkedNotebook.guid);
        this.curParams = {
            thriftComm: this.context.thriftComm,
            syncEngine: this.context.syncEngine,
            auth: Auth_1.decodeAuthData(shareState.authStr),
            personalAuth: this.context.syncManager.getAuth(),
            isVault: false,
            syncContext,
            syncStatePath: [syncContext, 'notestore'],
            personalUserID: this.context.syncEngine.getPersonalUserID(),
            vaultUserID: this.context.syncEngine.getVaultUserID(),
            chunkTimebox: CHUNK_TIMEBOX,
            yieldCheck: this.yieldCheck,
            localSettings: this.ibaseDI.getLocalSettings(),
            offlineContentStrategy: this.ibaseDI.getOfflineContentStrategy(),
            updateUser: this.ibaseDI.updateUser,
        };
        conduit_utils_1.logger.debug('syncSharedNotebook', shareGuid);
        const res = await conduit_utils_1.withError(LinkedNotebookSync_1.syncLinkedNotebook(trc, this.curParams, shareState, shareGuid));
        if (res.err) {
            if (res.err instanceof conduit_utils_1.AuthError) {
                res.err = await this.ibaseDI.handleAuthError(trc, res.err);
            }
        }
    }
    async syncSharedNote(trc, guid) {
        const shareState = await this.context.syncEngine.graphStorage.getSyncState(trc, null, ['sharing', 'sharedNotes', guid]);
        if (!shareState || !shareState.authStr) {
            return;
        }
        const syncContext = SharedNoteSync_1.sharedNoteSyncContext(guid);
        this.curParams = {
            thriftComm: this.context.thriftComm,
            syncEngine: this.context.syncEngine,
            auth: Auth_1.decodeAuthData(shareState.authStr),
            personalAuth: this.context.syncManager.getAuth(),
            isVault: false,
            syncContext,
            syncStatePath: [syncContext, 'notestore'],
            personalUserID: this.context.syncEngine.getPersonalUserID(),
            vaultUserID: this.context.syncEngine.getVaultUserID(),
            chunkTimebox: CHUNK_TIMEBOX,
            yieldCheck: this.yieldCheck,
            localSettings: this.ibaseDI.getLocalSettings(),
            offlineContentStrategy: this.ibaseDI.getOfflineContentStrategy(),
            updateUser: this.ibaseDI.updateUser,
        };
        conduit_utils_1.logger.debug('syncSharedNote', guid);
        // Assuming current user is the owner if ownerId field is null by some reason
        const res = await conduit_utils_1.withError(SharedNoteSync_1.syncSharedNote(trc, this.curParams, shareState.noteStoreUrl, guid, shareState.ownerId || this.curParams.auth.userID));
        if (res.err) {
            if (res.err instanceof conduit_utils_1.AuthError) {
                res.err = await this.ibaseDI.handleAuthError(trc, res.err);
            }
            throw res.err;
        }
    }
}
exports.IncrementalSyncBaseActivity = IncrementalSyncBaseActivity;
class IncrementalSyncActivity extends IncrementalSyncBaseActivity {
    constructor(di, context, priority, subpriority = 0, timeout, withProgress) {
        super(di, context, {
            activityType: en_conduit_sync_types_1.SyncActivityType.IncrementalSyncActivity,
            priority,
            subpriority,
            // TODO use min of poll times in active sync contexts
            runAfter: Date.now() + (typeof timeout === 'number' ? timeout : (priority === en_conduit_sync_types_1.SyncActivityPriority.BACKGROUND ? 30000 : 0)),
        }, {
            priority,
            syncProgressTableName: withProgress ? en_conduit_sync_types_1.INITIAL_DOWNSYNC_PROGRESS_TABLE : null,
        });
        this.withProgress = withProgress;
    }
    get progressBucketSize() {
        return this.params.subpriority > 0 ? 5000 : 1000;
    }
    async runSyncImpl(trc) {
        try {
            // don't update syncProgressType if running during initial downsync.
            this.withProgress && this.params.priority !== en_conduit_sync_types_1.SyncActivityPriority.INITIAL_DOWNSYNC
                && await SyncHelpers_1.updateSyncProgressType(trc, this.context.syncEngine, conduit_view_types_1.SyncProgressType.INCREMENTAL_SYNC);
            await this.runIncrementalSync(trc);
        }
        finally {
            this.withProgress && this.params.priority !== en_conduit_sync_types_1.SyncActivityPriority.INITIAL_DOWNSYNC && await SyncHelpers_1.clearSyncProgress(trc, this.context.syncEngine);
        }
    }
    async runIncrementalSync(trc) {
        var _a, _b;
        const syncEngine = this.context.syncEngine;
        const auth = this.context.syncManager.getAuth();
        if (!auth) {
            throw new Error('Cannot downsync without auth');
        }
        const syncStartTime = Date.now();
        let offset = 0;
        // run incremental sync on all sync types
        // be carefull when changing order - make sure to setup right weights and offsets
        await this.yieldCheck;
        await this.syncMessages(trc, MESSAGE_SUBBUCKET_SIZE, offset);
        offset += MESSAGE_SUBBUCKET_SIZE;
        await this.yieldCheck;
        await this.syncNSync(trc, this.context.syncEventManager, NSYNC_SUBBUCKET_SIZE, offset);
        offset += NSYNC_SUBBUCKET_SIZE;
        const notesBucket = auth.vaultAuth ? NOTES_SUBBUCKET_SIZE / 2 : NOTES_SUBBUCKET_SIZE;
        await this.yieldCheck;
        await this.syncNotestore(trc, false, notesBucket, offset);
        offset += notesBucket;
        if (auth.vaultAuth) {
            await this.yieldCheck;
            await this.syncNotestore(trc, true, notesBucket, offset);
            offset += notesBucket;
        }
        await this.yieldCheck;
        const sharing = await syncEngine.graphStorage.getSyncState(trc, null, ['sharing']);
        const sharedNotebooks = (_a = sharing === null || sharing === void 0 ? void 0 : sharing.sharedNotebooks) !== null && _a !== void 0 ? _a : {};
        const sharedNotes = (_b = sharing === null || sharing === void 0 ? void 0 : sharing.sharedNotes) !== null && _b !== void 0 ? _b : {};
        for (const shareGuid in sharedNotebooks) {
            await this.yieldCheck;
            const res = await conduit_utils_1.withError(this.syncSharedNotebook(trc, shareGuid));
            if (res.err && !(res.err instanceof conduit_utils_1.RetryError)) {
                throw res.err;
            }
        }
        offset += SHAREDNOTEBOOKS_SUBUCKET_SIZE;
        await this.setProgress(trc, offset);
        for (const guidIter in sharedNotes) {
            await this.yieldCheck;
            const res = await conduit_utils_1.withError(this.syncSharedNote(trc, guidIter));
            if (res.err && !(res.err instanceof conduit_utils_1.RetryError)) {
                throw res.err;
            }
        }
        offset += SHAREDNOTES_SUBUCKET_SIZE;
        await this.setProgress(trc, offset);
        await this.context.syncEngine.graphStorage.transact(trc, 'updateSyncTime', async (tx) => {
            await tx.replaceSyncState(trc, ['lastSyncTime'], Date.now());
            await tx.replaceSyncState(trc, ['lastDownsyncStartTime'], syncStartTime);
        });
        await this.setProgress(trc, 1);
    }
}
exports.IncrementalSyncActivity = IncrementalSyncActivity;
function incrementalSyncActivityHydrator(di, context, p, timeout) {
    return new IncrementalSyncActivity(di, context, p.options.priority, p.subpriority, timeout);
}
exports.incrementalSyncActivityHydrator = incrementalSyncActivityHydrator;
//# sourceMappingURL=IncrementalSyncActivity.js.map