/**
 * Internationalization (i18n) System
 * Multi-language support, translation management, and locale handling
 */
export interface Locale {
    code: string;
    name: string;
    nativeName: string;
    direction: 'ltr' | 'rtl';
    pluralRules?: PluralRule[];
    dateFormat?: string;
    timeFormat?: string;
    currency?: string;
}
export interface PluralRule {
    count: number | 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
    form: string;
}
export interface Translation {
    key: string;
    locale: string;
    value: string;
    context?: string;
    metadata?: Record<string, any>;
}
export interface TranslationOptions {
    locale?: string;
    context?: string;
    params?: Record<string, any>;
    defaultValue?: string;
}
/**
 * I18n Manager
 */
export declare class I18nManager {
    private locales;
    private translations;
    private currentLocale;
    private fallbackLocale;
    constructor();
    /**
     * Register locale
     */
    registerLocale(locale: Locale): void;
    /**
     * Register translation
     */
    registerTranslation(key: string, locale: string, value: string, context?: string): void;
    /**
     * Register multiple translations
     */
    registerTranslations(locale: string, translations: Record<string, string>, context?: string): void;
    /**
     * Translate key
     */
    t(key: string, options?: TranslationOptions): string;
    /**
     * Translate with pluralization
     */
    tn(key: string, count: number, options?: TranslationOptions): string;
    /**
     * Set current locale
     */
    setLocale(locale: string): void;
    /**
     * Get current locale
     */
    getCurrentLocale(): string;
    /**
     * Get locale info
     */
    getLocale(code: string): Locale | undefined;
    /**
     * List available locales
     */
    listLocales(): Locale[];
    /**
     * Check if translation exists
     */
    hasTranslation(key: string, locale?: string, context?: string): boolean;
    /**
     * Get translation coverage
     */
    getCoverage(locale: string): {
        total: number;
        translated: number;
        percentage: number;
    };
    /**
     * Export translations
     */
    exportTranslations(locale: string, format?: 'json' | 'csv'): string;
    /**
     * Import translations from JSON
     */
    importTranslations(locale: string, data: Record<string, string>): void;
    private getTranslation;
    private getLocaleKey;
    private interpolate;
    private getPluralKey;
    private registerDefaultLocales;
}
/**
 * Date/Time Formatter
 */
export declare class DateTimeFormatter {
    /**
     * Format date according to locale
     */
    static formatDate(date: Date, locale: string, format?: string): string;
    /**
     * Format time according to locale
     */
    static formatTime(date: Date, locale: string): string;
    /**
     * Format date and time
     */
    static formatDateTime(date: Date, locale: string): string;
    /**
     * Format relative time
     */
    static formatRelative(date: Date, locale: string): string;
}
/**
 * Number Formatter
 */
export declare class NumberFormatter {
    /**
     * Format number according to locale
     */
    static formatNumber(value: number, locale: string, decimals?: number): string;
    /**
     * Format currency
     */
    static formatCurrency(value: number, locale: string, currency?: string): string;
    /**
     * Format percentage
     */
    static formatPercentage(value: number, locale: string, decimals?: number): string;
}
/**
 * Translation Service - helpers for common UI strings
 */
export declare class TranslationService {
    private i18n;
    constructor(i18n: I18nManager);
    /**
     * Register common UI translations
     */
    private registerCommonTranslations;
    /**
     * Get common translation helpers
     */
    common: {
        ok: () => string;
        cancel: () => string;
        save: () => string;
        delete: () => string;
        edit: () => string;
        close: () => string;
        loading: () => string;
        error: () => string;
        success: () => string;
        warning: () => string;
    };
    /**
     * Get error translation helpers
     */
    error: {
        notFound: () => string;
        unauthorized: () => string;
        serverError: () => string;
    };
    /**
     * Get validation translation helpers
     */
    validation: {
        required: () => string;
        email: () => string;
        minLength: (min: number) => string;
    };
}
/**
 * Singleton instances
 */
export declare const i18nManager: I18nManager;
export declare const translationService: TranslationService;
//# sourceMappingURL=I18n.d.ts.map