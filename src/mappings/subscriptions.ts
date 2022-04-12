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
} from "../types/CaskSubscriptions/CaskSubscriptions"
import { Consumer, Provider, ProviderPlan, Subscription, Transaction } from "../types/schema"

function findOrCreateProvider(providerAddress: Bytes): string {
    let provider = Provider.load(providerAddress.toHex())
    if (!provider) {
        provider = new Provider(providerAddress.toHex())
        provider.save()
    }
    return provider.id
}

function findOrCreateConsumer(consumerAddress: Bytes): string {
    let consumer = Consumer.load(consumerAddress.toHex())
    if (!consumer) {
        consumer = new Consumer(consumerAddress.toHex())
        consumer.save()
    }
    return consumer.id
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

    let txn = new Transaction(event.transaction.hash.toHex())
    txn.type = 'SubscriptionCreated'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = findOrCreateConsumer(event.params.consumer)
    txn.provider = findOrCreateProvider(event.params.provider)
    txn.save()

    let subscription = new Subscription(event.params.subscriptionId.toHex())

    let contract = CaskSubscriptions.bind(event.address)
    let subscriptionInfo = contract.getSubscription(event.params.subscriptionId)

    subscription.status = subscriptionStatus(subscriptionInfo.value0.status)
    subscription.currentOwner = findOrCreateConsumer(event.params.consumer)
    subscription.provider = findOrCreateProvider(event.params.provider)
    subscription.createdAt = subscriptionInfo.value0.createdAt.toI32()
    subscription.renewAt = subscriptionInfo.value0.renewAt.toI32()
    subscription.cancelAt = subscriptionInfo.value0.cancelAt.toI32()

    subscription.save()
}

export function handleSubscriptionPendingChangePlan(event: SubscriptionPendingChangePlan): void {}

export function handleSubscriptionChangedPlan(event: SubscriptionChangedPlan): void {}

export function handleSubscriptionPaused(event: SubscriptionPaused): void {

    let txn = new Transaction(event.transaction.hash.toHex())
    txn.type = 'SubscriptionPaused'
    txn.timestamp = event.block.timestamp.toI32();
    txn.consumer = findOrCreateConsumer(event.params.consumer)
    txn.provider = findOrCreateProvider(event.params.provider)
    txn.save()

    let subscription = Subscription.load(event.params.subscriptionId.toHex())
    if (subscription == null) {
        log.warning('Subscription not found: {}', [event.params.subscriptionId.toHex()])
        return;
    }

    subscription.status = 'Paused'

    subscription.save()
}

export function handleSubscriptionResumed(event: SubscriptionResumed): void {}

export function handleSubscriptionRenewed(event: SubscriptionRenewed): void {}

export function handleSubscriptionPastDue(event: SubscriptionPastDue): void {}

export function handleSubscriptionPendingCancel(event: SubscriptionPendingCancel): void {}

export function handleSubscriptionCanceled(event: SubscriptionCanceled): void {}

export function handleSubscriptionTrialEnded(event: SubscriptionTrialEnded): void {}

