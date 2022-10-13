import {
    BigInt,
    BigDecimal,
    Bytes,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskVault,
    AssetDeposited,
    AssetWithdrawn,
    Payment,
    TransferValue,
    Transfer,
    SetFundingSource
} from "../types/CaskVault/CaskVault"
import {
    VAULT_DECIMALS,
    scaleDown,
    sharesToValue,
} from './helpers/units'
import {
    Cask,
    CaskConsumer,
    CaskProvider,
    CaskWalletEvent,
    CaskUser,
} from "../types/schema"


const CASK_ID = '1'

function findOrCreateUser(userAddress: Bytes, appearedAt: i32): CaskUser {
    let user = CaskUser.load(userAddress.toHex())
    if (!user) {
        user = new CaskUser(userAddress.toHex())
        user.appearedAt = appearedAt
        user.balance = BigDecimal.zero()
        user.depositCount = BigInt.zero()
        user.depositAmount = BigDecimal.zero()
        user.withdrawCount = BigInt.zero()
        user.withdrawAmount = BigDecimal.zero()
    }
    return user
}

function findOrCreateConsumer(consumerAddress: Bytes, appearedAt: i32): CaskConsumer {
    let consumer = CaskConsumer.load(consumerAddress.toHex())
    if (!consumer) {
        consumer = new CaskConsumer(consumerAddress.toHex())
        consumer.appearedAt = appearedAt
        consumer.balance = BigDecimal.zero()
        consumer.depositCount = BigInt.zero()
        consumer.depositAmount = BigDecimal.zero()
        consumer.withdrawCount = BigInt.zero()
        consumer.withdrawAmount = BigDecimal.zero()
        consumer.totalSubscriptionCount = BigInt.zero()
        consumer.activeSubscriptionCount = BigInt.zero()
        consumer.totalDCACount = BigInt.zero()
        consumer.activeDCACount = BigInt.zero()
        consumer.totalP2PCount = BigInt.zero()
        consumer.activeP2PCount = BigInt.zero()
        consumer.totalChainlinkTopupCount = BigInt.zero()
        consumer.activeChainlinkTopupCount = BigInt.zero()
    }
    return consumer
}

function findOrCreateProvider(providerAddress: Bytes, appearedAt: i32): CaskProvider {
    let provider = CaskProvider.load(providerAddress.toHex())
    if (!provider) {
        provider = new CaskProvider(providerAddress.toHex())
        provider.appearedAt = appearedAt
        provider.totalPaymentsReceived = BigDecimal.zero()
        provider.totalSubscriptionCount = BigInt.zero()
        provider.activeSubscriptionCount = BigInt.zero()
        provider.trialingSubscriptionCount = BigInt.zero()
        provider.convertedSubscriptionCount = BigInt.zero()
        provider.canceledSubscriptionCount = BigInt.zero()
        provider.pausedSubscriptionCount = BigInt.zero()
        provider.pastDueSubscriptionCount = BigInt.zero()
    }
    return provider
}

function fundingSource(fundingSourceId: i32): string {
    if (fundingSourceId == 0) {
        return 'Cask'
    } else if (fundingSourceId == 1) {
        return 'Personal'
    }
    return 'Cask'
}

function loadCask(): Cask {
    let cask = Cask.load(CASK_ID)
    if (cask == null) {
        cask = new Cask(CASK_ID)
        cask.totalDepositCount = BigInt.zero()
        cask.totalDepositAmount = BigDecimal.zero()
        cask.totalWithdrawCount = BigInt.zero()
        cask.totalWithdrawAmount = BigDecimal.zero()
        cask.totalProtocolPayments = BigDecimal.zero()
        cask.totalProtocolFees = BigDecimal.zero()
        cask.totalNetworkFees = BigDecimal.zero()
    }
    return cask
}

export function handleAssetDeposited(event: AssetDeposited): void {

    const cask = loadCask()

    let depositAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS)
    cask.totalDepositAmount = cask.totalDepositAmount.plus(depositAmount)
    cask.totalDepositCount = cask.totalDepositCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.depositAmount = user.depositAmount.plus(depositAmount)
    user.depositCount = user.depositCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.plus(depositAmount)
    user.save()

    const consumer = findOrCreateConsumer(event.params.participant, event.block.timestamp.toI32())

    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'AssetDeposit'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.assetAddress = event.params.asset
    txn.amount = depositAmount
    txn.save()
}

export function handleAssetWithdrawn(event: AssetWithdrawn): void {

    const cask = loadCask()

    let withdrawAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS)
    cask.totalWithdrawAmount = cask.totalWithdrawAmount.plus(withdrawAmount)
    cask.totalWithdrawCount = cask.totalWithdrawCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.withdrawAmount = user.withdrawAmount.plus(withdrawAmount)
    user.withdrawCount = user.withdrawCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.minus(withdrawAmount)
    user.save()

    const consumer = findOrCreateConsumer(event.params.participant, event.block.timestamp.toI32())

    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'AssetWithdrawal'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
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

    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'Payment'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.to = provider.id
    txn.amount = amount
    txn.save()
}

export function handleTransferValue(event: TransferValue): void {

    let amount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS)

    const fromUser = findOrCreateUser(event.params.from, event.block.timestamp.toI32())
    fromUser.balance = fromUser.balance.minus(amount)
    fromUser.save()

    const toUser = findOrCreateUser(event.params.to, event.block.timestamp.toI32())
    toUser.balance = toUser.balance.plus(amount)
    toUser.save()

    const consumer = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.to, event.block.timestamp.toI32())

    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'TransferValue'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.to = provider.id
    txn.amount = amount
    txn.save()
}

export function handleTransfer(event: Transfer): void {

    let vaultContract = CaskVault.bind(event.address)

    let amount = scaleDown(sharesToValue(event.params.value, vaultContract.pricePerShare()), VAULT_DECIMALS)

    const fromUser = findOrCreateUser(event.params.from, event.block.timestamp.toI32())
    fromUser.balance = fromUser.balance.minus(amount)
    fromUser.save()

    const toUser = findOrCreateUser(event.params.to, event.block.timestamp.toI32())
    toUser.balance = toUser.balance.plus(amount)
    toUser.save()

    const consumer = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.to, event.block.timestamp.toI32())

    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'Transfer'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.to = provider.id
    txn.amount = amount
    txn.save()
}

export function handleSetFundingSource(event: SetFundingSource): void {

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.fundingSource = fundingSource(event.params.fundingSource)
    user.fundingAsset = event.params.fundingAsset
    user.save()

    const consumer = findOrCreateConsumer(event.params.participant, event.block.timestamp.toI32())
    let txn = new CaskWalletEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.txnId = event.transaction.hash
    txn.type = 'SetFundingSource'
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.fundingSource = fundingSource(event.params.fundingSource)
    txn.assetAddress = event.params.fundingAsset
    txn.save()
}
