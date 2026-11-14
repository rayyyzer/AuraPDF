import { test } from "node:test"
import assert from "node:assert/strict"
import {
  clampAxisPlacement,
  computeClampedPinchTransform,
  getAxisBounds,
} from "../src/components/reader/zoomGeometry.ts"

test("getAxisBounds matches centered/start placement when smaller and scroll bounds when larger", () => {
  assert.deepEqual(getAxisBounds(600, 16, 1248, true), { min: 340, max: 340 })
  assert.deepEqual(getAxisBounds(600, 36, 764, false), { min: 36, max: 36 })
  assert.deepEqual(getAxisBounds(1600, 16, 1248, true), {
    min: -336,
    max: 16,
  })
  // Continuous C0 boundary where scaledSize === availSpan
  assert.deepEqual(getAxisBounds(1248, 16, 1248, true), { min: 16, max: 16 })
})

test("off-center pinch keeps fitting page centered with zero horizontal drift", () => {
  const res = computeClampedPinchTransform({
    baseLeft: 352.4,
    baseTop: 52,
    baseWidth: 575.3,
    baseHeight: 744.5,
    availLeft: 16,
    availTop: 52,
    availWidth: 1248,
    availHeight: 732,
    curClientX: 460,
    curClientY: 400,
    lastClientX: 460,
    lastClientY: 400,
    lastTx: 0,
    lastTy: 0,
    lastRatio: 1,
    nextRatio: 1.9,
    centerVertical: true,
  })

  const visualLeft = 352.4 + res.tx
  const expectedCenteredLeft = 16 + (1248 - 575.3 * 1.9) / 2
  assert.ok(Math.abs(visualLeft - expectedCenteredLeft) < 1e-6)
})

test("crossing fit-width activates pointer-anchored panning without deadband or jump", () => {
  const step1 = computeClampedPinchTransform({
    baseLeft: 352,
    baseTop: 52,
    baseWidth: 576,
    baseHeight: 744,
    availLeft: 16,
    availTop: 52,
    availWidth: 1248,
    availHeight: 732,
    curClientX: 460,
    curClientY: 400,
    lastClientX: 460,
    lastClientY: 400,
    lastTx: 0,
    lastTy: 0,
    lastRatio: 1,
    nextRatio: 1248 / 576,
    centerVertical: true,
  })
  assert.ok(Math.abs(352 + step1.tx - 16) < 1e-6)

  // Step 2 exceeds availWidth by ~100px; cursor at 460 should pull right edge slightly inward or stay valid
  const step2Ratio = (1248 + 100) / 576
  const step2 = computeClampedPinchTransform({
    baseLeft: 352,
    baseTop: 52,
    baseWidth: 576,
    baseHeight: 744,
    availLeft: 16,
    availTop: 52,
    availWidth: 1248,
    availHeight: 732,
    curClientX: 460,
    curClientY: 400,
    lastClientX: 460,
    lastClientY: 400,
    lastTx: step1.tx,
    lastTy: step1.ty,
    lastRatio: 1248 / 576,
    nextRatio: step2Ratio,
    centerVertical: true,
  })
  const visualLeft2 = 352 + step2.tx
  assert.ok(visualLeft2 >= 16 - 100 - 1e-6 && visualLeft2 <= 16 + 1e-6)
  // Because cursor 460 is inside [16, 1264], pointer anchor moves left proportionally:
  const expectedAnchorLeft = 16 - 100 * ((460 - 16) / 1248)
  assert.ok(Math.abs(visualLeft2 - expectedAnchorLeft) < 1e-6)
})

test("continuous mode vertical axis stays top-aligned at scrollTop=0 when shorter than viewport", () => {
  const res = computeClampedPinchTransform({
    baseLeft: 352.4,
    baseTop: 36,
    baseWidth: 575.3,
    baseHeight: 744.5,
    availLeft: 16,
    availTop: 36,
    availWidth: 1248,
    availHeight: 764,
    curClientX: 480,
    curClientY: 400,
    lastClientX: 480,
    lastClientY: 400,
    lastTx: 0,
    lastTy: 0,
    lastRatio: 1,
    nextRatio: 0.6,
    centerVertical: false,
  })
  assert.ok(Math.abs(36 + res.ty - 36) < 1e-6)
  assert.equal(
    clampAxisPlacement({
      scaledSize: 450,
      availStart: 36,
      availSpan: 764,
      desiredStart: 175,
      centerIfSmaller: false,
    }),
    36,
  )
})
