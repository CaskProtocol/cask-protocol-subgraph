import {
    BigDecimal,
    BigInt,
    Bytes,
    log
} from "@graphprotocol/graph-ts";

import {
    VAULT_DECIMALS,
    scaleDown
} from "./units";

export class PlanInfo {
    public price: BigDecimal;
    public planId: i32;
    public period: i32;
    public freeTrial: i32;
    public maxActive: i32;
    public minPeriods: i32;
    public gracePeriod: i32;
    public canPause: boolean;
    public canTransfer: boolean;
}

export function parsePlanData(planData: Bytes): PlanInfo {

    // NOTE: bytes from the protocol and contracts use ethers.BigNumber which stores bytes in big-endian order
    // whereas the BigInt library in the subgraph lib expects bytes in little-endian order, so we
    // reverse the bytes before converting to BigInt or using toI32

    let options = Bytes.fromUint8Array(planData.slice(31, 32).reverse()).toI32()

    return {
        price: scaleDown(BigInt.fromUnsignedBytes(Bytes.fromUint8Array(planData.slice(0, 12).reverse())), VAULT_DECIMALS),
        planId: Bytes.fromUint8Array(planData.slice(12, 16).reverse()).toI32(),
        period: Bytes.fromUint8Array(planData.slice(16, 20).reverse()).toI32(),
        freeTrial: Bytes.fromUint8Array(planData.slice(20, 24).reverse()).toI32(),
        maxActive: Bytes.fromUint8Array(planData.slice(24, 28).reverse()).toI32(),
        minPeriods: Bytes.fromUint8Array(planData.slice(28, 30).reverse()).toI32(),
        gracePeriod: Bytes.fromUint8Array(planData.slice(30, 31).reverse()).toI32(),
        canPause: (options & 0x0001) === 0x01,
        canTransfer: (options & 0x0002) === 0x02
    }
}