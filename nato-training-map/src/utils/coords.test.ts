import { describe, expect, it } from 'vitest'
import { fromMgrs, latLonToUtm, prettyMgrs, toMgrs, utmToLatLon } from './coords'
import { AREA_CENTER } from '../terrain/elevation'

describe('MGRS conversion', () => {
  it('converts the training area centre to an 18T reference', () => {
    const ref = toMgrs(AREA_CENTER[0], AREA_CENTER[1])
    expect(ref.startsWith('18T')).toBe(true)
  })

  it('round-trips within 2 m at 10-figure accuracy', () => {
    const [lng, lat] = AREA_CENTER
    const back = fromMgrs(toMgrs(lng, lat))
    expect(back).not.toBeNull()
    expect(Math.abs(back![0] - lng)).toBeLessThan(0.0001)
    expect(Math.abs(back![1] - lat)).toBeLessThan(0.0001)
  })

  it('pretty-prints references', () => {
    expect(prettyMgrs('18TVR1234567890')).toBe('18T VR 12345 67890')
  })

  it('returns null for garbage input', () => {
    expect(fromMgrs('not a grid')).toBeNull()
  })
})

describe('UTM conversion', () => {
  it('round-trips lat/lon through UTM within ~1 m', () => {
    const [lng, lat] = AREA_CENTER
    const { easting, northing, zone } = latLonToUtm(lng, lat)
    expect(zone).toBe(18)
    const back = utmToLatLon(easting, northing, zone)
    expect(Math.abs(back.lng - lng)).toBeLessThan(0.00002)
    expect(Math.abs(back.lat - lat)).toBeLessThan(0.00002)
  })
})
