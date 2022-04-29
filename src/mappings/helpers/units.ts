import { BigDecimal, Address, BigInt, ethereum } from '@graphprotocol/graph-ts';

export const VAULT_DECIMALS = 6;

export function scaleDown(num: BigInt, decimals: i32): BigDecimal {
    return num.divDecimal(BigInt.fromI32(10).pow(u8(decimals)).toBigDecimal());
}