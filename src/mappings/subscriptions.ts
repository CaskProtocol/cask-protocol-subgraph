import { BigInt, Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
    CaskSubscriptions,
    SubscriptionCanceled,
    SubscriptionChangedPlan,
    SubscriptionCreated,
    SubscriptionPastDue,
    SubscriptionPaused,
    SubscriptionPendingCancel,
    SubscriptionPendingChangePlan,
    SubscriptionRenewed,
    SubscriptionResumed,
    SubscriptionTrialEnded,
    Transfer,
} from "../types/CaskSubscriptions/CaskSubscriptions"
import { CaskConsumer, CaskProvider, CaskSubscriptionPlan, CaskSubscription, CaskTransaction } from "../types/schema"

function findOrCreateProvider(providerAddress: Bytes, appearedAt: i32): CaskProvider {
    let provider = CaskProvider.load(providerAddress.toHex())
    if (!provider) {
        provider = new CaskProvider(providerAddress.toHex())
        provider.appearedAt = appearedAt
        provider.save()
    }
    return provider
}

function findOrCreateSubscriptionPlan(providerAddress: Bytes, planId: i32): CaskSubscriptionPlan {
    let subscriptionPlan = CaskSubscriptionPlan.load(providerAddress.toHex()+'-'+planId.toString())
    if (!subscriptionPlan) {
        subscriptionPlan = new CaskSubscriptionPlan(providerAddress.toHex()+'-'+planId.toString())
        subscriptionPlan.save()
    }
    return subscriptionPlan
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
    } else {
        return 'None'
    }
}

export function handleSubscriptionCreated(event: SubscriptionCreated): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionCreated'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = new CaskSubscription(event.params.subscriptionId.toHex())

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.currentOwner = consumer.id
    subscription.provider = provider.id
    subscription.ref = subscriptionInfo.value0.ref.toHex()
    subscription.plan = plan.id
    subscription.cid = subscriptionInfo.value0.cid
    subscription.createdAt = subscriptionInfo.value0.createdAt.toI32()
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.cancelAt = subscriptionInfo.value0.cancelAt.toI32()

    subscription.save()

    provider.totalSubscriptionCount = provider.totalSubscriptionCount.plus(BigInt.fromI32(1))
    plan.totalSubscriptionCount = plan.totalSubscriptionCount.plus(BigInt.fromI32(1))
    consumer.totalSubscriptionCount = consumer.totalSubscriptionCount.plus(BigInt.fromI32(1))

    if (subscription.status == 'Active') {
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.plus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))
        plan.convertedSubscriptionCount = plan.convertedSubscriptionCount.plus(BigInt.fromI32(1))
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.plus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.plus(BigInt.fromI32(1))
    }

    plan.save()
    consumer.save()
    provider.save()
}

export function handleSubscriptionPendingChangePlan(event: SubscriptionPendingChangePlan): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPendingChangePlan'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.cid = subscriptionInfo.value0.cid

    subscription.save()
}

export function handleSubscriptionChangedPlan(event: SubscriptionChangedPlan): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const prevPlan = findOrCreateSubscriptionPlan(event.params.provider, event.params.prevPlanId.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionChangedPlan'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return;
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

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.plan = plan.id
    subscription.cid = subscriptionInfo.value0.cid
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()

    subscription.save()
}

export function handleSubscriptionPaused(event: SubscriptionPaused): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPaused'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.status = 'Paused'

    subscription.save()

    plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))
    plan.pausedSubscriptionCount = plan.pausedSubscriptionCount.plus(BigInt.fromI32(1))
    plan.save()
}

export function handleSubscriptionResumed(event: SubscriptionResumed): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionResumed'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.status = 'Active'

    subscription.save()

    plan.activeSubscriptionCount = plan.activeSubscriptionCount.plus(BigInt.fromI32(1))
    plan.pausedSubscriptionCount = plan.pausedSubscriptionCount.minus(BigInt.fromI32(1))
    plan.save()
}

export function handleSubscriptionRenewed(event: SubscriptionRenewed): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionRenewed'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)
    if (subscriptionInfo == null) {
        log.warning('Subscription Info not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    if (subscription.status == 'Trialing') {
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
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.renewCount = subscription.renewCount.plus(BigInt.fromI32(1))

    subscription.save()
}

export function handleSubscriptionPastDue(event: SubscriptionPastDue): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPastDue'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    if (subscription.status == 'Active') {
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
    }

    if (subscription.status != 'PastDue') {
        plan.pastDueSubscriptionCount = plan.pastDueSubscriptionCount.plus(BigInt.fromI32(1))
    }

    plan.save()

    subscription.status = 'PastDue'

    subscription.save()
}

export function handleSubscriptionPendingCancel(event: SubscriptionPendingCancel): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionPendingCancel'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.cancelAt = event.params.cancelAt.toI32()

    subscription.save()
}

export function handleSubscriptionCanceled(event: SubscriptionCanceled): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())
    const plan = findOrCreateSubscriptionPlan(event.params.provider, event.params.planId.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionCanceled'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    if (subscription.status == 'Active') {
        consumer.activeSubscriptionCount = consumer.activeSubscriptionCount.minus(BigInt.fromI32(1))
        provider.activeSubscriptionCount = provider.activeSubscriptionCount.minus(BigInt.fromI32(1))
        plan.activeSubscriptionCount = plan.activeSubscriptionCount.minus(BigInt.fromI32(1))
    } else if (subscription.status == 'Trialing') {
        plan.trialingSubscriptionCount = plan.trialingSubscriptionCount.minus(BigInt.fromI32(1))
    }

    if (subscription.status != 'Canceled') {
        plan.canceledSubscriptionCount = plan.canceledSubscriptionCount.plus(BigInt.fromI32(1))
    }

    provider.save()
    plan.save()
    consumer.save()

    subscription.status = 'Canceled'

    subscription.save()
}

export function handleSubscriptionTrialEnded(event: SubscriptionTrialEnded): void {

    const consumer = findOrCreateConsumer(event.params.consumer, event.block.timestamp.toI32())
    const provider = findOrCreateProvider(event.params.provider, event.block.timestamp.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'SubscriptionTrialEnded'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = consumer.id
    txn.provider = provider.id
    txn.save()
}

export function handleTransfer(event: Transfer): void {

    const from = findOrCreateConsumer(event.params.from, event.block.timestamp.toI32())
    const to = findOrCreateConsumer(event.params.to, event.block.timestamp.toI32())

    let txn = new CaskTransaction(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
    txn.type = 'Transfer'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = from.id
    txn.save()

    let subscription = CaskSubscription.load(event.params.tokenId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.tokenId.toHex()])
        return;
    }

    subscription.currentOwner = to.id
    subscription.transferCount = subscription.transferCount.plus(BigInt.fromI32(1))

    subscription.save()
}

