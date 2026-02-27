export const THEME_PROPERTY_DEFINITIONS = [
    {
        key: 'multiConfig',
        code: 'M',
        accentClass: 'yellow-accent',
        popupCssClass: 'property-multi',
        labelKey: 'MULTI_CONFIG',
        tooltipCode: 'M',
        checkboxField: 'chkMulti'
    },
    {
        key: 'desktopPlus',
        code: 'D+',
        accentClass: 'blue-accent',
        popupCssClass: 'property-desktop-plus',
        labelKey: 'DESKTOP_PLUS',
        tooltipCode: 'D+',
        checkboxField: 'chkDesktopPlus'
    },
    {
        key: 'familiar',
        code: 'F',
        accentClass: 'green-accent',
        popupCssClass: 'property-familiar',
        labelKey: 'FAMILIAR',
        tooltipCode: 'F',
        checkboxField: 'chkFamiliar'
    },
    {
        key: 'widgets',
        code: 'W',
        accentClass: 'purple-accent',
        popupCssClass: 'property-widgets',
        labelKey: 'WIDGETS_ADDITIONAL',
        tooltipCode: 'W',
        checkboxField: 'chkWidgets'
    },
    {
        key: 'unique',
        code: 'U',
        accentClass: 'red-accent',
        popupCssClass: 'property-unique',
        labelKey: 'UNIQUE',
        tooltipCode: 'U',
        checkboxField: 'chkUnique'
    }
];

const createBadgeMap = (definitions) => definitions.reduce((acc, d) => {
    acc[d.key] = { code: d.code, accentClass: d.accentClass, tooltipCode: d.tooltipCode };
    return acc;
}, {});

export const THEME_PROPERTY_FLAGS = THEME_PROPERTY_DEFINITIONS.map(d => d.key);

export const THEME_PROPERTY_BADGES_BY_KEY = createBadgeMap(THEME_PROPERTY_DEFINITIONS);
