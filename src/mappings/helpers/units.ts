import { BigDecimal, Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export function scaleDown(num: BigInt, decimals: i32): BigDecimal {
    return num.divDecimal(BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal());
}

export function sharesToValue(shares: BigInt, pricePerShare: BigInt, decimals: i32): BigInt {
    return shares.times(pricePerShare).div(BigInt.fromI32(10).pow(u8(decimals)))
}

