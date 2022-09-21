import {
    BigInt,
    BigDecimal,
    Bytes,
    Address,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskP2P as CaskP2PContract,
    P2PCreated,
    P2PPaused,
    P2PResumed,
    P2PProcessed,
    P2PSkipped,
    P2PCanceled,
    P2PCompleted
} from "../types/CaskP2P/CaskP2P"
import {
    VAULT_DECIMALS,
    scaleDown,
} from './helpers/units'
import {
    CaskConsumer,
    CaskP2P,
    CaskP2PEvent,
} from "../types/schema"
import {
    incrementMetric
} from "./helpers/metrics"

function findOrCreateP2P(p2pId: Bytes): CaskP2P {
    let p2p = CaskP2P.load(p2pId.toHex())
    if (!p2p) {
        p2p = new CaskP2P(p2pId.toHex())
        p2p.currentFees = BigDecimal.zero()
    }
    return p2p
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
    }
    return consumer
}

function p2pStatus(statusId: i32): string {
    if (statusId == 1) {
        return 'Active'
    } else if (statusId == 2) {
        return 'Paused'
    } else if (statusId == 3) {
        return 'Canceled'
    } else if (statusId == 4) {
        return 'Complete'
    } else {
        return 'None'
    }
}

export function handleP2PCreated(event: P2PCreated): void {

    let p2pAmount: BigDecimal = scaleDown(event.params.amount, VAULT_DECIMALS)
    let p2pTotalAmount: BigDecimal = scaleDown(event.params.totalAmount, VAULT_DECIMALS)

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCreated'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.amount = p2pAmount
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = findOrCreateP2P(event.params.p2pId)
    p2p.user = consumer.id
    p2p.to = p2pInfo.to
    p2p.amount = p2pAmount
    p2p.period = p2pInfo.period.toI32()
    p2p.numPayments = p2pInfo.numPayments
    p2p.numSkips = p2pInfo.numSkips
    p2p.currentAmount = scaleDown(p2pInfo.currentAmount, VAULT_DECIMALS)
    p2p.totalAmount = p2pTotalAmount
    p2p.createdAt = p2pInfo.createdAt.toI32()
    p2p.lastProcessedAt = event.block.timestamp.toI32()
    p2p.processAt = p2pInfo.processAt.toI32()
    p2p.status = 'Active'
    p2p.save()

    consumer.totalP2PCount = consumer.totalP2PCount.plus(BigInt.fromI32(1))
    consumer.activeP2PCount = consumer.activeP2PCount.plus(BigInt.fromI32(1))
    consumer.save()

    incrementMetric('p2p.created', event.block.timestamp)
}

export function handleP2PPaused(event: P2PPaused): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PPaused'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return
    }
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.pausedAt = event.block.timestamp.toI32()
    p2p.save()

    consumer.activeP2PCount = consumer.activeP2PCount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleP2PResumed(event: P2PResumed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PResumed'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return
    }
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.save()

    consumer.activeP2PCount = consumer.activeP2PCount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleP2PSkipped(event: P2PSkipped): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PSkipped'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return
    }
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.numSkips = p2pInfo.numSkips
    p2p.lastSkippedAt = event.block.timestamp.toI32()
    p2p.save()
}

export function handleP2PProcessed(event: P2PProcessed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PProcessed'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.amount = scaleDown(event.params.amount, VAULT_DECIMALS)
    txn.fee = scaleDown(event.params.fee, VAULT_DECIMALS)
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = findOrCreateP2P(event.params.p2pId)
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.numPayments = p2pInfo.numPayments
    p2p.numSkips = p2pInfo.numSkips
    p2p.processAt = p2pInfo.processAt.toI32()
    p2p.currentAmount = scaleDown(p2pInfo.currentAmount, VAULT_DECIMALS)
    p2p.currentFees = p2p.currentFees.plus(scaleDown(event.params.fee, VAULT_DECIMALS))
    p2p.lastProcessedAt = event.block.timestamp.toI32()
    p2p.save()

    incrementMetric('p2p.processed', event.block.timestamp)
}

export function handleP2PCanceled(event: P2PCanceled): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCanceled'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return
    }
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.canceledAt = event.block.timestamp.toI32()
    p2p.save()

    consumer.activeP2PCount = consumer.activeP2PCount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleP2PCompleted(event: P2PCompleted): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskP2PEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCanceled'
    txn.p2pId = event.params.p2pId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null || p2pInfo.user == Address.zero()) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return
    }

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return
    }
    p2p.status = p2pStatus(p2pInfo.status)
    p2p.completedAt = event.block.timestamp.toI32()
    p2p.save()

    consumer.activeP2PCount = consumer.activeP2PCount.minus(BigInt.fromI32(1))
    consumer.save()
}