import {
    BigDecimal,
    BigInt,
    Bytes
} from "@graphprotocol/graph-ts"
import {
    CaskMetric,
} from "../../types/schema"

function findOrCreateMetricDate(name: string, timestamp: BigInt): CaskMetric {
    let date = timestamp.minus(timestamp.mod(BigInt.fromI32(86400))).toI32()
    let metricId = name+'.'+date.toString()
    let metric = CaskMetric.load(metricId)
    if (!metric) {
        metric = new CaskMetric(metricId)
        metric.name = name
        metric.date = date
    }
    return metric
}

export function incrementMetric(name: string, timestamp: BigInt,
                                value: BigDecimal = BigDecimal.fromString("1")): void
{
    let metric = findOrCreateMetricDate(name, timestamp)
    metric.value = metric.value.plus(value)
}

export function setMetric(name: string, timestamp: BigInt, value: BigDecimal): void {
    let metric = findOrCreateMetricDate(name, timestamp)
    metric.value = value
}

export function addressMetricName(name: string, address: Bytes): string {
    return name+'.'+address.toHex()
}
