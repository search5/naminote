"use strict";
/*!
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserMutators = exports.addUserRequestQueries = void 0;
const conduit_core_1 = require("conduit-core");
const conduit_view_types_1 = require("conduit-view-types");
const Auth_1 = require("../Auth");
const ThriftTypes_1 = require("../ThriftTypes");
const TSD_VARIATION_ENUM = [
    'DIALOG_VAR1',
    'FULLSCREEN1BUTTON_DISMISS',
    'FULLSCREEN1BUTTON_NODISMISS',
    'FULLSCREEN1BUTTON_TIERPATH',
    'FULLSCREEN1BUTTON_VAR2',
    'FULLSCREEN3BUTTONS_DEFAULT',
    'FULLSCREEN3BUTTONS_DISMISS',
    'FULLSCREEN3BUTTONS_NODISMISS',
    'FULLSCREEN3BUTTONS_BEFOREFLE',
    'MODAL_DEFAULT',
    'NOTIFICATION_ASPIRATIONAL',
    'NOTIFICATION_STORAGE',
    'SHEET_ASPIRATIONAL',
    'SHEET_STORAGE',
    'BANNER_LEARNMORE',
    'BANNER_UPGRADE',
    'FULLSCREEN_SINGLESDAY',
    'FULLSCREEN_DISCOUNT',
    'FULLSCREEN_NEWYEAR',
    'TEST_UNSUPPORTED',
];
const TSD_TYPE_THRIFT_TO_ENUM = {
    [ThriftTypes_1.TTsdType.REGULAR_TSD]: 'REGULAR_TSD',
    [ThriftTypes_1.TTsdType.TARGETED_UPSELL]: 'TARGETED_UPSELL',
};
const TSD_VARIATION_THRIFT_TO_ENUM = {
    [ThriftTypes_1.TTsdVariation.DIALOG_VAR1]: 'DIALOG_VAR1',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN1BUTTON_DISMISS]: 'FULLSCREEN1BUTTON_DISMISS',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN1BUTTON_NODISMISS]: 'FULLSCREEN1BUTTON_NODISMISS',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN1BUTTON_TIERPATH]: 'FULLSCREEN1BUTTON_TIERPATH',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN1BUTTON_VAR2]: 'FULLSCREEN1BUTTON_VAR2',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN3BUTTONS_DEFAULT]: 'FULLSCREEN3BUTTONS_DEFAULT',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN3BUTTONS_DISMISS]: 'FULLSCREEN3BUTTONS_DISMISS',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN3BUTTONS_NODISMISS]: 'FULLSCREEN3BUTTONS_NODISMISS',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN3BUTTONS_BEFOREFLE]: 'FULLSCREEN3BUTTONS_BEFOREFLE',
    [ThriftTypes_1.TTsdVariation.MODAL_DEFAULT]: 'MODAL_DEFAULT',
    [ThriftTypes_1.TTsdVariation.NOTIFICATION_ASPIRATIONAL]: 'NOTIFICATION_ASPIRATIONAL',
    [ThriftTypes_1.TTsdVariation.NOTIFICATION_STORAGE]: 'NOTIFICATION_STORAGE',
    [ThriftTypes_1.TTsdVariation.SHEET_ASPIRATIONAL]: 'SHEET_ASPIRATIONAL',
    [ThriftTypes_1.TTsdVariation.SHEET_STORAGE]: 'SHEET_STORAGE',
    [ThriftTypes_1.TTsdVariation.BANNER_LEARNMORE]: 'BANNER_LEARNMORE',
    [ThriftTypes_1.TTsdVariation.BANNER_UPGRADE]: 'BANNER_UPGRADE',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN_SINGLESDAY]: 'FULLSCREEN_SINGLESDAY',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN_DISCOUNT]: 'FULLSCREEN_DISCOUNT',
    [ThriftTypes_1.TTsdVariation.FULLSCREEN_NEWYEAR]: 'FULLSCREEN_NEWYEAR',
    [ThriftTypes_1.TTsdVariation.TEST_UNSUPPORTED]: 'TEST_UNSUPPORTED',
};
function addUserRequestQueries(thriftComm, out) {
    async function userGetTsdEligibilityResolver(parent, args, context) {
        conduit_core_1.validateDB(context);
        if (!args) {
            throw new Error('Lacking args');
        }
        const authState = await context.db.getAuthTokenAndState(context.trc, null);
        if (!authState || !authState.token || authState.state !== conduit_view_types_1.AuthState.Authorized) {
            throw new Error('Not logged in');
        }
        const auth = Auth_1.decodeAuthData(authState.token);
        const store = thriftComm.getUtilityStore(auth.urls.utilityUrl);
        const res = await store.getTsdEligibility(context.trc, auth.token, {
            numSessionsLast7Days: args.numSessionsLast7Days,
            numSessionsLast30Days: args.numSessionsLast30Days,
            numDaysActiveLast7Days: args.numDaysActiveLast7Days,
            numDaysActiveLast30Days: args.numDaysActiveLast30Days,
        });
        // note: can include more results here, but it looks like we don't actually use most of the other entries
        return {
            shouldShowTsd: res.shouldShowTsd,
            tsdType: (res.tsdType === null || res.tsdType === undefined) ? null : TSD_TYPE_THRIFT_TO_ENUM[res.tsdType],
            tsdVariation: (res.tsdVariation === null || res.tsdVariation === undefined) ? null : TSD_VARIATION_THRIFT_TO_ENUM[res.tsdVariation],
        };
    }
    out.userGetTsdEligibility = {
        type: conduit_core_1.schemaToGraphQLType({
            shouldShowTsd: 'boolean',
            tsdType: ['REGULAR_TSD', 'TARGETED_UPSELL', '?'],
            tsdVariation: [...TSD_VARIATION_ENUM, '?'],
        }, 'TierSelectionDisplayResult', false),
        args: conduit_core_1.schemaToGraphQLArgs({
            numSessionsLast7Days: 'int?',
            numSessionsLast30Days: 'int?',
            numDaysActiveLast7Days: 'int?',
            numDaysActiveLast30Days: 'int?',
        }),
        resolve: userGetTsdEligibilityResolver,
    };
}
exports.addUserRequestQueries = addUserRequestQueries;
function addUserMutators(thriftComm, out) {
    async function userAssociateWithOpenIDResolver(_, args, context) {
        conduit_core_1.validateDB(context);
        const authState = await context.db.getAuthTokenAndState(context.trc, null);
        if (!args) {
            throw new Error('No args');
        }
        if (!(authState === null || authState === void 0 ? void 0 : authState.token) || authState.state !== conduit_view_types_1.AuthState.Authorized) {
            throw new Error('Not currently logged in');
        }
        if (!args.tokenPayload) {
            throw new Error('No token payload');
        }
        let prov;
        if (!args.provider || Auth_1.SERVICE_PROVIDER_STRING_TO_ENUM[args.provider] === ThriftTypes_1.TServiceProvider.GOOGLE) {
            prov = ThriftTypes_1.TServiceProvider.GOOGLE;
        }
        else {
            throw new Error('Only google supported as service provider for now');
        }
        const credential = {
            tokenPayload: args.tokenPayload,
            serviceProvider: prov,
        };
        const auth = Auth_1.decodeAuthData(authState.token);
        const utilityStore = thriftComm.getUtilityStore(auth.urls.utilityUrl);
        await utilityStore.associateOpenIDWithUser(context.trc, auth.token, credential);
        return { success: true };
    }
    out.userAssociateWithOpenID = {
        args: conduit_core_1.schemaToGraphQLArgs({
            provider: Auth_1.SERVICE_PROVIDER_OPTIONAL_ENUM,
            tokenPayload: 'string',
        }),
        type: conduit_core_1.GenericMutationResult,
        resolve: userAssociateWithOpenIDResolver,
    };
}
exports.addUserMutators = addUserMutators;
//# sourceMappingURL=Users.js.map