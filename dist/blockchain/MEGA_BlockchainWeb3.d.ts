/**
 * MEGA PHASE 13: BLOCKCHAIN & WEB3 INTEGRATION
 * Smart contracts, DeFi, NFT, Wallet integration, Chain indexing
 * Lines: 3500+
 */
import { EventEmitter } from 'events';
export interface BlockchainConfig {
    network: Network;
    consensus: ConsensusAlgorithm;
    blockTime: number;
    difficulty: number;
    maxBlockSize: number;
    rewardAmount: number;
}
export type Network = 'mainnet' | 'testnet' | 'devnet' | 'local';
export type ConsensusAlgorithm = 'pow' | 'pos' | 'poa' | 'dpos' | 'pbft';
export interface Block {
    index: number;
    timestamp: Date;
    transactions: Transaction[];
    previousHash: string;
    hash: string;
    nonce: number;
    difficulty: number;
    miner?: string;
    reward?: number;
    size: number;
}
export interface Transaction {
    id: string;
    from: string;
    to: string;
    amount: number;
    gas: number;
    gasPrice: number;
    nonce: number;
    data?: string;
    signature: string;
    timestamp: Date;
    status: TransactionStatus;
    blockNumber?: number;
    blockHash?: string;
}
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'dropped';
export interface Account {
    address: string;
    balance: number;
    nonce: number;
    code?: string;
    storage: Map<string, any>;
}
export declare class Blockchain extends EventEmitter {
    private config;
    private chain;
    private pendingTransactions;
    private accounts;
    private mining;
    constructor(config?: Partial<BlockchainConfig>);
    private createGenesisBlock;
    createTransaction(tx: Omit<Transaction, 'id' | 'signature' | 'timestamp' | 'status'>): Promise<Transaction>;
    private validateTransaction;
    private signTransaction;
    private verifySignature;
    mineBlock(minerAddress: string): Promise<Block>;
    private proofOfWork;
    private calculateHash;
    private executeTransaction;
    private rewardMiner;
    createAccount(address: string, initialBalance?: number): Account;
    getLatestBlock(): Block;
    getBalance(address: string): number;
    isValid(): boolean;
    private generateTxId;
    private sleep;
    getStats(): {
        blocks: number;
        pendingTransactions: number;
        accounts: number;
        totalSupply: number;
        isValid: boolean;
    };
}
export interface SmartContract {
    address: string;
    code: string;
    abi: ABI[];
    storage: Map<string, any>;
    creator: string;
    createdAt: Date;
    balance: number;
}
export interface ABI {
    name: string;
    type: ABIType;
    inputs: ABIParameter[];
    outputs: ABIParameter[];
    stateMutability: StateMutability;
}
export type ABIType = 'function' | 'constructor' | 'event' | 'fallback' | 'receive';
export interface ABIParameter {
    name: string;
    type: string;
    indexed?: boolean;
}
export type StateMutability = 'pure' | 'view' | 'nonpayable' | 'payable';
export interface ContractCall {
    id: string;
    contract: string;
    function: string;
    args: any[];
    from: string;
    value: number;
    gas: number;
    gasUsed: number;
    result?: any;
    events: ContractEvent[];
    status: CallStatus;
    timestamp: Date;
}
export type CallStatus = 'success' | 'revert' | 'out_of_gas';
export interface ContractEvent {
    name: string;
    args: Record<string, any>;
    blockNumber: number;
    transactionHash: string;
}
export declare class SmartContractEngine extends EventEmitter {
    private contracts;
    private calls;
    deploy(code: string, abi: ABI[], creator: string, args?: any[]): SmartContract;
    call(contractAddress: string, functionName: string, args: any[], from: string, value?: number, gas?: number): ContractCall;
    private executeFunction;
    private executeTransfer;
    private executeApprove;
    private executeBalanceOf;
    private generateAddress;
    private generateCallId;
    getStats(): {
        contracts: number;
        calls: number;
    };
}
export interface Wallet {
    address: string;
    publicKey: string;
    privateKey: string;
    mnemonic: string;
    hdPath: string;
    type: WalletType;
    createdAt: Date;
}
export type WalletType = 'hot' | 'cold' | 'hardware' | 'multisig';
export interface WalletBalance {
    address: string;
    native: number;
    tokens: TokenBalance[];
    nfts: NFTBalance[];
}
export interface TokenBalance {
    token: string;
    symbol: string;
    amount: number;
    decimals: number;
    usdValue?: number;
}
export interface NFTBalance {
    contract: string;
    tokenId: string;
    name: string;
    image: string;
    metadata: Record<string, any>;
}
export declare class WalletManager extends EventEmitter {
    private wallets;
    createWallet(type?: WalletType): Wallet;
    importWallet(privateKey: string, type?: WalletType): Wallet;
    recoverWallet(mnemonic: string): Wallet;
    signTransaction(address: string, tx: any): string;
    signMessage(address: string, message: string): string;
    private derivePublicKey;
    private deriveAddress;
    private generateMnemonic;
    private derivePrivateKeyFromMnemonic;
    getStats(): {
        wallets: number;
    };
}
export interface NFT {
    tokenId: string;
    contract: string;
    owner: string;
    creator: string;
    name: string;
    description: string;
    image: string;
    attributes: NFTAttribute[];
    metadata: Record<string, any>;
    mintedAt: Date;
}
export interface NFTAttribute {
    trait_type: string;
    value: string | number;
    display_type?: string;
}
export interface NFTListing {
    id: string;
    nft: NFT;
    seller: string;
    price: number;
    currency: string;
    listingType: ListingType;
    auction?: AuctionData;
    status: ListingStatus;
    createdAt: Date;
    expiresAt?: Date;
}
export type ListingType = 'fixed_price' | 'auction' | 'offer';
export interface AuctionData {
    startingPrice: number;
    reservePrice?: number;
    currentBid?: number;
    highestBidder?: string;
    bids: Bid[];
    endTime: Date;
}
export interface Bid {
    bidder: string;
    amount: number;
    timestamp: Date;
}
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export declare class NFTMarketplace extends EventEmitter {
    private nfts;
    private listings;
    mintNFT(metadata: Omit<NFT, 'tokenId' | 'mintedAt'>): NFT;
    listNFT(tokenId: string, seller: string, price: number, listingType?: ListingType, duration?: number): NFTListing;
    buyNFT(listingId: string, buyer: string): void;
    placeBid(listingId: string, bidder: string, amount: number): void;
    endAuction(listingId: string): void;
    private generateTokenId;
    private generateListingId;
    getStats(): {
        nfts: number;
        listings: number;
        activeListings: number;
    };
}
export declare class BlockchainWeb3System {
    blockchain: Blockchain;
    contracts: SmartContractEngine;
    wallet: WalletManager;
    nft: NFTMarketplace;
    constructor();
    getOverallStats(): {
        blockchain: {
            blocks: number;
            pendingTransactions: number;
            accounts: number;
            totalSupply: number;
            isValid: boolean;
        };
        contracts: {
            contracts: number;
            calls: number;
        };
        wallet: {
            wallets: number;
        };
        nft: {
            nfts: number;
            listings: number;
            activeListings: number;
        };
    };
}
//# sourceMappingURL=MEGA_BlockchainWeb3.d.ts.map