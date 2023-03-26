import {diff} from 'json8-patch'
import {cloneDeep} from "lodash"


export function jsonDiff(json1: any, json2: any) : string {
  const converted1 = cloneDeep(json1)
  const converted2 = cloneDeep(json2)
  convertArraysToObjects(converted1)
  convertArraysToObjects(converted2)
  return diff(converted1, converted2)
      .map(op => {
        const path = op.path.substr(1).split('/')
        switch (op.op) {
          case "add": return diffEntry(path, "*added*", valueAsString(op.value))
          case "remove": return diffEntry(path, "*removed*", valueAt(json1, path))
          case "replace": return diffEntry(path, valueAt(json1, path), valueAsString(op.value))
        }
        return ""
      }).join('<br/>')
}

/**
 * Recursively converts all array property values to objects.
 * This is necessary because json8-patch reports a change for the whole array instead of individual array elements.
 * @param object
 */
function convertArraysToObjects(object: any) {
  if (object !== null) {
  Object.getOwnPropertyNames(object)
      .forEach(property => {
        const value = object[property]
        if (Array.isArray(value))
          object[property] = {...value} // convert Array to Object
        if (typeof value === 'object')
          convertArraysToObjects(value)
      })
    }
}

function diffEntry(path: string[], oldValue: string, newValue: string): string {
  return `${path.join(' > ')}: ${oldValue} => ${newValue}`
}

function valueAt(json: any, path: string[]): any {
  return path.length === 0 ?
      valueAsString(json)
      : valueAt(json[path[0]], path.slice(1))
}

function valueAsString(json: any): string {
  if (Array.isArray(json)) {
    const array = json as any[]
    return "[" + array.map(item => valueAsString(item)).join() + "]"
  } else if (json !== null && typeof json === 'object')
    return "{"
        + Object.getOwnPropertyNames(json)
            .map(property => property + ":" + valueAsString(json[property]))
            .join()
        + "}"
  else
    return json
}