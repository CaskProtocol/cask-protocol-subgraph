import {
    BigInt,
    Address,
    BigDecimal,
    Bytes,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskVault,
    AssetDeposited,
    AssetWithdrawn,
    Payment,
    TransferValue
} from "../types/CaskVault/CaskVault"
import {
    VAULT_DECIMALS,
    scaleDown,
} from './helpers/units';
import {
    Cask,
    CaskConsumer,
    CaskProvider,
    CaskTransaction,
    CaskUser
} from "../types/schema"


const CASK_ID = '1'

function findOrCreateUser(userAddress: Bytes, appearedAt: i32): CaskUser {
    let user = CaskUser.load(userAddress.toHex())
    if (!user) {
        user = new CaskUser(userAddress.toHex())
        user.appearedAt = appearedAt
        user.save()
    }
    return user
}

function findOrCreateConsumer(consumerAddress: Bytes, appearedAt: i32): CaskConsumer {
    let consumer = CaskConsumer.load(consumerAddress.toHex())
    if (!consumer) {
        consumer = new CaskConsumer(consumerAddress.toHex())
        consumer.appearedAt = appearedAt
        consumer.save()
    }
    return consumer
}

function findOrCreateProvider(providerAddress: Bytes, appearedAt: i32): CaskProvider {
    let provider = CaskProvider.load(providerAddress.toHex())
    if (!provider) {
        provider = new CaskProvider(providerAddress.toHex())
        provider.appearedAt = appearedAt
        provider.save()
    }
    return provider
}

function loadCask(): Cask {
    let cask = Cask.load(CASK_ID)
    if (cask == null) {
        cask = new Cask(CASK_ID)
    }
    return cask
}

export function handleAssetDeposited(event: AssetDeposited): void {

    const cask = loadCask()

    let depositAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS);
    cask.totalDepositAmount = cask.totalDepositAmount.plus(depositAmount)
    cask.totalDepositCount = cask.totalDepositCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.depositAmount = user.depositAmount.plus(depositAmount)
    user.depositCount = user.depositCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.plus(depositAmount)
    user.save()

    const consumer = findOrCreateConsumer(event.params.participant, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'AssetDeposit'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.assetAddress = event.params.asset
    txn.amount = depositAmount
    txn.save()
}

export function handleAssetWithdrawn(event: AssetWithdrawn): void {

    const cask = loadCask()

    let withdrawAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS);
    cask.totalWithdrawAmount = cask.totalWithdrawAmount.plus(withdrawAmount)
    cask.totalWithdrawCount = cask.totalWithdrawCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.withdrawAmount = user.withdrawAmount.plus(withdrawAmount)
    user.withdrawCount = user.withdrawCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.minus(withdrawAmount)
    user.save()

    const consumer = findOrCreateConsumer(event.params.participant, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'AssetWithdrawal'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.assetAddress = event.params.asset
    txn.amount = withdrawAmount
    txn.save()
}

export function handlePayment(event: Payment): void {

    const cask = loadCask()

    let amount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS)
    let protocolFeeAmount: BigDecimal = scaleDown(event.params.protocolFee, VAULT_DECIMALS)
    let networkFeeAmount: BigDecimal = scaleDown(event.params.networkFee, VAULT_DECIMALS)

    cask.totalProtocolPayments = cask.totalProtocolPayments.plus(amount)
    cask.totalProtocolFees = cask.totalProtocolFees.plus(protocolFeeAmount)
    cask.totalNetworkFees = cask.totalNetworkFees.plus(networkFeeAmount)
    cask.save()

    const fromUser = findOrCreateUser(event.params.from, event.block.timestamp.toI32())
    fromUser.balance = fromUser.balance.minus(amount)
    fromUser.save()

    const toUser = findOrCreateUser(event.params.to, event.block.timestamp.toI32())
    toUser.balance = toUser.balance.plus(amount).minus(protocolFeeAmount).minus(networkFeeAmount)
    toUser.save()

    const consumer = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.to, event.block.timestamp.toI32())

    provider.totalPaymentsReceived = provider.totalPaymentsReceived.plus(amount)
    provider.save()

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'Payment'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.amount = amount
    txn.save()
}


export function handleTransferValue(event: TransferValue): void {

    let amount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS);

    const fromUser = findOrCreateUser(event.params.from, event.block.timestamp.toI32())
    fromUser.balance = fromUser.balance.minus(amount)
    fromUser.save()

    const toUser = findOrCreateUser(event.params.to, event.block.timestamp.toI32())
    toUser.balance = toUser.balance.plus(amount)
    toUser.save()

    const consumer = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.to, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'TransferValue'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.amount = amount
    txn.save()
}
