/**
 * Internationalization (i18n) System
 * Multi-language support, translation management, and locale handling
 */

import { eventBus } from '../core/EventBus';

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
export class I18nManager {
  private locales: Map<string, Locale> = new Map();
  private translations: Map<string, Map<string, Translation>> = new Map();
  private currentLocale = 'en';
  private fallbackLocale = 'en';

  constructor() {
    this.registerDefaultLocales();
  }

  /**
   * Register locale
   */
  registerLocale(locale: Locale): void {
    this.locales.set(locale.code, locale);
    eventBus.emitSync('i18n.locale_registered', locale, 'I18nManager');
  }

  /**
   * Register translation
   */
  registerTranslation(key: string, locale: string, value: string, context?: string): void {
    const localeKey = this.getLocaleKey(locale, context);

    if (!this.translations.has(localeKey)) {
      this.translations.set(localeKey, new Map());
    }

    const translation: Translation = {
      key,
      locale,
      value,
      context,
    };

    this.translations.get(localeKey)!.set(key, translation);
  }

  /**
   * Register multiple translations
   */
  registerTranslations(locale: string, translations: Record<string, string>, context?: string): void {
    for (const [key, value] of Object.entries(translations)) {
      this.registerTranslation(key, locale, value, context);
    }

    eventBus.emitSync('i18n.translations_registered', { locale, count: Object.keys(translations).length }, 'I18nManager');
  }

  /**
   * Translate key
   */
  t(key: string, options?: TranslationOptions): string {
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
  tn(key: string, count: number, options?: TranslationOptions): string {
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
  setLocale(locale: string): void {
    if (!this.locales.has(locale)) {
      throw new Error(`Locale not registered: ${locale}`);
    }

    this.currentLocale = locale;
    eventBus.emitSync('i18n.locale_changed', { locale }, 'I18nManager');
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): string {
    return this.currentLocale;
  }

  /**
   * Get locale info
   */
  getLocale(code: string): Locale | undefined {
    return this.locales.get(code);
  }

  /**
   * List available locales
   */
  listLocales(): Locale[] {
    return Array.from(this.locales.values());
  }

  /**
   * Check if translation exists
   */
  hasTranslation(key: string, locale?: string, context?: string): boolean {
    const loc = locale || this.currentLocale;
    return this.getTranslation(key, loc, context) !== undefined;
  }

  /**
   * Get translation coverage
   */
  getCoverage(locale: string): {
    total: number;
    translated: number;
    percentage: number;
  } {
    const baseKeys = new Set<string>();
    const localeKeys = new Set<string>();

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
  exportTranslations(locale: string, format: 'json' | 'csv' = 'json'): string {
    const translations = this.translations.get(this.getLocaleKey(locale));

    if (!translations) {
      return format === 'json' ? '{}' : '';
    }

    if (format === 'json') {
      const obj: Record<string, string> = {};
      for (const [key, translation] of translations) {
        obj[key] = translation.value;
      }
      return JSON.stringify(obj, null, 2);
    } else {
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
  importTranslations(locale: string, data: Record<string, string>): void {
    this.registerTranslations(locale, data);
  }

  private getTranslation(key: string, locale: string, context?: string): Translation | undefined {
    const localeKey = this.getLocaleKey(locale, context);
    return this.translations.get(localeKey)?.get(key);
  }

  private getLocaleKey(locale: string, context?: string): string {
    return context ? `${locale}:${context}` : locale;
  }

  private interpolate(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
    });
  }

  private getPluralKey(key: string, count: number, locale: string): string {
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

  private registerDefaultLocales(): void {
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

/**
 * Date/Time Formatter
 */
export class DateTimeFormatter {
  /**
   * Format date according to locale
   */
  static formatDate(date: Date, locale: string, format?: string): string {
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
  static formatTime(date: Date, locale: string): string {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (locale === 'en') {
      const hours12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hours12}:${minutes} ${ampm}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  }

  /**
   * Format date and time
   */
  static formatDateTime(date: Date, locale: string): string {
    return `${this.formatDate(date, locale)} ${this.formatTime(date, locale)}`;
  }

  /**
   * Format relative time
   */
  static formatRelative(date: Date, locale: string): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    // Simple English relative time
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    return this.formatDate(date, locale);
  }
}

/**
 * Number Formatter
 */
export class NumberFormatter {
  /**
   * Format number according to locale
   */
  static formatNumber(value: number, locale: string, decimals = 2): string {
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
  static formatCurrency(value: number, locale: string, currency?: string): string {
    const formatted = this.formatNumber(value, locale, 2);

    const currencySymbols: Record<string, string> = {
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
    } else {
      return `${symbol}${formatted}`;
    }
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, locale: string, decimals = 1): string {
    return `${this.formatNumber(value, locale, decimals)}%`;
  }
}

/**
 * Translation Service - helpers for common UI strings
 */
export class TranslationService {
  constructor(private i18n: I18nManager) {
    this.registerCommonTranslations();
  }

  /**
   * Register common UI translations
   */
  private registerCommonTranslations(): void {
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
    minLength: (min: number) => this.i18n.t('validation.min_length', { params: { min } }),
  };
}

/**
 * Singleton instances
 */
export const i18nManager = new I18nManager();
export const translationService = new TranslationService(i18nManager);
