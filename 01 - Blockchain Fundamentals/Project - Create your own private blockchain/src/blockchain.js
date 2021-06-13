/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            const block = new BlockClass.Block({ data: 'Genesis Block' });
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    async _addBlock(block) {
        const self = this;
        let isBlockValid;

        return new Promise(async (resolve, reject) => {
            block.height = self.chain.length;
            block.time = new Date().getTime().toString().slice(0,-3);

            // TODO: might have an issue here
            if (await self.getChainHeight() > 0) {
                const prevBlock = await self.getBlockByHeight(block.height - 1);

                if (prevBlock && 'hash' in prevBlock) {
                    block.previousBlockHash = prevBlock.hash;
                }
            }
            
            block.hash = SHA256(JSON.stringify(block)).toString();
            isBlockValid = await block.validate();

            if (!isBlockValid) {
                return reject(Error(`Block is invalid ${block.hash}`));
            }

            self.chain.push(block);
            self.height = self.chain.length;

            const isValidChain = await self.validateChain();

            if (!isValidChain) {
                return reject(Error(`Chain is invalid after adding block ${block.hash}`));
            }

            return resolve(block);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const starRegistry = 'starRegistry';
            const now = new Date().getTime().toString().slice(0,-3);
            const result = `${address}:${now}:${starRegistry}`;
            
            return resolve(result);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            const time = parseInt(message.split(':')[1]);
            const curTime = parseInt(new Date().getTime().toString().slice(0, -3));
            const timeDiff5mins = 5 * 60 * 1000;

            // less than 5 mins
            if ((curTime - time) > timeDiff5mins) {
                return reject(Error('More than 5 minutes have elapsed'));
            }

            if (!bitcoinMessage.verify(message, address, signature)) {
                return reject(Error('Failed to verify message'));
            }

            const block = new BlockClass.Block({address, message, signature, star});
            await self._addBlock(block);

            return resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        const self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.find(block => block.hash === hash);

            if (block) {
                return resolve(block);
            }
            
            return resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        const self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if (block) {
                return resolve(block);
            }

            return resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        const self = this;
        let stars = [];
        let body;
        return new Promise((resolve, reject) => {
            self.chain.forEach(async block => {
                body = await block.getBData();

                if (body.address === address) {
                    stars.push(body.star);
                }
            });

            return resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        const self = this;
        let errorLog = [];
        let isValid, prevBlock;
        return new Promise(async (resolve, reject) => {
            self.chain.forEach(async block => {
                if (block.height <= 0) {
                    return; // genesis block
                }

                isValid = await block.validate();

                if (!isValid) {
                    return errorLog.push(`Invalid block ${block.hash}`);
                }

                prevBlock = await self.getBlockByHash(block.previousBlockHash);

                if (prevBlock.hash !== block.hash) {
                    return errorLog.push(`Invalid previous block at ${block.hash} with prev hash ${block.previousBlockHash}`);
                }
            });

            if (errorLog.length) {
                return reject(errorLog);
            }

            return resolve(true);
        });
    }

}

module.exports.Blockchain = Blockchain;   