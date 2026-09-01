"use strict";
/**
 * Payment Processing System
 * Payment gateways, transactions, refunds, subscriptions, and fraud detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fraudDetectionManager = exports.refundManager = exports.subscriptionManager = exports.customerManager = exports.transactionManager = exports.paymentGatewayManager = exports.FraudDetectionManager = exports.RefundManager = exports.SubscriptionManager = exports.CustomerManager = exports.TransactionManager = exports.PaymentGatewayManager = exports.PayoutStatus = exports.FraudDecision = exports.RiskLevel = exports.DisputeStatus = exports.DisputeReason = exports.RefundStatus = exports.BillingInterval = exports.SubscriptionStatus = exports.WalletProvider = exports.CardBrand = exports.PaymentMethod = exports.TransactionStatus = exports.TransactionType = exports.GatewayStatus = exports.GatewayType = void 0;
const EventBus_1 = require("../core/EventBus");
var GatewayType;
(function (GatewayType) {
    GatewayType["Stripe"] = "stripe";
    GatewayType["PayPal"] = "paypal";
    GatewayType["Square"] = "square";
    GatewayType["Braintree"] = "braintree";
    GatewayType["Adyen"] = "adyen";
})(GatewayType || (exports.GatewayType = GatewayType = {}));
var GatewayStatus;
(function (GatewayStatus) {
    GatewayStatus["Active"] = "active";
    GatewayStatus["Inactive"] = "inactive";
    GatewayStatus["Maintenance"] = "maintenance";
})(GatewayStatus || (exports.GatewayStatus = GatewayStatus = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["Payment"] = "payment";
    TransactionType["Refund"] = "refund";
    TransactionType["Authorization"] = "authorization";
    TransactionType["Capture"] = "capture";
    TransactionType["Void"] = "void";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["Pending"] = "pending";
    TransactionStatus["Processing"] = "processing";
    TransactionStatus["Succeeded"] = "succeeded";
    TransactionStatus["Failed"] = "failed";
    TransactionStatus["Canceled"] = "canceled";
    TransactionStatus["RequiresAction"] = "requires_action";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["Card"] = "card";
    PaymentMethod["BankTransfer"] = "bank_transfer";
    PaymentMethod["Wallet"] = "wallet";
    PaymentMethod["Crypto"] = "crypto";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var CardBrand;
(function (CardBrand) {
    CardBrand["Visa"] = "visa";
    CardBrand["Mastercard"] = "mastercard";
    CardBrand["Amex"] = "amex";
    CardBrand["Discover"] = "discover";
    CardBrand["JCB"] = "jcb";
})(CardBrand || (exports.CardBrand = CardBrand = {}));
var WalletProvider;
(function (WalletProvider) {
    WalletProvider["ApplePay"] = "apple_pay";
    WalletProvider["GooglePay"] = "google_pay";
    WalletProvider["PayPal"] = "paypal";
})(WalletProvider || (exports.WalletProvider = WalletProvider = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["Active"] = "active";
    SubscriptionStatus["PastDue"] = "past_due";
    SubscriptionStatus["Canceled"] = "canceled";
    SubscriptionStatus["Unpaid"] = "unpaid";
    SubscriptionStatus["Trialing"] = "trialing";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var BillingInterval;
(function (BillingInterval) {
    BillingInterval["Day"] = "day";
    BillingInterval["Week"] = "week";
    BillingInterval["Month"] = "month";
    BillingInterval["Year"] = "year";
})(BillingInterval || (exports.BillingInterval = BillingInterval = {}));
var RefundStatus;
(function (RefundStatus) {
    RefundStatus["Pending"] = "pending";
    RefundStatus["Succeeded"] = "succeeded";
    RefundStatus["Failed"] = "failed";
    RefundStatus["Canceled"] = "canceled";
})(RefundStatus || (exports.RefundStatus = RefundStatus = {}));
var DisputeReason;
(function (DisputeReason) {
    DisputeReason["Fraudulent"] = "fraudulent";
    DisputeReason["Duplicate"] = "duplicate";
    DisputeReason["ProductNotReceived"] = "product_not_received";
    DisputeReason["ProductUnacceptable"] = "product_unacceptable";
    DisputeReason["Other"] = "other";
})(DisputeReason || (exports.DisputeReason = DisputeReason = {}));
var DisputeStatus;
(function (DisputeStatus) {
    DisputeStatus["NeedsResponse"] = "needs_response";
    DisputeStatus["UnderReview"] = "under_review";
    DisputeStatus["Won"] = "won";
    DisputeStatus["Lost"] = "lost";
})(DisputeStatus || (exports.DisputeStatus = DisputeStatus = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["Low"] = "low";
    RiskLevel["Medium"] = "medium";
    RiskLevel["High"] = "high";
    RiskLevel["Critical"] = "critical";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
var FraudDecision;
(function (FraudDecision) {
    FraudDecision["Approve"] = "approve";
    FraudDecision["Review"] = "review";
    FraudDecision["Decline"] = "decline";
})(FraudDecision || (exports.FraudDecision = FraudDecision = {}));
var PayoutStatus;
(function (PayoutStatus) {
    PayoutStatus["Pending"] = "pending";
    PayoutStatus["InTransit"] = "in_transit";
    PayoutStatus["Paid"] = "paid";
    PayoutStatus["Failed"] = "failed";
    PayoutStatus["Canceled"] = "canceled";
})(PayoutStatus || (exports.PayoutStatus = PayoutStatus = {}));
/**
 * Payment Gateway Manager
 */
class PaymentGatewayManager {
    gateways = new Map();
    /**
     * Register gateway
     */
    registerGateway(gateway) {
        const fullGateway = {
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
        EventBus_1.eventBus.emitSync('payment.gateway_registered', fullGateway, 'PaymentGatewayManager');
        return fullGateway;
    }
    /**
     * Get gateway
     */
    getGateway(gatewayId) {
        return this.gateways.get(gatewayId);
    }
    /**
     * List gateways
     */
    listGateways(filter) {
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
    updateGatewayStatus(gatewayId, status) {
        const gateway = this.gateways.get(gatewayId);
        if (gateway) {
            gateway.status = status;
            EventBus_1.eventBus.emitSync('payment.gateway_status_updated', { gatewayId, status }, 'PaymentGatewayManager');
        }
    }
    generateGatewayId() {
        return `gw_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.PaymentGatewayManager = PaymentGatewayManager;
/**
 * Transaction Manager
 */
class TransactionManager {
    transactions = new Map();
    gatewayManager;
    constructor(gatewayManager) {
        this.gatewayManager = gatewayManager;
    }
    /**
     * Create transaction
     */
    async createTransaction(gatewayId, transaction) {
        const gateway = this.gatewayManager.getGateway(gatewayId);
        if (!gateway) {
            throw new Error(`Gateway not found: ${gatewayId}`);
        }
        const fullTransaction = {
            ...transaction,
            id: this.generateTransactionId(),
            status: TransactionStatus.Pending,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.transactions.set(fullTransaction.id, fullTransaction);
        EventBus_1.eventBus.emitSync('payment.transaction_created', fullTransaction, 'TransactionManager');
        // Process transaction
        await this.processTransaction(fullTransaction);
        return fullTransaction;
    }
    /**
     * Process transaction
     */
    async processTransaction(transaction) {
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
            }
            else {
                transaction.status = TransactionStatus.Failed;
                transaction.errorMessage = 'Payment declined';
                gateway.statistics.failedTransactions++;
            }
            gateway.statistics.totalTransactions++;
            gateway.statistics.averageTransactionAmount =
                gateway.statistics.totalAmount / gateway.statistics.successfulTransactions;
            transaction.updatedAt = new Date();
            EventBus_1.eventBus.emitSync('payment.transaction_processed', transaction, 'TransactionManager');
        }
        catch (error) {
            transaction.status = TransactionStatus.Failed;
            transaction.errorMessage = error instanceof Error ? error.message : 'Unknown error';
            transaction.updatedAt = new Date();
        }
    }
    /**
     * Get transaction
     */
    getTransaction(transactionId) {
        return this.transactions.get(transactionId);
    }
    /**
     * List transactions
     */
    listTransactions(filter) {
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
    async cancelTransaction(transactionId) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction not found: ${transactionId}`);
        }
        if (transaction.status !== TransactionStatus.Pending) {
            throw new Error(`Cannot cancel transaction with status: ${transaction.status}`);
        }
        transaction.status = TransactionStatus.Canceled;
        transaction.updatedAt = new Date();
        EventBus_1.eventBus.emitSync('payment.transaction_canceled', transaction, 'TransactionManager');
    }
    generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.TransactionManager = TransactionManager;
/**
 * Customer Manager
 */
class CustomerManager {
    customers = new Map();
    /**
     * Create customer
     */
    createCustomer(customer) {
        const fullCustomer = {
            ...customer,
            id: this.generateCustomerId(),
            paymentMethods: [],
            createdAt: new Date(),
        };
        this.customers.set(fullCustomer.id, fullCustomer);
        EventBus_1.eventBus.emitSync('payment.customer_created', fullCustomer, 'CustomerManager');
        return fullCustomer;
    }
    /**
     * Add payment method
     */
    addPaymentMethod(customerId, paymentMethod) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            throw new Error(`Customer not found: ${customerId}`);
        }
        const fullPaymentMethod = {
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
        EventBus_1.eventBus.emitSync('payment.payment_method_added', { customerId, paymentMethod: fullPaymentMethod }, 'CustomerManager');
        return fullPaymentMethod;
    }
    /**
     * Remove payment method
     */
    removePaymentMethod(customerId, paymentMethodId) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            throw new Error(`Customer not found: ${customerId}`);
        }
        const index = customer.paymentMethods.findIndex(pm => pm.id === paymentMethodId);
        if (index > -1) {
            customer.paymentMethods.splice(index, 1);
            EventBus_1.eventBus.emitSync('payment.payment_method_removed', { customerId, paymentMethodId }, 'CustomerManager');
        }
    }
    /**
     * Get customer
     */
    getCustomer(customerId) {
        return this.customers.get(customerId);
    }
    /**
     * List customers
     */
    listCustomers() {
        return Array.from(this.customers.values());
    }
    generateCustomerId() {
        return `cus_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generatePaymentMethodId() {
        return `pm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.CustomerManager = CustomerManager;
/**
 * Subscription Manager
 */
class SubscriptionManager {
    subscriptions = new Map();
    plans = new Map();
    /**
     * Create plan
     */
    createPlan(plan) {
        const fullPlan = {
            ...plan,
            id: this.generatePlanId(),
            createdAt: new Date(),
        };
        this.plans.set(fullPlan.id, fullPlan);
        EventBus_1.eventBus.emitSync('payment.plan_created', fullPlan, 'SubscriptionManager');
        return fullPlan;
    }
    /**
     * Create subscription
     */
    createSubscription(subscription) {
        const plan = this.plans.get(subscription.planId);
        if (!plan) {
            throw new Error(`Plan not found: ${subscription.planId}`);
        }
        const fullSubscription = {
            ...subscription,
            id: this.generateSubscriptionId(),
            createdAt: new Date(),
        };
        this.subscriptions.set(fullSubscription.id, fullSubscription);
        EventBus_1.eventBus.emitSync('payment.subscription_created', fullSubscription, 'SubscriptionManager');
        return fullSubscription;
    }
    /**
     * Cancel subscription
     */
    cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription not found: ${subscriptionId}`);
        }
        if (cancelAtPeriodEnd) {
            subscription.cancelAtPeriodEnd = true;
        }
        else {
            subscription.status = SubscriptionStatus.Canceled;
        }
        EventBus_1.eventBus.emitSync('payment.subscription_canceled', subscription, 'SubscriptionManager');
    }
    /**
     * Get subscription
     */
    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }
    /**
     * List subscriptions
     */
    listSubscriptions(filter) {
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
    getPlan(planId) {
        return this.plans.get(planId);
    }
    /**
     * List plans
     */
    listPlans(filter) {
        let plans = Array.from(this.plans.values());
        if (filter?.active !== undefined) {
            plans = plans.filter(p => p.active === filter.active);
        }
        return plans;
    }
    generatePlanId() {
        return `plan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.SubscriptionManager = SubscriptionManager;
/**
 * Refund Manager
 */
class RefundManager {
    refunds = new Map();
    transactionManager;
    constructor(transactionManager) {
        this.transactionManager = transactionManager;
    }
    /**
     * Create refund
     */
    async createRefund(refund) {
        const transaction = this.transactionManager.getTransaction(refund.transactionId);
        if (!transaction) {
            throw new Error(`Transaction not found: ${refund.transactionId}`);
        }
        if (transaction.status !== TransactionStatus.Succeeded) {
            throw new Error('Can only refund succeeded transactions');
        }
        const fullRefund = {
            ...refund,
            id: this.generateRefundId(),
            status: RefundStatus.Pending,
            createdAt: new Date(),
        };
        this.refunds.set(fullRefund.id, fullRefund);
        EventBus_1.eventBus.emitSync('payment.refund_created', fullRefund, 'RefundManager');
        // Process refund
        await this.processRefund(fullRefund);
        return fullRefund;
    }
    /**
     * Process refund
     */
    async processRefund(refund) {
        // Mock refund processing
        await new Promise(resolve => setTimeout(resolve, 100));
        refund.status = RefundStatus.Succeeded;
        EventBus_1.eventBus.emitSync('payment.refund_processed', refund, 'RefundManager');
    }
    /**
     * Get refund
     */
    getRefund(refundId) {
        return this.refunds.get(refundId);
    }
    /**
     * List refunds
     */
    listRefunds(filter) {
        let refunds = Array.from(this.refunds.values());
        if (filter?.transactionId) {
            refunds = refunds.filter(r => r.transactionId === filter.transactionId);
        }
        if (filter?.status) {
            refunds = refunds.filter(r => r.status === filter.status);
        }
        return refunds.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    generateRefundId() {
        return `refund_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.RefundManager = RefundManager;
/**
 * Fraud Detection Manager
 */
class FraudDetectionManager {
    checks = new Map();
    rules = [];
    constructor() {
        this.initializeDefaultRules();
    }
    /**
     * Check transaction for fraud
     */
    async checkTransaction(transaction) {
        const check = {
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
        }
        else if (check.riskScore >= 60) {
            check.riskLevel = RiskLevel.High;
            check.decision = FraudDecision.Review;
        }
        else if (check.riskScore >= 30) {
            check.riskLevel = RiskLevel.Medium;
            check.decision = FraudDecision.Review;
        }
        else {
            check.riskLevel = RiskLevel.Low;
            check.decision = FraudDecision.Approve;
        }
        this.checks.set(check.id, check);
        EventBus_1.eventBus.emitSync('payment.fraud_check_completed', check, 'FraudDetectionManager');
        return check;
    }
    /**
     * Get fraud check
     */
    getFraudCheck(checkId) {
        return this.checks.get(checkId);
    }
    /**
     * List fraud checks
     */
    listFraudChecks(filter) {
        let checks = Array.from(this.checks.values());
        if (filter?.riskLevel) {
            checks = checks.filter(c => c.riskLevel === filter.riskLevel);
        }
        if (filter?.decision) {
            checks = checks.filter(c => c.decision === filter.decision);
        }
        return checks.sort((a, b) => b.riskScore - a.riskScore);
    }
    evaluateRule(rule, transaction) {
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
    initializeDefaultRules() {
        this.rules = [
            { name: 'high_amount', score: 30, matched: false, reason: 'Transaction amount exceeds threshold' },
            { name: 'velocity', score: 40, matched: false, reason: 'Multiple transactions in short time' },
            { name: 'suspicious_location', score: 50, matched: false, reason: 'Transaction from high-risk location' },
        ];
    }
    generateCheckId() {
        return `fraud_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.FraudDetectionManager = FraudDetectionManager;
/**
 * Singleton instances
 */
exports.paymentGatewayManager = new PaymentGatewayManager();
exports.transactionManager = new TransactionManager(exports.paymentGatewayManager);
exports.customerManager = new CustomerManager();
exports.subscriptionManager = new SubscriptionManager();
exports.refundManager = new RefundManager(exports.transactionManager);
exports.fraudDetectionManager = new FraudDetectionManager();
