/**
 * Payment Processing System
 * Payment gateways, transactions, refunds, subscriptions, and fraud detection
 */
export interface PaymentGateway {
    id: string;
    name: string;
    type: GatewayType;
    config: GatewayConfig;
    status: GatewayStatus;
    statistics: GatewayStatistics;
    createdAt: Date;
}
export declare enum GatewayType {
    Stripe = "stripe",
    PayPal = "paypal",
    Square = "square",
    Braintree = "braintree",
    Adyen = "adyen"
}
export interface GatewayConfig {
    apiKey: string;
    secretKey: string;
    webhookSecret?: string;
    environment: 'sandbox' | 'production';
    supportedCurrencies: string[];
    supportedPaymentMethods: PaymentMethod[];
}
export declare enum GatewayStatus {
    Active = "active",
    Inactive = "inactive",
    Maintenance = "maintenance"
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
export declare enum TransactionType {
    Payment = "payment",
    Refund = "refund",
    Authorization = "authorization",
    Capture = "capture",
    Void = "void"
}
export declare enum TransactionStatus {
    Pending = "pending",
    Processing = "processing",
    Succeeded = "succeeded",
    Failed = "failed",
    Canceled = "canceled",
    RequiresAction = "requires_action"
}
export interface PaymentMethodDetails {
    type: PaymentMethod;
    card?: CardDetails;
    bankAccount?: BankAccountDetails;
    wallet?: WalletDetails;
}
export declare enum PaymentMethod {
    Card = "card",
    BankTransfer = "bank_transfer",
    Wallet = "wallet",
    Crypto = "crypto"
}
export interface CardDetails {
    last4: string;
    brand: CardBrand;
    expiryMonth: number;
    expiryYear: number;
    fingerprint: string;
}
export declare enum CardBrand {
    Visa = "visa",
    Mastercard = "mastercard",
    Amex = "amex",
    Discover = "discover",
    JCB = "jcb"
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
export declare enum WalletProvider {
    ApplePay = "apple_pay",
    GooglePay = "google_pay",
    PayPal = "paypal"
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
export declare enum SubscriptionStatus {
    Active = "active",
    PastDue = "past_due",
    Canceled = "canceled",
    Unpaid = "unpaid",
    Trialing = "trialing"
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
export declare enum BillingInterval {
    Day = "day",
    Week = "week",
    Month = "month",
    Year = "year"
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
export declare enum RefundStatus {
    Pending = "pending",
    Succeeded = "succeeded",
    Failed = "failed",
    Canceled = "canceled"
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
export declare enum DisputeReason {
    Fraudulent = "fraudulent",
    Duplicate = "duplicate",
    ProductNotReceived = "product_not_received",
    ProductUnacceptable = "product_unacceptable",
    Other = "other"
}
export declare enum DisputeStatus {
    NeedsResponse = "needs_response",
    UnderReview = "under_review",
    Won = "won",
    Lost = "lost"
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
export declare enum RiskLevel {
    Low = "low",
    Medium = "medium",
    High = "high",
    Critical = "critical"
}
export declare enum FraudDecision {
    Approve = "approve",
    Review = "review",
    Decline = "decline"
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
export declare enum PayoutStatus {
    Pending = "pending",
    InTransit = "in_transit",
    Paid = "paid",
    Failed = "failed",
    Canceled = "canceled"
}
/**
 * Payment Gateway Manager
 */
export declare class PaymentGatewayManager {
    private gateways;
    /**
     * Register gateway
     */
    registerGateway(gateway: Omit<PaymentGateway, 'id' | 'statistics' | 'createdAt'>): PaymentGateway;
    /**
     * Get gateway
     */
    getGateway(gatewayId: string): PaymentGateway | undefined;
    /**
     * List gateways
     */
    listGateways(filter?: {
        status?: GatewayStatus;
        type?: GatewayType;
    }): PaymentGateway[];
    /**
     * Update gateway status
     */
    updateGatewayStatus(gatewayId: string, status: GatewayStatus): void;
    private generateGatewayId;
}
/**
 * Transaction Manager
 */
export declare class TransactionManager {
    private transactions;
    private gatewayManager;
    constructor(gatewayManager: PaymentGatewayManager);
    /**
     * Create transaction
     */
    createTransaction(gatewayId: string, transaction: Omit<Transaction, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Transaction>;
    /**
     * Process transaction
     */
    processTransaction(transaction: Transaction): Promise<void>;
    /**
     * Get transaction
     */
    getTransaction(transactionId: string): Transaction | undefined;
    /**
     * List transactions
     */
    listTransactions(filter?: {
        customerId?: string;
        status?: TransactionStatus;
        type?: TransactionType;
    }): Transaction[];
    /**
     * Cancel transaction
     */
    cancelTransaction(transactionId: string): Promise<void>;
    private generateTransactionId;
}
/**
 * Customer Manager
 */
export declare class CustomerManager {
    private customers;
    /**
     * Create customer
     */
    createCustomer(customer: Omit<Customer, 'id' | 'paymentMethods' | 'createdAt'>): Customer;
    /**
     * Add payment method
     */
    addPaymentMethod(customerId: string, paymentMethod: Omit<SavedPaymentMethod, 'id' | 'createdAt'>): SavedPaymentMethod;
    /**
     * Remove payment method
     */
    removePaymentMethod(customerId: string, paymentMethodId: string): void;
    /**
     * Get customer
     */
    getCustomer(customerId: string): Customer | undefined;
    /**
     * List customers
     */
    listCustomers(): Customer[];
    private generateCustomerId;
    private generatePaymentMethodId;
}
/**
 * Subscription Manager
 */
export declare class SubscriptionManager {
    private subscriptions;
    private plans;
    /**
     * Create plan
     */
    createPlan(plan: Omit<SubscriptionPlan, 'id' | 'createdAt'>): SubscriptionPlan;
    /**
     * Create subscription
     */
    createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt'>): Subscription;
    /**
     * Cancel subscription
     */
    cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): void;
    /**
     * Get subscription
     */
    getSubscription(subscriptionId: string): Subscription | undefined;
    /**
     * List subscriptions
     */
    listSubscriptions(filter?: {
        customerId?: string;
        status?: SubscriptionStatus;
    }): Subscription[];
    /**
     * Get plan
     */
    getPlan(planId: string): SubscriptionPlan | undefined;
    /**
     * List plans
     */
    listPlans(filter?: {
        active?: boolean;
    }): SubscriptionPlan[];
    private generatePlanId;
    private generateSubscriptionId;
}
/**
 * Refund Manager
 */
export declare class RefundManager {
    private refunds;
    private transactionManager;
    constructor(transactionManager: TransactionManager);
    /**
     * Create refund
     */
    createRefund(refund: Omit<Refund, 'id' | 'status' | 'createdAt'>): Promise<Refund>;
    /**
     * Process refund
     */
    processRefund(refund: Refund): Promise<void>;
    /**
     * Get refund
     */
    getRefund(refundId: string): Refund | undefined;
    /**
     * List refunds
     */
    listRefunds(filter?: {
        transactionId?: string;
        status?: RefundStatus;
    }): Refund[];
    private generateRefundId;
}
/**
 * Fraud Detection Manager
 */
export declare class FraudDetectionManager {
    private checks;
    private rules;
    constructor();
    /**
     * Check transaction for fraud
     */
    checkTransaction(transaction: Transaction): Promise<FraudCheck>;
    /**
     * Get fraud check
     */
    getFraudCheck(checkId: string): FraudCheck | undefined;
    /**
     * List fraud checks
     */
    listFraudChecks(filter?: {
        riskLevel?: RiskLevel;
        decision?: FraudDecision;
    }): FraudCheck[];
    private evaluateRule;
    private initializeDefaultRules;
    private generateCheckId;
}
/**
 * Singleton instances
 */
export declare const paymentGatewayManager: PaymentGatewayManager;
export declare const transactionManager: TransactionManager;
export declare const customerManager: CustomerManager;
export declare const subscriptionManager: SubscriptionManager;
export declare const refundManager: RefundManager;
export declare const fraudDetectionManager: FraudDetectionManager;
//# sourceMappingURL=PaymentSystem.d.ts.map