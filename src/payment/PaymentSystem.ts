/**
 * Payment Processing System
 * Payment gateways, transactions, refunds, subscriptions, and fraud detection
 */

import { eventBus } from '../core/EventBus';

export interface PaymentGateway {
  id: string;
  name: string;
  type: GatewayType;
  config: GatewayConfig;
  status: GatewayStatus;
  statistics: GatewayStatistics;
  createdAt: Date;
}

export enum GatewayType {
  Stripe = 'stripe',
  PayPal = 'paypal',
  Square = 'square',
  Braintree = 'braintree',
  Adyen = 'adyen',
}

export interface GatewayConfig {
  apiKey: string;
  secretKey: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
  supportedCurrencies: string[];
  supportedPaymentMethods: PaymentMethod[];
}

export enum GatewayStatus {
  Active = 'active',
  Inactive = 'inactive',
  Maintenance = 'maintenance',
}

export interface GatewayStatistics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalAmount: number;
  averageTransactionAmount: number;
}

export interface Transaction {
  id: string;
  gatewayId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethod: PaymentMethodDetails;
  metadata: Record<string, any>;
  errorMessage?: string;
  gatewayTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  Payment = 'payment',
  Refund = 'refund',
  Authorization = 'authorization',
  Capture = 'capture',
  Void = 'void',
}

export enum TransactionStatus {
  Pending = 'pending',
  Processing = 'processing',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Canceled = 'canceled',
  RequiresAction = 'requires_action',
}

export interface PaymentMethodDetails {
  type: PaymentMethod;
  card?: CardDetails;
  bankAccount?: BankAccountDetails;
  wallet?: WalletDetails;
}

export enum PaymentMethod {
  Card = 'card',
  BankTransfer = 'bank_transfer',
  Wallet = 'wallet',
  Crypto = 'crypto',
}

export interface CardDetails {
  last4: string;
  brand: CardBrand;
  expiryMonth: number;
  expiryYear: number;
  fingerprint: string;
}

export enum CardBrand {
  Visa = 'visa',
  Mastercard = 'mastercard',
  Amex = 'amex',
  Discover = 'discover',
  JCB = 'jcb',
}

export interface BankAccountDetails {
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
}

export interface WalletDetails {
  provider: WalletProvider;
  walletId: string;
}

export enum WalletProvider {
  ApplePay = 'apple_pay',
  GooglePay = 'google_pay',
  PayPal = 'paypal',
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: Address;
  paymentMethods: SavedPaymentMethod[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SavedPaymentMethod {
  id: string;
  type: PaymentMethod;
  isDefault: boolean;
  details: PaymentMethodDetails;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum SubscriptionStatus {
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Unpaid = 'unpaid',
  Trialing = 'trialing',
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: BillingInterval;
  intervalCount: number;
  trialPeriodDays?: number;
  metadata: Record<string, any>;
  active: boolean;
  createdAt: Date;
}

export enum BillingInterval {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export interface Refund {
  id: string;
  transactionId: string;
  amount: number;
  reason?: string;
  status: RefundStatus;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum RefundStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Canceled = 'canceled',
}

export interface Dispute {
  id: string;
  transactionId: string;
  amount: number;
  reason: DisputeReason;
  status: DisputeStatus;
  evidence?: DisputeEvidence;
  dueDate?: Date;
  createdAt: Date;
}

export enum DisputeReason {
  Fraudulent = 'fraudulent',
  Duplicate = 'duplicate',
  ProductNotReceived = 'product_not_received',
  ProductUnacceptable = 'product_unacceptable',
  Other = 'other',
}

export enum DisputeStatus {
  NeedsResponse = 'needs_response',
  UnderReview = 'under_review',
  Won = 'won',
  Lost = 'lost',
}

export interface DisputeEvidence {
  customerName?: string;
  customerEmail?: string;
  customerPurchaseIp?: string;
  receipt?: string;
  shippingDocumentation?: string;
  description?: string;
}

export interface FraudCheck {
  id: string;
  transactionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  rules: FraudRule[];
  decision: FraudDecision;
  createdAt: Date;
}

export enum RiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum FraudDecision {
  Approve = 'approve',
  Review = 'review',
  Decline = 'decline',
}

export interface FraudRule {
  name: string;
  score: number;
  matched: boolean;
  reason?: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  status: PayoutStatus;
  arrivalDate?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

export enum PayoutStatus {
  Pending = 'pending',
  InTransit = 'in_transit',
  Paid = 'paid',
  Failed = 'failed',
  Canceled = 'canceled',
}

/**
 * Payment Gateway Manager
 */
export class PaymentGatewayManager {
  private gateways: Map<string, PaymentGateway> = new Map();

  /**
   * Register gateway
   */
  registerGateway(gateway: Omit<PaymentGateway, 'id' | 'statistics' | 'createdAt'>): PaymentGateway {
    const fullGateway: PaymentGateway = {
      ...gateway,
      id: this.generateGatewayId(),
      statistics: {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalAmount: 0,
        averageTransactionAmount: 0,
      },
      createdAt: new Date(),
    };

    this.gateways.set(fullGateway.id, fullGateway);

    eventBus.emitSync('payment.gateway_registered', fullGateway, 'PaymentGatewayManager');

    return fullGateway;
  }

  /**
   * Get gateway
   */
  getGateway(gatewayId: string): PaymentGateway | undefined {
    return this.gateways.get(gatewayId);
  }

  /**
   * List gateways
   */
  listGateways(filter?: { status?: GatewayStatus; type?: GatewayType }): PaymentGateway[] {
    let gateways = Array.from(this.gateways.values());

    if (filter?.status) {
      gateways = gateways.filter(g => g.status === filter.status);
    }

    if (filter?.type) {
      gateways = gateways.filter(g => g.type === filter.type);
    }

    return gateways;
  }

  /**
   * Update gateway status
   */
  updateGatewayStatus(gatewayId: string, status: GatewayStatus): void {
    const gateway = this.gateways.get(gatewayId);

    if (gateway) {
      gateway.status = status;
      eventBus.emitSync('payment.gateway_status_updated', { gatewayId, status }, 'PaymentGatewayManager');
    }
  }

  private generateGatewayId(): string {
    return `gw_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Transaction Manager
 */
export class TransactionManager {
  private transactions: Map<string, Transaction> = new Map();
  private gatewayManager: PaymentGatewayManager;

  constructor(gatewayManager: PaymentGatewayManager) {
    this.gatewayManager = gatewayManager;
  }

  /**
   * Create transaction
   */
  async createTransaction(
    gatewayId: string,
    transaction: Omit<Transaction, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    const gateway = this.gatewayManager.getGateway(gatewayId);

    if (!gateway) {
      throw new Error(`Gateway not found: ${gatewayId}`);
    }

    const fullTransaction: Transaction = {
      ...transaction,
      id: this.generateTransactionId(),
      status: TransactionStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(fullTransaction.id, fullTransaction);

    eventBus.emitSync('payment.transaction_created', fullTransaction, 'TransactionManager');

    // Process transaction
    await this.processTransaction(fullTransaction);

    return fullTransaction;
  }

  /**
   * Process transaction
   */
  async processTransaction(transaction: Transaction): Promise<void> {
    const gateway = this.gatewayManager.getGateway(transaction.gatewayId);

    if (!gateway) {
      throw new Error(`Gateway not found: ${transaction.gatewayId}`);
    }

    transaction.status = TransactionStatus.Processing;
    transaction.updatedAt = new Date();

    try {
      // Mock payment processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate success/failure
      const success = Math.random() > 0.1; // 90% success rate

      if (success) {
        transaction.status = TransactionStatus.Succeeded;
        transaction.gatewayTransactionId = `${gateway.type}_${Date.now()}`;

        gateway.statistics.successfulTransactions++;
        gateway.statistics.totalAmount += transaction.amount;
      } else {
        transaction.status = TransactionStatus.Failed;
        transaction.errorMessage = 'Payment declined';
        gateway.statistics.failedTransactions++;
      }

      gateway.statistics.totalTransactions++;
      gateway.statistics.averageTransactionAmount =
        gateway.statistics.totalAmount / gateway.statistics.successfulTransactions;

      transaction.updatedAt = new Date();

      eventBus.emitSync('payment.transaction_processed', transaction, 'TransactionManager');
    } catch (error) {
      transaction.status = TransactionStatus.Failed;
      transaction.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      transaction.updatedAt = new Date();
    }
  }

  /**
   * Get transaction
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * List transactions
   */
  listTransactions(filter?: {
    customerId?: string;
    status?: TransactionStatus;
    type?: TransactionType;
  }): Transaction[] {
    let transactions = Array.from(this.transactions.values());

    if (filter?.customerId) {
      transactions = transactions.filter(t => t.customerId === filter.customerId);
    }

    if (filter?.status) {
      transactions = transactions.filter(t => t.status === filter.status);
    }

    if (filter?.type) {
      transactions = transactions.filter(t => t.type === filter.type);
    }

    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);

    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (transaction.status !== TransactionStatus.Pending) {
      throw new Error(`Cannot cancel transaction with status: ${transaction.status}`);
    }

    transaction.status = TransactionStatus.Canceled;
    transaction.updatedAt = new Date();

    eventBus.emitSync('payment.transaction_canceled', transaction, 'TransactionManager');
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Customer Manager
 */
export class CustomerManager {
  private customers: Map<string, Customer> = new Map();

  /**
   * Create customer
   */
  createCustomer(customer: Omit<Customer, 'id' | 'paymentMethods' | 'createdAt'>): Customer {
    const fullCustomer: Customer = {
      ...customer,
      id: this.generateCustomerId(),
      paymentMethods: [],
      createdAt: new Date(),
    };

    this.customers.set(fullCustomer.id, fullCustomer);

    eventBus.emitSync('payment.customer_created', fullCustomer, 'CustomerManager');

    return fullCustomer;
  }

  /**
   * Add payment method
   */
  addPaymentMethod(customerId: string, paymentMethod: Omit<SavedPaymentMethod, 'id' | 'createdAt'>): SavedPaymentMethod {
    const customer = this.customers.get(customerId);

    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const fullPaymentMethod: SavedPaymentMethod = {
      ...paymentMethod,
      id: this.generatePaymentMethodId(),
      createdAt: new Date(),
    };

    // Set as default if it's the first payment method
    if (customer.paymentMethods.length === 0) {
      fullPaymentMethod.isDefault = true;
    }

    // If setting as default, unset other defaults
    if (fullPaymentMethod.isDefault) {
      customer.paymentMethods.forEach(pm => (pm.isDefault = false));
    }

    customer.paymentMethods.push(fullPaymentMethod);

    eventBus.emitSync('payment.payment_method_added', { customerId, paymentMethod: fullPaymentMethod }, 'CustomerManager');

    return fullPaymentMethod;
  }

  /**
   * Remove payment method
   */
  removePaymentMethod(customerId: string, paymentMethodId: string): void {
    const customer = this.customers.get(customerId);

    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const index = customer.paymentMethods.findIndex(pm => pm.id === paymentMethodId);

    if (index > -1) {
      customer.paymentMethods.splice(index, 1);
      eventBus.emitSync('payment.payment_method_removed', { customerId, paymentMethodId }, 'CustomerManager');
    }
  }

  /**
   * Get customer
   */
  getCustomer(customerId: string): Customer | undefined {
    return this.customers.get(customerId);
  }

  /**
   * List customers
   */
  listCustomers(): Customer[] {
    return Array.from(this.customers.values());
  }

  private generateCustomerId(): string {
    return `cus_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generatePaymentMethodId(): string {
    return `pm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Subscription Manager
 */
export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();
  private plans: Map<string, SubscriptionPlan> = new Map();

  /**
   * Create plan
   */
  createPlan(plan: Omit<SubscriptionPlan, 'id' | 'createdAt'>): SubscriptionPlan {
    const fullPlan: SubscriptionPlan = {
      ...plan,
      id: this.generatePlanId(),
      createdAt: new Date(),
    };

    this.plans.set(fullPlan.id, fullPlan);

    eventBus.emitSync('payment.plan_created', fullPlan, 'SubscriptionManager');

    return fullPlan;
  }

  /**
   * Create subscription
   */
  createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt'>): Subscription {
    const plan = this.plans.get(subscription.planId);

    if (!plan) {
      throw new Error(`Plan not found: ${subscription.planId}`);
    }

    const fullSubscription: Subscription = {
      ...subscription,
      id: this.generateSubscriptionId(),
      createdAt: new Date(),
    };

    this.subscriptions.set(fullSubscription.id, fullSubscription);

    eventBus.emitSync('payment.subscription_created', fullSubscription, 'SubscriptionManager');

    return fullSubscription;
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): void {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = SubscriptionStatus.Canceled;
    }

    eventBus.emitSync('payment.subscription_canceled', subscription, 'SubscriptionManager');
  }

  /**
   * Get subscription
   */
  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List subscriptions
   */
  listSubscriptions(filter?: { customerId?: string; status?: SubscriptionStatus }): Subscription[] {
    let subscriptions = Array.from(this.subscriptions.values());

    if (filter?.customerId) {
      subscriptions = subscriptions.filter(s => s.customerId === filter.customerId);
    }

    if (filter?.status) {
      subscriptions = subscriptions.filter(s => s.status === filter.status);
    }

    return subscriptions;
  }

  /**
   * Get plan
   */
  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * List plans
   */
  listPlans(filter?: { active?: boolean }): SubscriptionPlan[] {
    let plans = Array.from(this.plans.values());

    if (filter?.active !== undefined) {
      plans = plans.filter(p => p.active === filter.active);
    }

    return plans;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Refund Manager
 */
export class RefundManager {
  private refunds: Map<string, Refund> = new Map();
  private transactionManager: TransactionManager;

  constructor(transactionManager: TransactionManager) {
    this.transactionManager = transactionManager;
  }

  /**
   * Create refund
   */
  async createRefund(refund: Omit<Refund, 'id' | 'status' | 'createdAt'>): Promise<Refund> {
    const transaction = this.transactionManager.getTransaction(refund.transactionId);

    if (!transaction) {
      throw new Error(`Transaction not found: ${refund.transactionId}`);
    }

    if (transaction.status !== TransactionStatus.Succeeded) {
      throw new Error('Can only refund succeeded transactions');
    }

    const fullRefund: Refund = {
      ...refund,
      id: this.generateRefundId(),
      status: RefundStatus.Pending,
      createdAt: new Date(),
    };

    this.refunds.set(fullRefund.id, fullRefund);

    eventBus.emitSync('payment.refund_created', fullRefund, 'RefundManager');

    // Process refund
    await this.processRefund(fullRefund);

    return fullRefund;
  }

  /**
   * Process refund
   */
  async processRefund(refund: Refund): Promise<void> {
    // Mock refund processing
    await new Promise(resolve => setTimeout(resolve, 100));

    refund.status = RefundStatus.Succeeded;

    eventBus.emitSync('payment.refund_processed', refund, 'RefundManager');
  }

  /**
   * Get refund
   */
  getRefund(refundId: string): Refund | undefined {
    return this.refunds.get(refundId);
  }

  /**
   * List refunds
   */
  listRefunds(filter?: { transactionId?: string; status?: RefundStatus }): Refund[] {
    let refunds = Array.from(this.refunds.values());

    if (filter?.transactionId) {
      refunds = refunds.filter(r => r.transactionId === filter.transactionId);
    }

    if (filter?.status) {
      refunds = refunds.filter(r => r.status === filter.status);
    }

    return refunds.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private generateRefundId(): string {
    return `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Fraud Detection Manager
 */
export class FraudDetectionManager {
  private checks: Map<string, FraudCheck> = new Map();
  private rules: FraudRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Check transaction for fraud
   */
  async checkTransaction(transaction: Transaction): Promise<FraudCheck> {
    const check: FraudCheck = {
      id: this.generateCheckId(),
      transactionId: transaction.id,
      riskScore: 0,
      riskLevel: RiskLevel.Low,
      rules: [],
      decision: FraudDecision.Approve,
      createdAt: new Date(),
    };

    // Evaluate rules
    for (const rule of this.rules) {
      const matched = this.evaluateRule(rule, transaction);

      check.rules.push({
        ...rule,
        matched,
      });

      if (matched) {
        check.riskScore += rule.score;
      }
    }

    // Determine risk level and decision
    if (check.riskScore >= 80) {
      check.riskLevel = RiskLevel.Critical;
      check.decision = FraudDecision.Decline;
    } else if (check.riskScore >= 60) {
      check.riskLevel = RiskLevel.High;
      check.decision = FraudDecision.Review;
    } else if (check.riskScore >= 30) {
      check.riskLevel = RiskLevel.Medium;
      check.decision = FraudDecision.Review;
    } else {
      check.riskLevel = RiskLevel.Low;
      check.decision = FraudDecision.Approve;
    }

    this.checks.set(check.id, check);

    eventBus.emitSync('payment.fraud_check_completed', check, 'FraudDetectionManager');

    return check;
  }

  /**
   * Get fraud check
   */
  getFraudCheck(checkId: string): FraudCheck | undefined {
    return this.checks.get(checkId);
  }

  /**
   * List fraud checks
   */
  listFraudChecks(filter?: { riskLevel?: RiskLevel; decision?: FraudDecision }): FraudCheck[] {
    let checks = Array.from(this.checks.values());

    if (filter?.riskLevel) {
      checks = checks.filter(c => c.riskLevel === filter.riskLevel);
    }

    if (filter?.decision) {
      checks = checks.filter(c => c.decision === filter.decision);
    }

    return checks.sort((a, b) => b.riskScore - a.riskScore);
  }

  private evaluateRule(rule: FraudRule, transaction: Transaction): boolean {
    // Simple rule evaluation (mock)
    switch (rule.name) {
      case 'high_amount':
        return transaction.amount > 10000;

      case 'velocity':
        return false; // Would check transaction velocity

      case 'suspicious_location':
        return false; // Would check IP/location

      default:
        return false;
    }
  }

  private initializeDefaultRules(): void {
    this.rules = [
      { name: 'high_amount', score: 30, matched: false, reason: 'Transaction amount exceeds threshold' },
      { name: 'velocity', score: 40, matched: false, reason: 'Multiple transactions in short time' },
      { name: 'suspicious_location', score: 50, matched: false, reason: 'Transaction from high-risk location' },
    ];
  }

  private generateCheckId(): string {
    return `fraud_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Singleton instances
 */
export const paymentGatewayManager = new PaymentGatewayManager();
export const transactionManager = new TransactionManager(paymentGatewayManager);
export const customerManager = new CustomerManager();
export const subscriptionManager = new SubscriptionManager();
export const refundManager = new RefundManager(transactionManager);
export const fraudDetectionManager = new FraudDetectionManager();
