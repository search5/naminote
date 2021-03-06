"use strict";
/*!
 * Copyright 2020 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarEventNode = void 0;
const en_nsync_connector_1 = require("en-nsync-connector");
const getCalendarEventNode = async (trc, instance, context) => {
    const calendarEvent = en_nsync_connector_1.convertNsyncEntityToNode(instance, context);
    if (!calendarEvent) {
        return {};
    }
    return { nodes: { nodesToUpsert: [calendarEvent], nodesToDelete: [] } };
};
exports.getCalendarEventNode = getCalendarEventNode;
//# sourceMappingURL=CalendarEventConverter.js.map