import {
    BigInt,
    BigDecimal,
    Bytes,
    Address,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskChainlinkTopup as CaskChainlinkTopupContract,
    ChainlinkTopupCreated,
    ChainlinkTopupPaused,
    ChainlinkTopupResumed,
    ChainlinkTopupProcessed,
    ChainlinkTopupSkipped,
    ChainlinkTopupCanceled,
} from "../types/CaskChainlinkTopup/CaskChainlinkTopup"
import {
    VAULT_DECIMALS,
    scaleDown,
} from './helpers/units'
import {
    CaskConsumer,
    CaskChainlinkTopup,
    CaskChainlinkTopupEvent,
} from "../types/schema"
import {
    incrementMetric
} from "./helpers/metrics"

function findOrCreateChainlinkTopup(chainlinkTopupId: Bytes): CaskChainlinkTopup {
    let cltu = CaskChainlinkTopup.load(chainlinkTopupId.toHex())
    if (!cltu) {
        cltu = new CaskChainlinkTopup(chainlinkTopupId.toHex())
        cltu.currentFees = BigDecimal.zero()
        cltu.topupType = cltuTopupType(0)
    }
    return cltu
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

function cltuStatus(statusId: i32): string {
    if (statusId == 1) {
        return 'Active'
    } else if (statusId == 2) {
        return 'Paused'
    } else if (statusId == 3) {
        return 'Canceled'
    } else {
        return 'None'
    }
}

function cltuTopupType(topupTypeId: i32): string {
    if (topupTypeId == 1) {
        return 'Automation'
    } else if (topupTypeId == 2) {
        return 'VRF'
    } else if (topupTypeId == 3) {
        return 'Direct'
    } else {
        return 'None'
    }
}

function cltuSkipReason(reasonId: i32): string {
    if (reasonId == 1) {
        return 'PaymentFailed'
    } else if (reasonId == 2) {
        return 'SwapFailed'
    } else {
        return 'None'
    }
}

export function handleChainlinkTopupCreated(event: ChainlinkTopupCreated): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupCreated'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let cltu = findOrCreateChainlinkTopup(event.params.chainlinkTopupId)

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.user = consumer.id
    cltu.lowBalance = cltuInfo.lowBalance
    cltu.topupAmount = scaleDown(cltuInfo.topupAmount, VAULT_DECIMALS)
    cltu.registry = cltuInfo.registry
    cltu.targetId = cltuInfo.targetId
    cltu.topupType = cltuTopupType(cltuInfo.topupType)
    cltu.createdAt = cltuInfo.createdAt.toI32()
    cltu.status = cltuStatus(cltuInfo.status)
    cltu.save()

    incrementMetric('cltu.created', event.block.timestamp)

    consumer.totalChainlinkTopupCount = consumer.totalChainlinkTopupCount.plus(BigInt.fromI32(1))
    consumer.activeChainlinkTopupCount = consumer.activeChainlinkTopupCount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleChainlinkTopupPaused(event: ChainlinkTopupPaused): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupPaused'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let cltu = CaskChainlinkTopup.load(event.params.chainlinkTopupId.toHex())
    if (cltu == null) {
        log.warning('ChainlinkTopup not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.status = cltuStatus(cltuInfo.status)
    cltu.pausedAt = event.block.timestamp.toI32()
    cltu.save()

    consumer.activeChainlinkTopupCount = consumer.activeChainlinkTopupCount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleChainlinkTopupResumed(event: ChainlinkTopupResumed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupResumed'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let cltu = CaskChainlinkTopup.load(event.params.chainlinkTopupId.toHex())
    if (cltu == null) {
        log.warning('ChainlinkTopup not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.status = cltuStatus(cltuInfo.status)
    cltu.numSkips = cltuInfo.numSkips
    cltu.save()

    consumer.activeChainlinkTopupCount = consumer.activeChainlinkTopupCount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleChainlinkTopupSkipped(event: ChainlinkTopupSkipped): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupSkipped'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.skipReason = cltuSkipReason(event.params.skipReason)
    txn.save()

    let cltu = CaskChainlinkTopup.load(event.params.chainlinkTopupId.toHex())
    if (cltu == null) {
        log.warning('ChainlinkTopup not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.status = cltuStatus(cltuInfo.status)
    cltu.numSkips = cltuInfo.numSkips
    cltu.lastSkippedAt = event.block.timestamp.toI32()

    cltu.save()
}

export function handleChainlinkTopupProcessed(event: ChainlinkTopupProcessed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupProcessed'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.amount = scaleDown(event.params.amount, VAULT_DECIMALS)
    txn.buyQty = event.params.buyQty
    txn.fee = scaleDown(event.params.fee, VAULT_DECIMALS)
    txn.user = consumer.id
    txn.save()

    let cltu = findOrCreateChainlinkTopup(event.params.chainlinkTopupId)

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.status = cltuStatus(cltuInfo.status)
    cltu.numTopups = cltuInfo.numTopups
    cltu.numSkips = cltuInfo.numSkips
    cltu.currentAmount = scaleDown(cltuInfo.currentAmount, VAULT_DECIMALS)
    cltu.currentBuyQty = cltuInfo.currentBuyQty
    cltu.currentFees = cltu.currentFees.plus(scaleDown(event.params.fee, VAULT_DECIMALS))
    cltu.lastProcessedAt = event.block.timestamp.toI32()
    cltu.save()

    incrementMetric('cltu.processed', event.block.timestamp)
}

export function handleChainlinkTopupCanceled(event: ChainlinkTopupCanceled): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskChainlinkTopupEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'ChainlinkTopupCanceled'
    txn.chainlinkTopupId = event.params.chainlinkTopupId
    txn.targetId = event.params.targetId
    txn.registry = event.params.registry
    txn.topupType = cltuTopupType(event.params.topupType)
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let cltu = CaskChainlinkTopup.load(event.params.chainlinkTopupId.toHex())
    if (cltu == null) {
        log.warning('ChainlinkTopup not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    let contract = CaskChainlinkTopupContract.bind(event.address)
    let callResult = contract.try_getChainlinkTopup(event.params.chainlinkTopupId)
    if (callResult.reverted) {
        log.warning('ChainlinkTopup call reverted for: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }
    let cltuInfo = callResult.value
    if (cltuInfo == null || cltuInfo.user == Address.zero()) {
        log.warning('ChainlinkTopup Info not found: {}', [event.params.chainlinkTopupId.toHex()])
        return
    }

    cltu.status = cltuStatus(cltuInfo.status)
    cltu.canceledAt = event.block.timestamp.toI32()
    cltu.save()

    consumer.activeChainlinkTopupCount = consumer.activeChainlinkTopupCount.minus(BigInt.fromI32(1))
    consumer.save()
}
