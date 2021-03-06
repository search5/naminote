"use strict";
/*!
 * Copyright 2020 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTaskReminder = exports.extractTaskReminderData = exports.extractTaskReminderBody = void 0;
const conduit_utils_1 = require("conduit-utils");
const en_tasks_data_model_1 = require("en-tasks-data-model");
const ScheduledNotificationConstants_1 = require("../../ScheduledNotificationConstants");
const ScheduledNotificationUtils_1 = require("../../ScheduledNotificationUtils");
const const_1 = require("../shared/const");
const locale_1 = require("../shared/locale");
function extractTaskReminderBody(task, locale = const_1.DEFAULT_LOCALE) {
    if (!task || !task.NodeFields || !task.NodeFields.dueDate) {
        return '';
    }
    const addDueCopyIfNeeded = (dueDateString, locale) => {
        return locale === 'en' ? `Due ${dueDateString}` : dueDateString;
    };
    switch (task.NodeFields.dueDateUIOption) {
        case en_tasks_data_model_1.DueDateUIOption.date_only:
            return addDueCopyIfNeeded(locale_1.getLocalizedYearMonth(task.NodeFields.dueDate, locale), locale);
        case en_tasks_data_model_1.DueDateUIOption.date_time:
            return addDueCopyIfNeeded(locale_1.getLocalizedYearMonthHour(task.NodeFields.dueDate, locale), locale);
        case null:
        default:
            return '';
    }
}
exports.extractTaskReminderBody = extractTaskReminderBody;
const extractTaskReminderData = (id, updated, reminder, task, locale = const_1.DEFAULT_LOCALE) => {
    const title = task ? (task.label || 'Untitled Task') : ''; // TODO(droth) is this for all falsy task labels?
    const taskID = task ? task.id : '';
    const sendAt = (reminder === null || reminder === void 0 ? void 0 : reminder.NodeFields.reminderDate) || 0;
    const body = extractTaskReminderBody(task, locale);
    if (!task) {
        conduit_utils_1.logger.info(`taskID is not set for reminder ${reminder === null || reminder === void 0 ? void 0 : reminder.id}`);
    }
    return {
        notification: {
            id,
            title,
            body,
            clickNotificationActionTarget: taskID,
            clickNotificationActionName: ScheduledNotificationConstants_1.NotificationActionNames.NavigateToTask,
        },
        sendAt,
        updated,
    };
};
exports.extractTaskReminderData = extractTaskReminderData;
const extractTaskReminder = async (trc, graphDB, notificationEntity) => {
    const refs = ScheduledNotificationUtils_1.getDependencyRefsForSN(notificationEntity);
    if (!refs) {
        conduit_utils_1.logger.warn(`Cannot get notification data for notification ID ${notificationEntity.id}. Graph edges for dependencies are missing. Aborting`);
        return null;
    }
    const user = await graphDB.getNodeWithoutGraphQLContext(trc, const_1.UserRef);
    if (!user) {
        conduit_utils_1.logger.warn(`Cannot get user for notification ID ${notificationEntity.id}. Aborting`);
        return null;
    }
    let dataSourceEntity = null;
    const schedulingEntity = await graphDB.getNodeWithoutGraphQLContext(trc, refs.schedulingRef);
    if (refs.schedulingRef.id !== refs.dataSourceRef.id) {
        dataSourceEntity = await graphDB.getNodeWithoutGraphQLContext(trc, refs.dataSourceRef);
    }
    const notificationData = exports.extractTaskReminderData(notificationEntity.id, notificationEntity.NodeFields.updated, schedulingEntity, dataSourceEntity, locale_1.getUserLocale(user));
    return notificationData;
};
exports.extractTaskReminder = extractTaskReminder;
//# sourceMappingURL=index.js.map