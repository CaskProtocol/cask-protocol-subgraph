import {
    BigInt,
    BigDecimal,
    Bytes,
    Address,
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
    scaleDown,
} from './helpers/units'
import {
    baseAssetDecimals
} from './helpers/caskVault'
import {
    CaskConsumer,
    CaskDCA,
    CaskDCAEvent,
} from "../types/schema"
import {
    incrementMetric
} from "./helpers/metrics"

function findOrCreateDCA(dcaId: Bytes): CaskDCA {
    let dca = CaskDCA.load(dcaId.toHex())
    if (!dca) {
        dca = new CaskDCA(dcaId.toHex())
        dca.currentFees = BigDecimal.zero()
    }
    return dca
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
        return 'ExcessiveSlippage'
    } else if (reasonId == 5) {
        return 'SwapFailed'
    } else {
        return 'None'
    }
}

export function handleDCACreated(event: DCACreated): void {

    let dcaAmount: BigDecimal = scaleDown(event.params.amount, baseAssetDecimals())
    let dcaTotalAmount: BigDecimal = scaleDown(event.params.totalAmount, baseAssetDecimals())

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACreated'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.assetAddress = event.params.outputAsset
    txn.amount = dcaAmount
    txn.save()

    let dca = findOrCreateDCA(event.params.dcaId)

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
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
    dca.maxSlippageBps = dcaInfo.maxSlippageBps
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
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAPaused'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return
    }

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.pausedAt = event.block.timestamp.toI32()
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCAResumed(event: DCAResumed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAResumed'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return
    }

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.plus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCASkipped(event: DCASkipped): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCASkipped'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.skipReason = dcaSkipReason(event.params.skipReason)
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return
    }

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.numSkips = dcaInfo.numSkips
    dca.processAt = dcaInfo.processAt.toI32()
    dca.lastSkippedAt = event.block.timestamp.toI32()

    dca.save()
}

export function handleDCAProcessed(event: DCAProcessed): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCAProcessed'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.amount = scaleDown(event.params.amount, baseAssetDecimals())
    txn.buyQty = event.params.buyQty
    txn.fee = scaleDown(event.params.fee, baseAssetDecimals())
    txn.user = consumer.id
    txn.save()

    let dca = findOrCreateDCA(event.params.dcaId)

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.numBuys = dcaInfo.numBuys
    dca.numSkips = dcaInfo.numSkips
    dca.processAt = dcaInfo.processAt.toI32()
    dca.currentAmount = scaleDown(dcaInfo.currentAmount, baseAssetDecimals())
    dca.currentFees = dca.currentFees.plus(scaleDown(event.params.fee, baseAssetDecimals()))
    dca.currentQty = dcaInfo.currentQty
    dca.lastProcessedAt = event.block.timestamp.toI32()
    dca.save()

    incrementMetric('dca.processed', event.block.timestamp)
}

export function handleDCACanceled(event: DCACanceled): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACanceled'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return
    }

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.canceledAt = event.block.timestamp.toI32()
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}

export function handleDCACompleted(event: DCACompleted): void {

    const consumer = findOrCreateConsumer(event.params.user, event.block.timestamp.toI32())
    let txn = new CaskDCAEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'DCACompleted'
    txn.dcaId = event.params.dcaId
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.user = consumer.id
    txn.save()

    let dca = CaskDCA.load(event.params.dcaId.toHex())
    if (dca == null) {
        log.warning('DCA not found: {}', [event.params.dcaId.toHex()])
        return
    }

    let contract = CaskDCAContract.bind(event.address)
    let callResult = contract.try_getDCA(event.params.dcaId)
    if (callResult.reverted) {
        log.warning('DCA call reverted for: {}', [event.params.dcaId.toHex()])
        return
    }
    let dcaInfo = callResult.value
    if (dcaInfo == null || dcaInfo.user == Address.zero()) {
        log.warning('DCA Info not found: {}', [event.params.dcaId.toHex()])
        return
    }

    dca.status = dcaStatus(dcaInfo.status)
    dca.completedAt = event.block.timestamp.toI32()
    dca.save()

    consumer.activeDCACount = consumer.activeDCACount.minus(BigInt.fromI32(1))
    consumer.save()
}