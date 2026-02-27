export const NOTIFICATION_TYPE_PRIORITIES = Object.entries({
    error: ['error'],
    success: ['success'],
    warning: ['warning']
})
    .map(([key, baseMatchers]) => ({key, baseMatchers}));
