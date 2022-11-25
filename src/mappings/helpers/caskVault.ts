import {
    CaskVault
} from "../../types/CaskVault/CaskVault"
import {
    ERC20
} from "../../types/CaskVault/ERC20"
import {
    addresses,
} from './addresses'

export function baseAssetDecimals(): i32 {
    let vault = CaskVault.bind(addresses.caskVault)
    let baseAssetAddress = vault.getBaseAsset();
    let token = ERC20.bind(baseAssetAddress)

    return token.decimals()
}