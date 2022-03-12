import { BigInt } from "@graphprotocol/graph-ts"
import {
  CaskSubscriptions,
  AdminChanged,
  Upgraded,
  Approval,
  ApprovalForAll,
  OwnershipTransferred,
  Paused,
  SubscriptionCanceled,
  SubscriptionChangedDiscount,
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
  Unpaused
} from "../generated/CaskSubscriptions/CaskSubscriptions"
import { ExampleEntity } from "../generated/schema"

export function handleAdminChanged(event: AdminChanged): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new ExampleEntity(event.transaction.from.toHex())

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  entity.previousAdmin = event.params.previousAdmin
  entity.newAdmin = event.params.newAdmin

  // Entities can be written to the store with `.save()`
  entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.admin(...)
  // - contract.implementation(...)
  // - contract.balanceOf(...)
  // - contract.getActiveSubscriptions(...)
  // - contract.getActiveSubscriptionsCount(...)
  // - contract.getApproved(...)
  // - contract.getConsumerSubscriptionCount(...)
  // - contract.getConsumerSubscriptions(...)
  // - contract.getPendingPlanChange(...)
  // - contract.getProviderActiveSubscriptionCount(...)
  // - contract.getProviderPlanActiveSubscriptionCount(...)
  // - contract.getProviderSubscriptionCount(...)
  // - contract.getProviderSubscriptions(...)
  // - contract.getSubscription(...)
  // - contract.isApprovedForAll(...)
  // - contract.isTrustedForwarder(...)
  // - contract.name(...)
  // - contract.owner(...)
  // - contract.ownerOf(...)
  // - contract.paused(...)
  // - contract.subscriptionManager(...)
  // - contract.subscriptionPlans(...)
  // - contract.supportsInterface(...)
  // - contract.symbol(...)
  // - contract.tokenURI(...)
  // - contract.trustedForwarder(...)
  // - contract.versionRecipient(...)
}

export function handleUpgraded(event: Upgraded): void {}

export function handleApproval(event: Approval): void {}

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handlePaused(event: Paused): void {}

export function handleSubscriptionCanceled(event: SubscriptionCanceled): void {}

export function handleSubscriptionChangedDiscount(
  event: SubscriptionChangedDiscount
): void {}

export function handleSubscriptionChangedPlan(
  event: SubscriptionChangedPlan
): void {}

export function handleSubscriptionCreated(event: SubscriptionCreated): void {}

export function handleSubscriptionPastDue(event: SubscriptionPastDue): void {}

export function handleSubscriptionPaused(event: SubscriptionPaused): void {}

export function handleSubscriptionPendingCancel(
  event: SubscriptionPendingCancel
): void {}

export function handleSubscriptionPendingChangePlan(
  event: SubscriptionPendingChangePlan
): void {}

export function handleSubscriptionRenewed(event: SubscriptionRenewed): void {}

export function handleSubscriptionResumed(event: SubscriptionResumed): void {}

export function handleSubscriptionTrialEnded(
  event: SubscriptionTrialEnded
): void {}

export function handleTransfer(event: Transfer): void {}

export function handleUnpaused(event: Unpaused): void {}
