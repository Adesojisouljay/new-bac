import { ethers } from 'ethers';
import {
    PublicKey,
    Transaction,
    SystemProgram,
    Keypair,
    TransactionInstruction
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { Buffer } from 'buffer';
// @ts-ignore
import bs58 from 'bs58';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { TronWeb } from 'tronweb';
import { Account, Ed25519PrivateKey, Aptos, AptosConfig, Network, generateSignedTransaction } from "@aptos-labs/ts-sdk";

const ECPair = ECPairFactory(ecc);

const DOGE_NETWORK: bitcoin.Network = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge', // Required by bitcoinjs-lib Network type, though not widely used for Dogecoin native segwit.
    bip32: {
        public: 0x02facafd,
        private: 0x02fac398
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e
};

const LTC_NETWORK: bitcoin.Network = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: {
        public: 0x019da462,
        private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
};

export interface DogeTxParams {
    from: string;
    to: string;
    amount: number; // in DOGE
    utxos: Array<{
        txid: string;
        vout: number;
        value: number; // in satoshis
        nonWitnessUtxo?: string;
    }>;
    feeRate: number; // absolute fee in DOGE
}

export interface LtcTxParams {
    from: string;
    to: string;
    amount: number; // in LTC
    utxos: Array<{
        txid: string;
        vout: number;
        value: number; // in satoshis
        nonWitnessUtxo?: string;
    }>;
    feeRate: number;
}

export interface EthTxParams {
    to: string;
    value: string; // in wei
    nonce: number;
    gasLimit: string;
    gasPrice: string;
    chainId: number;
    data?: string; // Optional data for contract calls (e.g. ERC20 transfer)
}

export interface SolTxParams {
    from: string;
    to: string;
    amount: number; // in SOL
    recentBlockhash: string;
}

export interface SolTokenTxParams {
    from: string;
    to: string;
    amount: number;
    mintAddress: string;
    recentBlockhash: string;
    ataExists?: boolean;
}

export interface BtcTxParams {
    from: string;
    to: string;
    amount: number; // in BTC
    utxos: Array<{
        txid: string;
        vout: number;
        value: number; // in satoshis
        nonWitnessUtxo?: string;
        witnessUtxo?: {
            script: string;
            value: number;
        };
    }>;
    feeRate: number;
}

export interface TronTxParams {
    to: string;
    amount: number; // in TRX
    // Tron transaction object from backend
    transaction: any;
}

export interface AptosTxParams {
    to: string;
    amount: number; // in APT
    // Aptos raw transaction or params
    sequenceNumber: string;
    chainId: number;
}

export const signingService = {
    /**
     * Sign an Ethereum transaction locally.
     */
    signEthTransaction: async (privateKey: string, params: EthTxParams): Promise<string> => {
        const wallet = new ethers.Wallet(privateKey);
        const tx: any = {
            to: params.to,
            value: params.value,
            nonce: params.nonce,
            gasLimit: params.gasLimit,
            gasPrice: params.gasPrice,
            chainId: params.chainId,
        };
        if (params.data) {
            tx.data = params.data;
        }
        return await wallet.signTransaction(tx);
    },

    /**
     * Sign a Solana transaction locally.
     */
    signSolTransaction: async (privateKey: string, params: SolTxParams): Promise<string> => {
        // Solana private keys from our derivation are hex strings (converted from secretKey buffer)
        const secretKey = Buffer.from(privateKey, 'hex');
        const sender = Keypair.fromSecretKey(secretKey);

        const transaction = new Transaction({
            recentBlockhash: params.recentBlockhash,
            feePayer: sender.publicKey
        }).add(
            SystemProgram.transfer({
                fromPubkey: sender.publicKey,
                toPubkey: new PublicKey(params.to),
                lamports: params.amount * 1e9,
            })
        );

        transaction.partialSign(sender);
        const serializedTransaction = transaction.serialize();
        return serializedTransaction.toString('base64');
    },

    /**
     * Sign a Solana SPL Token transaction locally.
     */
    signSolTokenTransaction: async (privateKey: string, params: SolTokenTxParams): Promise<string> => {
        const secretKey = Buffer.from(privateKey, 'hex');
        const sender = Keypair.fromSecretKey(secretKey);
        const mintPubKey = new PublicKey(params.mintAddress);
        const destPubKey = new PublicKey(params.to);
        const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

        // Find ATAs
        const fromTokenAccount = getAssociatedTokenAddressSync(mintPubKey, sender.publicKey);
        const toTokenAccount = getAssociatedTokenAddressSync(mintPubKey, destPubKey);

        const transaction = new Transaction({
            recentBlockhash: params.recentBlockhash,
            feePayer: sender.publicKey
        });

        // Instruction data for Transfer: [3, amount_u64]
        const amountData = Buffer.alloc(9);
        amountData.writeUInt8(3, 0);
        // USDT on Solana has 6 decimals
        const decimals = params.mintAddress === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" ? 6 : 9;
        const sunAmount = Math.floor(params.amount * Math.pow(10, decimals));
        amountData.writeBigUInt64LE(BigInt(sunAmount), 1);

        // 1. Add ATA creation instruction if needed
        if (params.ataExists === false) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    sender.publicKey, // payer
                    toTokenAccount,   // ata
                    destPubKey,       // owner
                    mintPubKey        // mint
                )
            );
        }

        // 2. Add transfer instruction
        transaction.add(
            new TransactionInstruction({
                keys: [
                    { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: sender.publicKey, isSigner: true, isWritable: false },
                ],
                programId: tokenProgramId,
                data: amountData,
            })
        );

        transaction.partialSign(sender);
        const serializedTransaction = transaction.serialize();
        return serializedTransaction.toString('base64');
    },

    /**
     * Sign a Dogecoin transaction locally (Legacy P2PKH).
     */
    signDogeTransaction: async (privateKey: string, params: DogeTxParams): Promise<string> => {
        const keyPair = ECPair.fromWIF(privateKey, DOGE_NETWORK);
        const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
        psbt.setMaximumFeeRate(100000000); // effectively disable max fee rate check if using huge static fees.

        let totalInput = BigInt(0);
        params.utxos.forEach(utxo => {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(utxo.nonWitnessUtxo || '', 'hex'),
            });
            totalInput += BigInt(utxo.value);
        });

        const satoshisToSend = BigInt(Math.floor(params.amount * 1e8));
        const fee = BigInt(Math.floor(params.feeRate * 1e8));
        const change = totalInput - satoshisToSend - fee;

        psbt.addOutput({
            address: params.to,
            value: satoshisToSend,
        });

        // Dust limit for DOGE
        if (change > BigInt(1000000)) {
            psbt.addOutput({
                address: params.from,
                value: change,
            });
        }

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        return psbt.extractTransaction().toHex();
    },

    /**
     * Sign a Litecoin transaction locally (SegWit P2WPKH).
     */
    signLtcTransaction: async (privateKey: string, params: LtcTxParams): Promise<string> => {
        const keyPair = ECPair.fromWIF(privateKey, LTC_NETWORK);
        const psbt = new bitcoin.Psbt({ network: LTC_NETWORK });
        psbt.setMaximumFeeRate(100000000); 

        let totalInput = BigInt(0);
        params.utxos.forEach(utxo => {
            const inputData: any = {
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(params.from, LTC_NETWORK),
                    value: BigInt(utxo.value)
                }
            };
            if (utxo.nonWitnessUtxo) {
                inputData.nonWitnessUtxo = Buffer.from(utxo.nonWitnessUtxo, 'hex');
            }
            psbt.addInput(inputData);
            totalInput += BigInt(utxo.value);
        });

        const satoshisToSend = BigInt(Math.floor(params.amount * 1e8));
        const fee = BigInt(Math.floor(params.feeRate * 250)); // rough estimate
        const change = totalInput - satoshisToSend - fee;

        psbt.addOutput({
            address: params.to,
            value: satoshisToSend,
        });

        if (change > BigInt(546)) { // Dust limit
            psbt.addOutput({
                address: params.from,
                value: change,
            });
        }

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        return psbt.extractTransaction().toHex();
    },

    /**
     * Sign a Bitcoin SegWit transaction locally.
     */
    signBtcTransaction: async (privateKey: string, params: BtcTxParams): Promise<string> => {
        const network = bitcoin.networks.bitcoin;
        const keyPair = ECPair.fromWIF(privateKey, network);
        const psbt = new bitcoin.Psbt({ network });

        let totalInput = BigInt(0);
        params.utxos.forEach(utxo => {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: utxo.witnessUtxo?.script === "REPLACE_ON_FRONTEND"
                        ? bitcoin.address.toOutputScript(params.from, network)
                        : Buffer.from(utxo.witnessUtxo?.script || '', 'hex'),
                    value: BigInt(utxo.witnessUtxo?.value || utxo.value || 0)
                },
            });
            totalInput += BigInt(utxo.witnessUtxo?.value || 0);
        });

        const satoshisToSend = BigInt(Math.floor(params.amount * 1e8));
        const fee = BigInt(Math.floor(params.feeRate * 250)); // Rough estimate
        const change = totalInput - satoshisToSend - fee;

        psbt.addOutput({
            address: params.to,
            value: satoshisToSend,
        });

        if (change > BigInt(546)) { // Dust limit
            psbt.addOutput({
                address: params.from,
                value: change,
            });
        }

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        return psbt.extractTransaction().toHex();
    },

    /**
     * Sign a TRON transaction locally.
     */
    signTronTransaction: async (privateKey: string, params: TronTxParams): Promise<string> => {
        // We use a dummy TronWeb instance for signing only
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: privateKey
        });
        const signedTx = await tronWeb.trx.sign(params.transaction, privateKey);
        return JSON.stringify(signedTx);
    },

    /**
     * Sign an Aptos transaction locally.
     */
    signAptosTransaction: async (privateKey: string, params: AptosTxParams): Promise<string> => {
        // Handle standard AIP-80 format from newer ts-sdk versions or legacy hex strings
        let formattedKey = privateKey;
        if (!privateKey.startsWith('ed25519-priv-')) {
            let cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
            cleanKey = cleanKey.padStart(64, '0');
            formattedKey = `0x${cleanKey}`;
        }
        
        const privateKeyObj = new Ed25519PrivateKey(formattedKey);
        const sender = Account.fromPrivateKey({ privateKey: privateKeyObj });

        try {
            const config = new AptosConfig({ network: Network.MAINNET });
            const aptos = new Aptos(config);

            // Ensure destination address is padded up to 64 chars and prefixed with 0x
            let destAddress = params.to.startsWith('0x') ? params.to.slice(2) : params.to;
            destAddress = `0x${destAddress.padStart(64, '0')}`;

            const transaction = await aptos.transaction.build.simple({
                sender: sender.accountAddress,
                data: {
                    function: "0x1::aptos_account::transfer",
                    functionArguments: [destAddress, Math.floor(params.amount * 1e8)],
                },
                options: {
                    accountSequenceNumber: BigInt(params.sequenceNumber),
                }
            });

        const senderAuthenticator = aptos.transaction.sign({
            signer: sender,
            transaction,
        });

        const signedBytes = generateSignedTransaction({
            transaction,
            senderAuthenticator,
            feePayerAuthenticator: undefined,
        });

            return Buffer.from(signedBytes).toString("hex");
        } catch (e: any) {
            console.error("Aptos signing error:", e);
            throw e;
        }
    }
};
