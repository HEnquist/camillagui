import {jsonDiff} from "./jsondiff"

test('diff with one property', () => {
  expect(jsonDiff(
      {unchanged: true, a: {b: 1}},
      {unchanged: true, a: {b: 2}}
  )).toBe("a > b: 1 => 2")
})

test('diff with multiple properties', () => {
  expect(jsonDiff(
      {a: {b: 1, c: {d: 10}, oldProperty: 'isDeleted'}},
      {a: {b: 2, c: {d: 20}, newProperty: 'isNew'}}
  )).toBe(
      "a > b: 1 => 2<br/>" +
      "a > c > d: 10 => 20<br/>" +
      "a > newProperty: *added* => isNew<br/>" +
      "a > oldProperty: *removed* => isDeleted"
  )
})

test('property added', () => {
  expect(jsonDiff(
      {a: {}},
      {a: {newProperty: true}}
  )).toBe("a > newProperty: *added* => true")
})

test('property removed', () => {
  expect(jsonDiff(
      {a: {oldProperty: true}},
      {a: {}}
  )).toBe("a > oldProperty: *removed* => true")
})

test('object property added', () => {
  expect(jsonDiff(
      {}, {a: {b: 1, c: 2}}
  )).toBe("a: *added* => {b:1,c:2}")
})

test('objects in array changed', () => {
  expect(jsonDiff(
      {objects: [{child1: 0}, {child2: 2}]},
      {objects: [{child1: 1}, {child3: 3}]}
  )).toBe(
      "objects > 0 > child1: 0 => 1<br/>" +
      "objects > 1 > child3: *added* => 3<br/>" + // for some reason these changes are not reported for objects[0]
      "objects > 1 > child2: *removed* => 2"
  )
})

test('object in array added', () => {
  expect(jsonDiff(
      {objects: []},
      {objects: [{child1: 1}]}
  )).toBe("objects > 0: *added* => {child1:1}")
})

test('object in array removed', () => {
  expect(jsonDiff(
      {objects: [{child1: 1}]},
      {objects: []}
  )).toBe("objects > 0: *removed* => {child1:1}")
})

test('object in array moved', () => {
  expect(jsonDiff(
      {objects: [{child1: 1}, {child2: 2}]},
      {objects: [{child2: 2}, {child1: 1}]}
  )).toBe(
      "objects > 0 > child2: *added* => 2<br/>" +
      "objects > 0 > child1: *removed* => 1<br/>" +
      "objects > 1 > child1: *added* => 1<br/>" +
      "objects > 1 > child2: *removed* => 2"
  )
})