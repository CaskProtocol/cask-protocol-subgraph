import {
    BigInt,
    BigDecimal,
    Bytes,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskDCA as CaskDCAContract,
    DCACreated,
    DCAPaused,
    DCAResumed,
    DCAProcessed,
    DCASkipped,
    DCACanceled,
    DCACompleted
} from "../types/CaskDCA/CaskDCA"
import {
    VAULT_DECIMALS,
    scaleDown,
} from './helpers/units'
import {
    incrementMetric
} from "./helpers/metrics"
import {
    CaskTransaction,
    CaskConsumer,
    CaskDCA,
} from "../types/schema"

function findOrCreateDCA(dcaId: Bytes): CaskDCA {
    let dca = CaskDCA.load(dcaId.toHex())
    if (!dca) {
        dca = new CaskDCA(dcaId.toHex())
        dca.save()
    }
    return dca
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

function dcaStatus(statusId: i32): string {
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

function dcaSkipReason(reasonId: i32): string {
    if (reasonId == 1) {
        return 'AssetNotAllowed'
    } else if (reasonId == 2) {
        return 'PaymentFailed'
    } else if (reasonId == 3) {
        return 'OutsideLimits'
    } else if (reasonId == 4) {
        return 'SwapFailed'
    } else {
        return 'None'
    }
}

export function handleDCACreated(event: DCACreated): void {

    let dcaAmount: BigDecimal = scaleDown(event.params.amount, VAULT_DECIMALS);
    let dcaTotalAmount: BigDecimal = scaleDown(event.params.totalAmount, VAULT_DECIMALS);

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACreated'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.assetAddress = event.params.outputAsset
    txn.amount = dcaAmount
    txn.save()

    let dca = findOrCreateDCA(event.params.dcaId)

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.user = consumer.id
    dca.to = dcaInfo.to
    dca.router = dcaInfo.router
    dca.priceFeed = dcaInfo.priceFeed
    dca.inputAsset = dcaInfo.path[0]
    dca.outputAsset = dcaInfo.path[dcaInfo.path.length-1]
    dca.amount = dcaAmount
    dca.period = dcaInfo.period.toI32()
    dca.totalAmount = dcaTotalAmount
    dca.minPrice = dcaInfo.minPrice
    dca.maxPrice = dcaInfo.maxPrice
    dca.slippageBps = dcaInfo.slippageBps
    dca.createdAt = dcaInfo.createdAt.toI32()
    dca.processAt = dcaInfo.processAt.toI32()
    dca.status = 'Active'
    dca.save()

    incrementMetric('dca.created', event.block.timestamp)

    consumer.totalDCACount = consumer.totalDCACount.plus(BigInt.fromI32(1))
    consumer.activeDCACount = consumer.activeDCACount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCAPaused(event: DCAPaused): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAPaused'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCAResumed(event: DCAResumed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAResumed'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCASkipped(event: DCASkipped): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCASkipped'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.skipReason = dcaSkipReason(event.params.skipReason)
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.numSkips = dcaInfo.numSkips

    dca.save()
}

export function handleDCAProcessed(event: DCAProcessed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAProcessed'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let dca = findOrCreateDCA(event.params.dcaId)

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.numBuys = dcaInfo.numBuys
    dca.numSkips = dcaInfo.numSkips
    dca.processAt = dcaInfo.processAt.toI32()
    dca.currentAmount = scaleDown(dcaInfo.currentAmount, VAULT_DECIMALS)
    dca.currentQty = dcaInfo.currentQty
    dca.save()

    incrementMetric('dca.processed', event.block.timestamp)
}

export function handleDCACanceled(event: DCACanceled): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACanceled'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCAComplete(event: DCACompleted): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACanceled'
    txn.dcaId = event.params.dcaId
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    let contract = CaskDCAContract.bind(event.address)
    let dcaInfo = contract.getDCA(event.params.dcaId)
    if (dcaInfo == null) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return;
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}