import {
    BigInt,
    BigDecimal,
    Bytes,
    Address,
    log
} from "@graphprotocol/graph-ts"
import {
    CaskSubscriptions,
    SubscriptionCanceled,
    SubscriptionChangedPlan,
    SubscriptionCreated,
    SubscriptionPastDue,
    SubscriptionPendingPause,
    SubscriptionPaused,
    SubscriptionPendingCancel,
    SubscriptionPendingChangePlan,
    SubscriptionRenewed,
    SubscriptionResumed,
    SubscriptionTrialEnded,
    Transfer,
} from "../types/CaskSubscriptions/CaskSubscriptions"
import {
    CaskConsumer,
    CaskProvider,
    CaskSubscriptionPlan,
    CaskSubscription,
    CaskDiscount,
    CaskSubscriptionEvent
} from "../types/schema"
import {
    addressMetricName,
    incrementMetric
} from "./helpers/metrics"
import {
    parsePlanData
} from "./helpers/plans"

import {
    ProviderSetProfile,
    PlanDisabled,
    PlanEnabled,
    PlanRetired
} from "../types/CaskSubscriptionPlans/CaskSubscriptionPlans"

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

function findOrCreateSubscriptionPlan(provider: CaskProvider, planId: BigInt): CaskSubscriptionPlan {
    let subscriptionPlan = CaskSubscriptionPlan.load(provider.id+'-'+planId.toString())
    if (!subscriptionPlan) {
        subscriptionPlan = new CaskSubscriptionPlan(provider.id+'-'+planId.toString())
        subscriptionPlan.provider = provider.id
        subscriptionPlan.planId = planId
        subscriptionPlan.status = 'Enabled'
        subscriptionPlan.totalSubscriptionCount = BigInt.zero()
        subscriptionPlan.activeSubscriptionCount = BigInt.zero()
        subscriptionPlan.trialingSubscriptionCount = BigInt.zero()
        subscriptionPlan.convertedSubscriptionCount = BigInt.zero()
        subscriptionPlan.canceledSubscriptionCount = BigInt.zero()
        subscriptionPlan.pausedSubscriptionCount = BigInt.zero()
        subscriptionPlan.pastDueSubscriptionCount = BigInt.zero()
    }
    return subscriptionPlan
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

function findOrCreateDiscount(provider: CaskProvider, discountId: Bytes): CaskDiscount {
    let discount = CaskDiscount.load(provider.id+'-'+discountId.toHex())
    if (!discount) {
        discount = new CaskDiscount(provider.id+'-'+discountId.toHex())
        discount.provider = provider.id
        discount.discountId = discountId
        discount.redemptions = BigInt.zero()
    }
    return discount
}

function subscriptionStatus(statusId: i32): string {
    if (statusId == 1) {
        return 'Trialing'
    } else if (statusId == 2) {
        return 'Active'
    } else if (statusId == 3) {
        return 'Paused'
    } else if (statusId == 4) {
        return 'Canceled'
    } else if (statusId == 5) {
        return 'PastDue'
    } else if (statusId == 6) {
        return 'PendingPause'
    } else {
        return 'None'
    }
}

function subscriptionPlanStatus(statusId: i32): string {
    if (statusId == 1) {
        return 'Disabled'
    } else if (statusId == 2) {
        return 'EndOfLife'
    } else {
        return 'Enabled'
    }
}

export function handleSubscriptionCreated(event: SubscriptionCreated): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionCreated'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = new CaskSubscription(event.params.subscriptionId.toHex())

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null || subscriptionInfo.getSubscription().provider == Address.zero()) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    let planInfo = parsePlanData(subscriptionInfo.value0.planData)

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.currentOwner = consumer.id
    subscription.provider = provider.id
    subscription.ref = subscriptionInfo.value0.ref.toHex()

    subscription.plan = plan.id
    subscription.planData = subscriptionInfo.value0.planData
    subscription.price = planInfo.price
    subscription.period = planInfo.period
    subscription.freeTrial = planInfo.freeTrial
    subscription.maxActive = planInfo.maxActive
    subscription.minPeriods = planInfo.minPeriods
    subscription.gracePeriod = planInfo.gracePeriod
    subscription.canPause = planInfo.canPause
    subscription.canTransfer = planInfo.canTransfer

    subscription.discountData = subscriptionInfo.value0.discountData
    subscription.discountId = subscriptionInfo.value0.discountId

    subscription.cid = subscriptionInfo.value0.cid
    subscription.createdAt = subscriptionInfo.value0.createdAt.toI32()
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.cancelAt = subscriptionInfo.value0.cancelAt.toI32()
    subscription.renewCount = BigInt.zero()
    subscription.transferCount = BigInt.zero()
    subscription.save()

    consumer.totalSubscriptionCount = consumer.totalSubscriptionCount.plus(BigInt.fromI32(1))
    provider.totalSubscriptionCount = provider.totalSubscriptionCount.plus(BigInt.fromI32(1))
    plan.totalSubscriptionCount = plan.totalSubscriptionCount.plus(BigInt.fromI32(1))

    if (subscription.status == 'Active') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.plus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.plus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))

        provider.convertedSubscriptionCount = provider.convertedSubscriptionCount.plus(BigInt.fromI32(1))
        plan.convertedSubscriptionCount = plan.convertedSubscriptionCount.plus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        provider.trialingSubscriptionCount = provider.trialingSubscriptionCount.plus(BigInt.fromI32(1))
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.plus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    if (subscriptionInfo.value0.discountId.toHex() != "0x0000000000000000000000000000000000000000000000000000000000000000") {
        const discount = findOrCreateDiscount(provider, subscriptionInfo.value0.discountId)
        discount.redemptions = discount.redemptions.plus(BigInt.fromI32(1))
        discount.save()
    }

    incrementMetric(addressMetricName('subscription.created', event.params.provider), event.block.timestamp)
    incrementMetric('subscription.created', event.block.timestamp)
}

export function handleSubscriptionPendingChangePlan(event: SubscriptionPendingChangePlan): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPendingChangePlan'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null || subscriptionInfo.getSubscription().provider == Address.zero()) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.cid = subscriptionInfo.value0.cid
    subscription.save()
}

export function handleSubscriptionChangedPlan(event: SubscriptionChangedPlan): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const prevPlan = findOrCreateSubscriptionPlan(provider, event.params.prevPlanId)
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionChangedPlan'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null || subscriptionInfo.getSubscription().provider == Address.zero()) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status == 'Active') {
        prevPlan.activeSubscriptionCount = prevPlan.activeSubscriptionCount.minus(BigInt.fromI32(1))
        plan.totalSubscriptionCount = plan.totalSubscriptionCount.plus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        prevPlan.trialingSubscriptionCount = prevPlan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
        plan.totalSubscriptionCount = plan.totalSubscriptionCount.plus(BigInt.fromI32(1))
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.plus(BigInt.fromI32(1))
    }

    prevPlan.save()
    plan.save()

    if (subscriptionInfo.value0.discountId.toHex() != "0x0000000000000000000000000000000000000000000000000000000000000000" &&
        subscription.discountId != subscriptionInfo.value0.discountId)
    {
        const discount = findOrCreateDiscount(provider, subscriptionInfo.value0.discountId)
        discount.redemptions = discount.redemptions.plus(BigInt.fromI32(1))
        discount.save()
    }

    let planInfo = parsePlanData(subscriptionInfo.value0.planData)

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)

    subscription.plan = plan.id
    subscription.planData = subscriptionInfo.value0.planData
    subscription.price = planInfo.price
    subscription.period = planInfo.period
    subscription.freeTrial = planInfo.freeTrial
    subscription.maxActive = planInfo.maxActive
    subscription.minPeriods = planInfo.minPeriods
    subscription.gracePeriod = planInfo.gracePeriod
    subscription.canPause = planInfo.canPause
    subscription.canTransfer = planInfo.canTransfer

    subscription.discountData = subscriptionInfo.value0.discountData
    subscription.discountId = subscriptionInfo.value0.discountId

    subscription.cid = subscriptionInfo.value0.cid
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.save()
}

export function handleSubscriptionPaused(event: SubscriptionPaused): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPaused'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status != 'Paused') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.minus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.minus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))

        provider.pausedSubscriptionCount = provider.pausedSubscriptionCount.plus(BigInt.fromI32(1))
        plan.pausedSubscriptionCount = plan.pausedSubscriptionCount.plus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    subscription.status = 'Paused'
    subscription.pausedAt = event.block.timestamp.toI32()
    subscription.save()
}

export function handleSubscriptionPendingPause(event: SubscriptionPendingPause): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPendingPause'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    subscription.status = 'PendingPause'
    subscription.save()
}

export function handleSubscriptionResumed(event: SubscriptionResumed): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionResumed'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status == 'Paused') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.plus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.plus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))

        provider.pausedSubscriptionCount = provider.pausedSubscriptionCount.minus(BigInt.fromI32(1))
        plan.pausedSubscriptionCount = plan.pausedSubscriptionCount.minus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    subscription.status = 'Active'
    subscription.save()
}

export function handleSubscriptionRenewed(event: SubscriptionRenewed): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionRenewed'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null || subscriptionInfo.getSubscription().provider == Address.zero()) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status == 'Trialing') {
        provider.trialingSubscriptionCount = provider.trialingSubscriptionCount.minus(BigInt.fromI32(1))
        provider.convertedSubscriptionCount = provider.convertedSubscriptionCount.plus(BigInt.fromI32(1))

        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
        plan.convertedSubscriptionCount = plan.convertedSubscriptionCount.plus(BigInt.fromI32(1))
    } else if (subscription.status == 'PastDue') {
        plan.pastDueSubscriptionCount = plan.pastDueSubscriptionCount.minus(BigInt.fromI32(1))
    }

    if (subscription.status != 'Active') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.plus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.plus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.lastRenewedAt = event.block.timestamp.toI32()
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.renewCount = subscription.renewCount.plus(BigInt.fromI32(1))
    subscription.save()

    incrementMetric(addressMetricName('subscription.renewed', event.params.provider), event.block.timestamp)
    incrementMetric('subscription.renewed', event.block.timestamp)
}

export function handleSubscriptionPastDue(event: SubscriptionPastDue): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPastDue'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status == 'Active') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.minus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.minus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        provider.trialingSubscriptionCount = provider.trialingSubscriptionCount.minus(BigInt.fromI32(1))
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
    }

    if (subscription.status != 'PastDue') {
        provider.pastDueSubscriptionCount = provider.pastDueSubscriptionCount.plus(BigInt.fromI32(1))
        plan.pastDueSubscriptionCount = plan.pastDueSubscriptionCount.plus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    subscription.status = 'PastDue'
    subscription.pastDueAt = event.block.timestamp.toI32()
    subscription.save()
}

export function handleSubscriptionPendingCancel(event: SubscriptionPendingCancel): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPendingCancel'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    subscription.cancelAt = event.params.cancelAt.toI32()
    subscription.save()
}

export function handleSubscriptionCanceled(event: SubscriptionCanceled): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionCanceled'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return
    }

    if (subscription.status == 'Active') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.minus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.minus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        provider.trialingSubscriptionCount = provider.trialingSubscriptionCount.minus(BigInt.fromI32(1))
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
    } else if (subscription.status == 'PastDue') {
        provider.pastDueSubscriptionCount = provider.pastDueSubscriptionCount.minus(BigInt.fromI32(1))
        plan.pastDueSubscriptionCount = plan.pastDueSubscriptionCount.minus(BigInt.fromI32(1))
    }

    if (subscription.status != 'Canceled') {
        provider.canceledSubscriptionCount = provider.canceledSubscriptionCount.plus(BigInt.fromI32(1))
        plan.canceledSubscriptionCount = plan.canceledSubscriptionCount.plus(BigInt.fromI32(1))
    }

    consumer.save()
    provider.save()
    plan.save()

    subscription.status = 'Canceled'
    subscription.canceledAt = event.block.timestamp.toI32()
    subscription.save()
}

export function handleSubscriptionTrialEnded(event: SubscriptionTrialEnded): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionTrialEnded'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.subscriptionId = event.params.subscriptionId
    txn.planId = event.params.planId
    txn.save()
}

export function handleTransfer(event: Transfer): void {

    // ignore mint/burn transfers
    if (event.params.from.toHex() == '0x0000000000000000000000000000000000000000' ||
        event.params.to.toHex() == '0x0000000000000000000000000000000000000000')
    {
        return
    }

    const from = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const to = findOrCreateConsumer(event.params.to, event.block.timestamp.toI32())

    let txn = new CaskSubscriptionEvent(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'Transfer'
    txn.txnId = event.transaction.hash
    txn.timestamp = event.block.timestamp.toI32()
    txn.consumer = from.id
    txn.subscriptionId = event.params.tokenId
    txn.save()

    let subscription = CaskSubscription.load(event.params.tokenId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.tokenId.toHex()])
        return
    }

    subscription.currentOwner = to.id
    subscription.transferCount = subscription.transferCount.plus(BigInt.fromI32(1))
    subscription.save()
}

export function handleProviderSetProfile(event: ProviderSetProfile): void {
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    provider.profileCid = event.params.cid
    provider.profileNonce = event.params.nonce
    provider.paymentAddress = event.params.paymentAddress
    provider.save()
}

export function handlePlanDisabled(event: PlanDisabled): void {
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    plan.status = 'Disabled'
    plan.save()
}

export function handlePlanEnabled(event: PlanEnabled): void {
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    plan.status = 'Enabled'
    plan.save()
}

export function handlePlanRetired(event: PlanRetired): void {
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(provider, event.params.planId)

    plan.status = 'EndOfLife'
    plan.save()
}