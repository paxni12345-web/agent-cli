/**
 * Advanced Blockchain Integration System
 * Smart contract interaction, wallet management, transaction signing
 * Multi-chain support, DeFi protocols, NFT operations
 */
import { EventEmitter } from 'events';
export interface BlockchainConfig {
    defaultChain: BlockchainNetwork;
    rpcEndpoints: Record<BlockchainNetwork, string>;
    enableCaching: boolean;
    transactionTimeout: number;
    gasLimit: number;
    maxGasPrice: string;
    confirmationBlocks: number;
}
export type BlockchainNetwork = 'ethereum' | 'polygon' | 'bsc' | 'avalanche' | 'arbitrum' | 'optimism' | 'solana' | 'bitcoin';
export interface Wallet {
    id: string;
    address: string;
    type: WalletType;
    network: BlockchainNetwork;
    balance: string;
    tokens: TokenBalance[];
    nfts: NFT[];
    metadata: WalletMetadata;
}
export type WalletType = 'hot' | 'cold' | 'hardware' | 'multisig';
export interface TokenBalance {
    token: Token;
    balance: string;
    balanceUSD?: number;
    price?: number;
    priceChange24h?: number;
}
export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    chainId: number;
    logoURI?: string;
    verified: boolean;
}
export interface NFT {
    tokenId: string;
    contractAddress: string;
    name: string;
    description?: string;
    image?: string;
    metadata?: Record<string, any>;
    owner: string;
    collection: NFTCollection;
}
export interface NFTCollection {
    address: string;
    name: string;
    symbol: string;
    totalSupply: number;
    floorPrice?: string;
    verified: boolean;
}
export interface WalletMetadata {
    label?: string;
    tags: string[];
    createdAt: number;
    lastUsed: number;
}
export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    data?: string;
    nonce: number;
    gasLimit: string;
    gasPrice: string;
    chainId: number;
    status: TransactionStatus;
    blockNumber?: number;
    blockHash?: string;
    confirmations: number;
    timestamp?: number;
    receipt?: TransactionReceipt;
}
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';
export interface TransactionReceipt {
    transactionHash: string;
    blockNumber: number;
    blockHash: string;
    gasUsed: string;
    effectiveGasPrice: string;
    status: boolean;
    logs: Log[];
    contractAddress?: string;
}
export interface Log {
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
}
export interface SmartContract {
    address: string;
    abi: any[];
    network: BlockchainNetwork;
    name: string;
    verified: boolean;
    deployedAt?: number;
    compiler?: string;
    optimization?: boolean;
}
export interface ContractCall {
    contract: SmartContract;
    method: string;
    params: any[];
    value?: string;
    gasLimit?: string;
}
export interface ContractEvent {
    name: string;
    signature: string;
    inputs: EventInput[];
    data: Record<string, any>;
    transactionHash: string;
    blockNumber: number;
    logIndex: number;
}
export interface EventInput {
    name: string;
    type: string;
    indexed: boolean;
}
export interface Block {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    nonce: string;
    difficulty: string;
    gasLimit: string;
    gasUsed: string;
    miner: string;
    transactions: string[];
    transactionCount: number;
}
export interface DeFiProtocol {
    id: string;
    name: string;
    type: ProtocolType;
    network: BlockchainNetwork;
    contracts: string[];
    tvl?: string;
    apy?: number;
    verified: boolean;
}
export type ProtocolType = 'dex' | 'lending' | 'staking' | 'yield_farming' | 'liquidity_pool' | 'bridge';
export interface LiquidityPool {
    address: string;
    protocol: string;
    token0: Token;
    token1: Token;
    reserve0: string;
    reserve1: string;
    totalSupply: string;
    fee: number;
    volume24h?: string;
    apy?: number;
}
export interface SwapRoute {
    path: string[];
    amountIn: string;
    amountOut: string;
    priceImpact: number;
    fee: string;
    protocols: string[];
}
export interface StakingPosition {
    id: string;
    protocol: string;
    token: Token;
    amount: string;
    rewards: string;
    apy: number;
    startTime: number;
    lockupPeriod?: number;
    autoCompound: boolean;
}
export interface LendingPosition {
    id: string;
    protocol: string;
    type: 'supply' | 'borrow';
    token: Token;
    amount: string;
    apy: number;
    collateralFactor?: number;
    healthFactor?: number;
}
export interface Bridge {
    id: string;
    name: string;
    sourceChain: BlockchainNetwork;
    targetChain: BlockchainNetwork;
    supportedTokens: Token[];
    fee: number;
    estimatedTime: number;
    verified: boolean;
}
export interface BridgeTransfer {
    id: string;
    bridge: string;
    sourceChain: BlockchainNetwork;
    targetChain: BlockchainNetwork;
    token: Token;
    amount: string;
    from: string;
    to: string;
    status: BridgeStatus;
    sourceTx?: string;
    targetTx?: string;
    estimatedCompletion?: number;
}
export type BridgeStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface GasEstimate {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    totalCost: string;
    totalCostUSD?: number;
}
export interface TokenPrice {
    address: string;
    price: number;
    priceUSD: number;
    change24h: number;
    volume24h: number;
    marketCap?: number;
    source: string;
    timestamp: number;
}
export declare class BlockchainManager extends EventEmitter {
    private config;
    private wallets;
    private contracts;
    private transactions;
    private protocols;
    private stakingPositions;
    private lendingPositions;
    private bridgeTransfers;
    private priceCache;
    constructor(config?: Partial<BlockchainConfig>);
    createWallet(type: WalletType, network: BlockchainNetwork): Promise<Wallet>;
    importWallet(privateKey: string, network: BlockchainNetwork): Promise<Wallet>;
    getBalance(walletId: string, tokenAddress?: string): Promise<string>;
    getTokenBalances(walletId: string): Promise<TokenBalance[]>;
    sendTransaction(from: string, to: string, value: string, data?: string): Promise<Transaction>;
    private simulateTransactionConfirmation;
    getTransaction(txHash: string): Promise<Transaction | undefined>;
    waitForTransaction(txHash: string, confirmations?: number): Promise<TransactionReceipt>;
    registerContract(contract: Omit<SmartContract, 'deployedAt'>): SmartContract;
    callContract(call: ContractCall): Promise<any>;
    sendContractTransaction(call: ContractCall): Promise<Transaction>;
    private encodeContractCall;
    private simulateContractCall;
    watchContractEvents(contractAddress: string, eventName: string, callback: (event: ContractEvent) => void): Promise<void>;
    registerProtocol(protocol: Omit<DeFiProtocol, 'id'>): DeFiProtocol;
    swapTokens(from: Token, to: Token, amountIn: string, slippage?: number): Promise<SwapRoute>;
    private findBestSwapRoute;
    private calculatePriceImpact;
    stake(protocol: string, token: Token, amount: string, lockupPeriod?: number): Promise<StakingPosition>;
    unstake(positionId: string): Promise<void>;
    supply(protocol: string, token: Token, amount: string): Promise<LendingPosition>;
    borrow(protocol: string, token: Token, amount: string): Promise<LendingPosition>;
    bridgeTokens(bridge: string, token: Token, amount: string, from: string, to: string, targetChain: BlockchainNetwork): Promise<BridgeTransfer>;
    private simulateBridgeTransfer;
    getNFTs(walletId: string): Promise<NFT[]>;
    mintNFT(collection: string, metadata: Record<string, any>): Promise<NFT>;
    transferNFT(nft: NFT, from: string, to: string): Promise<Transaction>;
    private encodeNFTTransfer;
    estimateGas(transaction: Partial<Transaction>): Promise<GasEstimate>;
    getTokenPrice(tokenAddress: string): Promise<TokenPrice>;
    getBlock(blockNumber: number): Promise<Block>;
    getLatestBlock(): Promise<Block>;
    private startBlockchainMonitoring;
    private updateWalletBalances;
    private updateStakingRewards;
    private checkPendingTransactions;
    private generateId;
    private generateAddress;
    private generateTxHash;
    private generateBlockHash;
    private getChainId;
    private delay;
    getStats(): BlockchainStats;
}
interface BlockchainStats {
    wallets: number;
    contracts: number;
    transactions: number;
    pendingTransactions: number;
    protocols: number;
    stakingPositions: number;
    lendingPositions: number;
    bridgeTransfers: number;
}
export default BlockchainManager;
//# sourceMappingURL=BlockchainManager.d.ts.map