import { BigInt, Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts"
import {
    CaskVault,
    AssetDeposited,
    AssetWithdrawn,
} from "../types/CaskVault/CaskVault"
import {
    scaleDown,
} from './helpers/units';
import {Cask, CaskProvider, CaskUser} from "../types/schema"


const VAULT_DECIMALS = 18

const CASK_ID = '1'

function findOrCreateUser(userAddress: Bytes, appearedAt: i32): CaskUser {
    let user = CaskUser.load(userAddress.toHex())
    if (!user) {
        user = new CaskUser(userAddress.toHex())
        user.appearedAt = appearedAt
        user.save()
    }
    return user
}

function loadCask(): Cask {
    let cask = Cask.load(CASK_ID)
    if (cask == null) {
        cask = new Cask(CASK_ID)
    }
    return cask
}

export function handleAssetDeposited(event: AssetDeposited): void {

    const cask = loadCask()

    let depositAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS);
    cask.totalDepositAmount = cask.totalDepositAmount.plus(depositAmount)
    cask.totalDepositCount = cask.totalDepositCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.depositAmount = user.depositAmount.plus(depositAmount)
    user.depositCount = user.depositCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.plus(depositAmount)
    user.save()
}

export function handleAssetWithdrawn(event: AssetWithdrawn): void {

    const cask = loadCask()

    let withdrawAmount: BigDecimal = scaleDown(event.params.baseAssetAmount, VAULT_DECIMALS);
    cask.totalWithdrawAmount = cask.totalWithdrawAmount.plus(withdrawAmount)
    cask.totalWithdrawCount = cask.totalWithdrawCount.plus(BigInt.fromI32(1))
    cask.save()

    const user = findOrCreateUser(event.params.participant, event.block.timestamp.toI32())
    user.withdrawAmount = user.withdrawAmount.plus(withdrawAmount)
    user.withdrawCount = user.withdrawCount.plus(BigInt.fromI32(1))
    user.balance = user.balance.minus(withdrawAmount)
    user.save()
}
