"use strict";
/**
 * Internationalization (i18n) System
 * Multi-language support, translation management, and locale handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationService = exports.i18nManager = exports.TranslationService = exports.NumberFormatter = exports.DateTimeFormatter = exports.I18nManager = void 0;
const EventBus_1 = require("../core/EventBus");
/**
 * I18n Manager
 */
class I18nManager {
    locales = new Map();
    translations = new Map();
    currentLocale = 'en';
    fallbackLocale = 'en';
    constructor() {
        this.registerDefaultLocales();
    }
    /**
     * Register locale
     */
    registerLocale(locale) {
        this.locales.set(locale.code, locale);
        EventBus_1.eventBus.emitSync('i18n.locale_registered', locale, 'I18nManager');
    }
    /**
     * Register translation
     */
    registerTranslation(key, locale, value, context) {
        const localeKey = this.getLocaleKey(locale, context);
        if (!this.translations.has(localeKey)) {
            this.translations.set(localeKey, new Map());
        }
        const translation = {
            key,
            locale,
            value,
            context,
        };
        this.translations.get(localeKey).set(key, translation);
    }
    /**
     * Register multiple translations
     */
    registerTranslations(locale, translations, context) {
        for (const [key, value] of Object.entries(translations)) {
            this.registerTranslation(key, locale, value, context);
        }
        EventBus_1.eventBus.emitSync('i18n.translations_registered', { locale, count: Object.keys(translations).length }, 'I18nManager');
    }
    /**
     * Translate key
     */
    t(key, options) {
        const locale = options?.locale || this.currentLocale;
        const context = options?.context;
        // Try to get translation
        let translation = this.getTranslation(key, locale, context);
        // Fallback to default locale
        if (!translation && locale !== this.fallbackLocale) {
            translation = this.getTranslation(key, this.fallbackLocale, context);
        }
        let result = translation?.value || options?.defaultValue || key;
        // Apply parameters
        if (options?.params) {
            result = this.interpolate(result, options.params);
        }
        return result;
    }
    /**
     * Translate with pluralization
     */
    tn(key, count, options) {
        const locale = options?.locale || this.currentLocale;
        const pluralKey = this.getPluralKey(key, count, locale);
        return this.t(pluralKey, {
            ...options,
            params: { ...options?.params, count },
        });
    }
    /**
     * Set current locale
     */
    setLocale(locale) {
        if (!this.locales.has(locale)) {
            throw new Error(`Locale not registered: ${locale}`);
        }
        this.currentLocale = locale;
        EventBus_1.eventBus.emitSync('i18n.locale_changed', { locale }, 'I18nManager');
    }
    /**
     * Get current locale
     */
    getCurrentLocale() {
        return this.currentLocale;
    }
    /**
     * Get locale info
     */
    getLocale(code) {
        return this.locales.get(code);
    }
    /**
     * List available locales
     */
    listLocales() {
        return Array.from(this.locales.values());
    }
    /**
     * Check if translation exists
     */
    hasTranslation(key, locale, context) {
        const loc = locale || this.currentLocale;
        return this.getTranslation(key, loc, context) !== undefined;
    }
    /**
     * Get translation coverage
     */
    getCoverage(locale) {
        const baseKeys = new Set();
        const localeKeys = new Set();
        // Get all keys from fallback locale
        const fallbackTranslations = this.translations.get(this.getLocaleKey(this.fallbackLocale));
        if (fallbackTranslations) {
            for (const key of fallbackTranslations.keys()) {
                baseKeys.add(key);
            }
        }
        // Get translated keys for target locale
        const localeTranslations = this.translations.get(this.getLocaleKey(locale));
        if (localeTranslations) {
            for (const key of localeTranslations.keys()) {
                if (baseKeys.has(key)) {
                    localeKeys.add(key);
                }
            }
        }
        const total = baseKeys.size;
        const translated = localeKeys.size;
        return {
            total,
            translated,
            percentage: total > 0 ? (translated / total) * 100 : 0,
        };
    }
    /**
     * Export translations
     */
    exportTranslations(locale, format = 'json') {
        const translations = this.translations.get(this.getLocaleKey(locale));
        if (!translations) {
            return format === 'json' ? '{}' : '';
        }
        if (format === 'json') {
            const obj = {};
            for (const [key, translation] of translations) {
                obj[key] = translation.value;
            }
            return JSON.stringify(obj, null, 2);
        }
        else {
            let csv = 'key,value\n';
            for (const [key, translation] of translations) {
                csv += `"${key}","${translation.value}"\n`;
            }
            return csv;
        }
    }
    /**
     * Import translations from JSON
     */
    importTranslations(locale, data) {
        this.registerTranslations(locale, data);
    }
    getTranslation(key, locale, context) {
        const localeKey = this.getLocaleKey(locale, context);
        return this.translations.get(localeKey)?.get(key);
    }
    getLocaleKey(locale, context) {
        return context ? `${locale}:${context}` : locale;
    }
    interpolate(text, params) {
        return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
        });
    }
    getPluralKey(key, count, locale) {
        const localeInfo = this.locales.get(locale);
        if (!localeInfo?.pluralRules) {
            // Simple English plural rules
            return count === 1 ? `${key}.one` : `${key}.other`;
        }
        // Apply locale-specific plural rules
        for (const rule of localeInfo.pluralRules) {
            if (typeof rule.count === 'number' && count === rule.count) {
                return `${key}.${rule.form}`;
            }
        }
        return `${key}.other`;
    }
    registerDefaultLocales() {
        this.registerLocale({
            code: 'en',
            name: 'English',
            nativeName: 'English',
            direction: 'ltr',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: 'hh:mm A',
            currency: 'USD',
        });
        this.registerLocale({
            code: 'th',
            name: 'Thai',
            nativeName: 'ไทย',
            direction: 'ltr',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: 'HH:mm',
            currency: 'THB',
        });
        this.registerLocale({
            code: 'ja',
            name: 'Japanese',
            nativeName: '日本語',
            direction: 'ltr',
            dateFormat: 'YYYY/MM/DD',
            timeFormat: 'HH:mm',
            currency: 'JPY',
        });
        this.registerLocale({
            code: 'zh',
            name: 'Chinese',
            nativeName: '中文',
            direction: 'ltr',
            dateFormat: 'YYYY-MM-DD',
            timeFormat: 'HH:mm',
            currency: 'CNY',
        });
        this.registerLocale({
            code: 'ar',
            name: 'Arabic',
            nativeName: 'العربية',
            direction: 'rtl',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: 'HH:mm',
            currency: 'SAR',
        });
    }
}
exports.I18nManager = I18nManager;
/**
 * Date/Time Formatter
 */
class DateTimeFormatter {
    /**
     * Format date according to locale
     */
    static formatDate(date, locale, format) {
        // Mock implementation
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        switch (locale) {
            case 'en':
                return `${month}/${day}/${year}`;
            case 'th':
            case 'ar':
                return `${day}/${month}/${year}`;
            case 'ja':
            case 'zh':
                return `${year}/${month}/${day}`;
            default:
                return `${year}-${month}-${day}`;
        }
    }
    /**
     * Format time according to locale
     */
    static formatTime(date, locale) {
        const hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        if (locale === 'en') {
            const hours12 = hours % 12 || 12;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            return `${hours12}:${minutes} ${ampm}`;
        }
        else {
            return `${hours.toString().padStart(2, '0')}:${minutes}`;
        }
    }
    /**
     * Format date and time
     */
    static formatDateTime(date, locale) {
        return `${this.formatDate(date, locale)} ${this.formatTime(date, locale)}`;
    }
    /**
     * Format relative time
     */
    static formatRelative(date, locale) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        // Simple English relative time
        if (diffSec < 60)
            return 'just now';
        if (diffMin < 60)
            return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24)
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffDay < 7)
            return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        return this.formatDate(date, locale);
    }
}
exports.DateTimeFormatter = DateTimeFormatter;
/**
 * Number Formatter
 */
class NumberFormatter {
    /**
     * Format number according to locale
     */
    static formatNumber(value, locale, decimals = 2) {
        const fixed = value.toFixed(decimals);
        switch (locale) {
            case 'en':
                return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            case 'th':
            case 'ja':
            case 'zh':
                return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            case 'ar':
                return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
            default:
                return fixed;
        }
    }
    /**
     * Format currency
     */
    static formatCurrency(value, locale, currency) {
        const formatted = this.formatNumber(value, locale, 2);
        const currencySymbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CNY: '¥',
            THB: '฿',
            SAR: 'ر.س',
        };
        const symbol = currencySymbols[currency || 'USD'] || currency || '$';
        if (locale === 'ar') {
            return `${formatted} ${symbol}`;
        }
        else {
            return `${symbol}${formatted}`;
        }
    }
    /**
     * Format percentage
     */
    static formatPercentage(value, locale, decimals = 1) {
        return `${this.formatNumber(value, locale, decimals)}%`;
    }
}
exports.NumberFormatter = NumberFormatter;
/**
 * Translation Service - helpers for common UI strings
 */
class TranslationService {
    i18n;
    constructor(i18n) {
        this.i18n = i18n;
        this.registerCommonTranslations();
    }
    /**
     * Register common UI translations
     */
    registerCommonTranslations() {
        // English
        this.i18n.registerTranslations('en', {
            'common.ok': 'OK',
            'common.cancel': 'Cancel',
            'common.save': 'Save',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.close': 'Close',
            'common.loading': 'Loading...',
            'common.error': 'Error',
            'common.success': 'Success',
            'common.warning': 'Warning',
            'error.not_found': 'Not found',
            'error.unauthorized': 'Unauthorized',
            'error.server_error': 'Server error',
            'validation.required': 'This field is required',
            'validation.email': 'Invalid email address',
            'validation.min_length': 'Minimum length is {{min}} characters',
        });
        // Thai
        this.i18n.registerTranslations('th', {
            'common.ok': 'ตกลง',
            'common.cancel': 'ยกเลิก',
            'common.save': 'บันทึก',
            'common.delete': 'ลบ',
            'common.edit': 'แก้ไข',
            'common.close': 'ปิด',
            'common.loading': 'กำลังโหลด...',
            'common.error': 'ข้อผิดพลาด',
            'common.success': 'สำเร็จ',
            'common.warning': 'คำเตือน',
            'error.not_found': 'ไม่พบข้อมูล',
            'error.unauthorized': 'ไม่มีสิทธิ์เข้าถึง',
            'error.server_error': 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์',
            'validation.required': 'กรุณากรอกข้อมูลในช่องนี้',
            'validation.email': 'รูปแบบอีเมลไม่ถูกต้อง',
            'validation.min_length': 'ต้องมีอักขระอย่างน้อย {{min}} ตัว',
        });
        // Japanese
        this.i18n.registerTranslations('ja', {
            'common.ok': 'OK',
            'common.cancel': 'キャンセル',
            'common.save': '保存',
            'common.delete': '削除',
            'common.edit': '編集',
            'common.close': '閉じる',
            'common.loading': '読み込み中...',
            'common.error': 'エラー',
            'common.success': '成功',
            'common.warning': '警告',
            'error.not_found': '見つかりません',
            'error.unauthorized': '権限がありません',
            'error.server_error': 'サーバーエラー',
            'validation.required': 'この項目は必須です',
            'validation.email': 'メールアドレスの形式が正しくありません',
            'validation.min_length': '最小{{min}}文字必要です',
        });
    }
    /**
     * Get common translation helpers
     */
    common = {
        ok: () => this.i18n.t('common.ok'),
        cancel: () => this.i18n.t('common.cancel'),
        save: () => this.i18n.t('common.save'),
        delete: () => this.i18n.t('common.delete'),
        edit: () => this.i18n.t('common.edit'),
        close: () => this.i18n.t('common.close'),
        loading: () => this.i18n.t('common.loading'),
        error: () => this.i18n.t('common.error'),
        success: () => this.i18n.t('common.success'),
        warning: () => this.i18n.t('common.warning'),
    };
    /**
     * Get error translation helpers
     */
    error = {
        notFound: () => this.i18n.t('error.not_found'),
        unauthorized: () => this.i18n.t('error.unauthorized'),
        serverError: () => this.i18n.t('error.server_error'),
    };
    /**
     * Get validation translation helpers
     */
    validation = {
        required: () => this.i18n.t('validation.required'),
        email: () => this.i18n.t('validation.email'),
        minLength: (min) => this.i18n.t('validation.min_length', { params: { min } }),
    };
}
exports.TranslationService = TranslationService;
/**
 * Singleton instances
 */
exports.i18nManager = new I18nManager();
exports.translationService = new TranslationService(exports.i18nManager);
