import {
    BigInt,
    Address,
    BigDecimal,
    Bytes,
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
} from './helpers/units';
import {
    CaskTransaction,
    CaskConsumer,
    CaskP2P,
} from "../types/schema"

function findOrCreateConsumer(consumerAddress: Bytes, appearedAt: i32): CaskConsumer {
    let consumer = CaskConsumer.load(consumerAddress.toHex())
    if (!consumer) {
        consumer = new CaskConsumer(consumerAddress.toHex())
        consumer.appearedAt = appearedAt
        consumer.save()
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

    let p2pAmount: BigDecimal = scaleDown(event.params.amount, VAULT_DECIMALS);
    let p2pTotalAmount: BigDecimal = scaleDown(event.params.totalAmount, VAULT_DECIMALS);

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCreated'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.amount = p2pAmount
    txn.save()

    let p2p = new CaskP2P(event.params.p2pId.toHex())

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.to = p2pInfo.to
    p2p.amount = p2pAmount
    p2p.period = p2pInfo.period.toI32()
    p2p.totalAmount = p2pTotalAmount
    p2p.createdAt = p2pInfo.createdAt.toI32()
    p2p.processAt = p2pInfo.processAt.toI32()

    p2p.status = 'Active'

    p2p.save()
}

export function handleP2PPaused(event: P2PPaused): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PPaused'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)

    p2p.save()
}

export function handleP2PResumed(event: P2PResumed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PResumed'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)

    p2p.save()
}

export function handleP2PSkipped(event: P2PSkipped): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PSkipped'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)
    p2p.numSkips = p2pInfo.numSkips

    p2p.save()
}

export function handleP2PProcessed(event: P2PProcessed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PProcessed'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)
    p2p.numPayments = p2pInfo.numPayments
    p2p.numSkips = p2pInfo.numSkips
    p2p.currentAmount = scaleDown(p2pInfo.currentAmount, VAULT_DECIMALS)

    p2p.save()
}

export function handleP2PCanceled(event: P2PCanceled): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCanceled'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)

    p2p.save()
}

export function handleP2PComplete(event: P2PCompleted): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'P2PCanceled'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let p2p = CaskP2P.load(event.params.p2pId.toHex())
    if (p2p == null) {
        log.warning('P2P not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    let contract = CaskP2PContract.bind(event.address)
    let p2pInfo = contract.getP2P(event.params.p2pId)
    if (p2pInfo == null) {
        log.warning('P2P Info not found: {}', [event.params.p2pId.toHex()])
        return;
    }

    p2p.status = p2pStatus(p2pInfo.status)

    p2p.save()
}